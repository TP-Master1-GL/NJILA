from rest_framework.permissions import BasePermission
import requests
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Constantes de rôles — source de vérité unique
# Valeurs issues du payload JWT (cf. logs : "Role: MANAGER_GLOBAL")
# ─────────────────────────────────────────────────────────────────────────────

ROLE_ADMIN           = ('ADMIN', 'ADMINISTRATEUR')
ROLE_MANAGER_GLOBAL  = 'MANAGER_GLOBAL'
ROLE_MANAGER_LOCAL   = 'MANAGER_LOCAL'
ROLE_GUICHETIER      = 'GUICHETIER'
ROLE_CHAUFFEUR       = 'CHAUFFEUR'
ROLE_VOYAGEUR        = 'VOYAGEUR'


# ─────────────────────────────────────────────────────────────────────────────
# Helpers internes
# ─────────────────────────────────────────────────────────────────────────────

def _user_info(request):
    """Retourne user_info injecté par le middleware JWT, ou un dict vide."""
    return getattr(request, 'user_info', {}) or {}


def _role(request):
    return _user_info(request).get('role', '')


def _agence_id(request):
    """
    Clé injectée par le middleware : 'agenceId'  ← camelCase, pas 'agence_id'
    Aligné avec le payload JWT retourné par auth-service.
    """
    return str(_user_info(request).get('agenceId') or '')


def _filiale_id(request):
    """
    Clé injectée par le middleware : 'filialeId'  ← camelCase, pas 'filiale_id'
    """
    return str(_user_info(request).get('filialeId') or '')


def _ensure_authenticated(request):
    """
    Vérifie que le middleware a injecté user_info avec un userId valide.
    Si la requête arrive via un chemin public (GET gratuit) mais qu'une vue
    exige quand même une auth en écriture, on revalide le token directement.
    """
    if _user_info(request).get('userId'):
        return True

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        logger.debug("[Permission] Aucun Bearer token")
        return False

    token = auth_header.split(' ')[1]
    try:
        response = requests.post(
            settings.AUTH_SERVICE_TOKEN_VALIDATION_URL,
            headers={
                'X-Internal-Token': getattr(
                    settings, 'INTERNAL_SERVICE_TOKEN', 'njila-shared-secret-2026'
                ),
                'Content-Type': 'application/json',
            },
            json={'token': token},
            timeout=2,
        )
        if response.status_code == 200:
            data = response.json()
            if data.get('valid') and data.get('payload'):
                payload = data['payload']
                request.user_info = {
                    'userId':    payload.get('userId'),
                    'role':      payload.get('role'),
                    'sessionId': payload.get('sessionId'),
                    'filialeId': payload.get('filialeId'),  # camelCase
                    'agenceId':  payload.get('agenceId'),   # camelCase
                    'exp':       payload.get('exp'),
                }
                logger.debug("[Permission] Token revalidé : %s", request.user_info.get('userId'))
                return True
        logger.debug("[Permission] Token invalide — status %s", response.status_code)
        return False
    except requests.exceptions.RequestException as e:
        logger.error("[Permission] Auth-service indisponible : %s", e)
        return False


def _obj_agence_id(obj):
    """
    Extrait l'identifiant d'agence d'un objet modèle.
    Gère plusieurs conventions de nommage, y compris les Trajet
    (qui passent par filiale_depart ou filiale_arrive).
    """
    # FK directe agence (Agence, Filiale, Bus, Chauffeur, Guichetier…)
    for attr in ('agence_id', 'Id_agence_id'):
        val = getattr(obj, attr, None)
        if val is not None:
            return str(val)

    # Relation FK objet (obj.agence.id_agence)
    agence = getattr(obj, 'agence', None)
    if agence is not None:
        return str(getattr(agence, 'id_agence', None) or getattr(agence, 'id', None) or '')

    # ── Cas Trajet : pas de FK agence directe, passe par filiale_depart ──────
    filiale_depart = getattr(obj, 'filiale_depart', None)
    if filiale_depart is not None:
        # filiale_depart.agence_id (clé FK Django) ou filiale_depart.agence.id_agence
        val = getattr(filiale_depart, 'agence_id', None)
        if val is not None:
            return str(val)
        agence = getattr(filiale_depart, 'agence', None)
        if agence is not None:
            return str(getattr(agence, 'id_agence', None) or getattr(agence, 'id', None) or '')

    return ''


def _obj_filiale_id(obj):
    """
    Extrait l'identifiant de filiale d'un objet modèle.
    Pour un objet Filiale lui-même, on compare avec obj.id.
    """
    for attr in ('id', 'filiale_id', '_id_filiale_id'):
        val = getattr(obj, attr, None)
        if val is not None:
            return str(val)
    return ''


# ─────────────────────────────────────────────────────────────────────────────
# Permissions génériques
# ─────────────────────────────────────────────────────────────────────────────

class IsAuthenticated(BasePermission):
    """Vérifie qu'un utilisateur est authentifié (user_info présent)."""

    message = "Authentification requise."

    def has_permission(self, request, view):
        return _ensure_authenticated(request)


class IsVoyageur(BasePermission):
    """Voyageurs uniquement."""

    message = "Accès réservé aux voyageurs."

    def has_permission(self, request, view):
        if not _ensure_authenticated(request):
            return False
        return _role(request) == ROLE_VOYAGEUR


class IsGuichetier(BasePermission):
    """
    Guichetier et rôles supérieurs.
    GUICHETIER < MANAGER_LOCAL < MANAGER_GLOBAL < ADMIN
    """

    message = "Accès réservé aux guichetiers et rôles supérieurs."

    def has_permission(self, request, view):
        if not _ensure_authenticated(request):
            return False
        return _role(request) in (
            ROLE_GUICHETIER, ROLE_MANAGER_LOCAL, ROLE_MANAGER_GLOBAL, *ROLE_ADMIN
        )


class IsManagerLocal(BasePermission):
    """
    Manager local et rôles supérieurs.

    has_object_permission :
      ADMIN          → tout
      MANAGER_GLOBAL → objets dont l'agence correspond à la sienne
      MANAGER_LOCAL  → objets dont la filiale correspond à la sienne
    """

    message = "Accès réservé aux managers locaux et rôles supérieurs."

    def has_permission(self, request, view):
        if not _ensure_authenticated(request):
            return False
        return _role(request) in (ROLE_MANAGER_LOCAL, ROLE_MANAGER_GLOBAL, *ROLE_ADMIN)

    def has_object_permission(self, request, view, obj):
        role = _role(request)

        if role in ROLE_ADMIN:
            return True

        if role == ROLE_MANAGER_GLOBAL:
            user_ag = _agence_id(request)
            obj_ag  = _obj_agence_id(obj)
            allowed = bool(user_ag) and user_ag == obj_ag
            if not allowed:
                logger.warning(
                    "[IsManagerLocal] MANAGER_GLOBAL %s — agenceId user=%s ≠ obj=%s",
                    _user_info(request).get('userId'), user_ag, obj_ag,
                )
            return allowed

        if role == ROLE_MANAGER_LOCAL:
            user_fil = _filiale_id(request)
            obj_fil  = _obj_filiale_id(obj)
            allowed  = bool(user_fil) and user_fil == obj_fil
            if not allowed:
                logger.warning(
                    "[IsManagerLocal] MANAGER_LOCAL %s — filialeId user=%s ≠ obj=%s",
                    _user_info(request).get('userId'), user_fil, obj_fil,
                )
            return allowed

        return False


class IsManagerGlobal(BasePermission):
    """
    Manager global et admin.

    has_object_permission :
      ADMIN          → tout
      MANAGER_GLOBAL → objets dont l'agence correspond à la sienne
    """

    message = "Accès réservé aux managers globaux et administrateurs."

    def has_permission(self, request, view):
        if not _ensure_authenticated(request):
            return False
        return _role(request) in (ROLE_MANAGER_GLOBAL, *ROLE_ADMIN)

    def has_object_permission(self, request, view, obj):
        role = _role(request)

        if role in ROLE_ADMIN:
            return True

        if role == ROLE_MANAGER_GLOBAL:
            user_ag = _agence_id(request)
            obj_ag  = _obj_agence_id(obj)
            allowed = bool(user_ag) and user_ag == obj_ag
            if not allowed:
                logger.warning(
                    "[IsManagerGlobal] MANAGER_GLOBAL %s — agenceId user=%s ≠ obj=%s",
                    _user_info(request).get('userId'), user_ag, obj_ag,
                )
            return allowed

        return False


class IsAdmin(BasePermission):
    """Administrateurs uniquement."""

    message = "Accès réservé aux administrateurs."

    def has_permission(self, request, view):
        if not _ensure_authenticated(request):
            return False
        return _role(request) in ROLE_ADMIN

class IsChauffeur(BasePermission):
    """Chauffeurs et rôles supérieurs."""

    message = "Accès réservé aux chauffeurs et rôles supérieurs."

    def has_permission(self, request, view):
        if not _ensure_authenticated(request):
            return False
        return _role(request) in (
            ROLE_CHAUFFEUR, ROLE_MANAGER_LOCAL, ROLE_MANAGER_GLOBAL, *ROLE_ADMIN
        )


# ─────────────────────────────────────────────────────────────────────────────
# Permissions composites Agence / Filiale
# ─────────────────────────────────────────────────────────────────────────────

class AgencePermission(BasePermission):
    """
    Contrôle d'accès complet sur les agences.

    ┌───────────────────┬───────┬────────────────┬────────┐
    │ Méthode           │ ADMIN │ MANAGER_GLOBAL │ Autres │
    ├───────────────────┼───────┼────────────────┼────────┤
    │ GET (liste/détail)│  ✓    │  ✓             │ public │
    │ POST  (création)  │  ✓    │  ✗             │  ✗     │
    │ PATCH / PUT       │  ✓    │  ✓ (sa propre) │  ✗     │
    │ DELETE            │  ✓    │  ✗             │  ✗     │
    └───────────────────┴───────┴────────────────┴────────┘
    """

    message = "Vous n'avez pas les droits nécessaires sur cette agence."

    def has_permission(self, request, view):

        # GET public
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        # Vérification auth
        if not _ensure_authenticated(request):
            logger.warning(
                "[AgencePermission] utilisateur non authentifié"
            )
            return False

        role = _role(request)

        logger.info(
            "[AgencePermission] role=%s method=%s",
            role,
            request.method
        )

        # POST + DELETE → ADMIN uniquement
        if request.method in ('POST', 'DELETE'):

            allowed = role == ROLE_ADMIN

            if not allowed:
                logger.warning(
                    "[AgencePermission] %s refusé pour rôle=%s",
                    request.method,
                    role
                )

            return allowed

        # PATCH + PUT → ADMIN + MANAGER_GLOBAL
        if request.method in ('PATCH', 'PUT'):

            allowed = role in (
                ROLE_ADMIN,
                ROLE_MANAGER_GLOBAL
            )

            if not allowed:
                logger.warning(
                    "[AgencePermission] PATCH/PUT refusé pour rôle=%s",
                    role
                )

            return allowed

        return False

    def has_object_permission(self, request, view, obj):

        # Lecture publique
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        role = _role(request)

        # ADMIN → accès total
        if role in ROLE_ADMIN:
            return True

        # MANAGER_GLOBAL → seulement sa propre agence
        if role == ROLE_MANAGER_GLOBAL and request.method in ('PATCH', 'PUT'):

            user_ag = str(_agence_id(request))

            # IMPORTANT :
            # Ton modèle utilise id_agence
            obj_ag = str(
                getattr(obj, 'id_agence', None)
                or getattr(obj, 'id', None)
                or ''
            )

            logger.warning(
                "[AgencePermission][DEBUG] user_ag=%s obj_ag=%s",
                user_ag,
                obj_ag
            )

            allowed = bool(user_ag) and user_ag == obj_ag

            if not allowed:
                logger.warning(
                    "[AgencePermission] MANAGER_GLOBAL %s refuse "
                    "modification agence=%s user_ag=%s",
                    _user_info(request).get('userId'),
                    obj_ag,
                    user_ag
                )

            return allowed

        return False

class FilialePermission(BasePermission):
    """
    Contrôle d'accès complet sur les filiales.

    ┌───────────────────┬───────┬────────────────┬─────────────────┬────────┐
    │ Méthode           │ ADMIN │ MANAGER_GLOBAL  │ MANAGER_LOCAL   │ Autres │
    ├───────────────────┼───────┼────────────────┼─────────────────┼────────┤
    │ GET               │  ✓    │  ✓             │  ✓              │ public │
    │ POST  (création)  │  ✓    │  ✗             │  ✗              │  ✗     │
    │ PATCH / PUT       │  ✓    │  ✓ (ses fil.)  │  ✓ (sa propre)  │  ✗     │
    │ DELETE            │  ✓    │  ✗             │  ✗              │  ✗     │
    └───────────────────┴───────┴────────────────┴─────────────────┴────────┘
    """

    message = "Vous n'avez pas les droits nécessaires sur cette filiale."

    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        if not _ensure_authenticated(request):
            return False

        role = _role(request)

        if request.method in ('POST', 'DELETE'):
            allowed = role == ROLE_ADMIN
            if not allowed:
                logger.warning(
                    "[FilialePermission] %s refusé — rôle=%s (ADMIN requis)",
                    request.method, role,
                )
            return allowed

        if request.method in ('PATCH', 'PUT'):
            allowed = role in (ROLE_ADMIN, ROLE_MANAGER_GLOBAL, ROLE_MANAGER_LOCAL)
            if not allowed:
                logger.warning(
                    "[FilialePermission] PATCH/PUT refusé — rôle=%s", role,
                )
            return allowed

        return False

    def has_object_permission(self, request, view, obj):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True

        role = _role(request)

        if role in ROLE_ADMIN:
            return True

        # MANAGER_GLOBAL : peut modifier toutes les filiales de son agence
        if role == ROLE_MANAGER_GLOBAL and request.method in ('PATCH', 'PUT'):
            user_ag = _agence_id(request)
            obj_ag  = _obj_agence_id(obj)
            allowed = bool(user_ag) and user_ag == obj_ag
            if not allowed:
                logger.warning(
                    "[FilialePermission] MANAGER_GLOBAL %s tente de modifier "
                    "la filiale %s (agence obj=%s, son agenceId=%s)",
                    _user_info(request).get('userId'),
                    getattr(obj, 'id', '?'), obj_ag, user_ag,
                )
            return allowed

        # MANAGER_LOCAL : uniquement sa propre filiale
        if role == ROLE_MANAGER_LOCAL and request.method in ('PATCH', 'PUT'):
            user_fil = _filiale_id(request)
            obj_fil  = _obj_filiale_id(obj)
            allowed  = bool(user_fil) and user_fil == obj_fil
            if not allowed:
                logger.warning(
                    "[FilialePermission] MANAGER_LOCAL %s tente de modifier "
                    "la filiale %s — sa filialeId=%s",
                    _user_info(request).get('userId'), obj_fil, user_fil,
                )
            return allowed

        return False
