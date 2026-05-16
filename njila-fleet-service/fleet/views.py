from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, permission_classes

from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Count, Q, Sum, Avg
from django.utils import timezone
import logging

# Swagger imports
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample, OpenApiResponse
from drf_spectacular.types import OpenApiTypes
from .permissions import AgencePermission

from .models import (
    Agence, Bus, Guichetier, Chauffeur, Trajet,
    Voyage, Filiale, Annonce, Avis,
    StatusBus, StatusVoyage, StatutGlobalAgence, TypeAnnonce,
    ClasseBus
)
from .serializers import (
    AgenceSerializer, AgenceListSerializer,
    FilialeSerializer, FilialeListSerializer,
    BusListSerializer, BusDetailSerializer, BusCreateUpdateSerializer, BusStatusUpdateSerializer,
    GuichetierSerializer,
    ChauffeurSerializer, ChauffeurListSerializer,
    TrajetSerializer, TrajetListSerializer,
    VoyageSerializer, VoyageListSerializer, VoyageCreateUpdateSerializer, VoyageStatusUpdateSerializer,
    AnnonceSerializer,
    AvisSerializer
)
from .rabbitmq import (
    # ── Publications existantes ──────────────────────────────────────
    publish_agence_created, publish_agence_updated,
    publish_filiale_created, publish_filiale_updated,
    publish_voyage_cancelled, publish_voyage_delayed, publish_voyage_departed,
    publish_bus_status_changed, publish_bus_breakdown,
    publish_agence_subscription_request, publish_staff_created, publish_annonce_published,
    # ── Nouvelles publications vers booking ──────────────────────────
    publish_agency_updated_for_booking,
    publish_filiale_updated_for_booking,
    publish_voyage_updated_for_booking,
    publish_bus_updated_for_booking,
    rabbitmq_client,
)

logger = logging.getLogger(__name__)

# ============ PERMISSIONS RBAC ============
from .permissions import (
    IsAuthenticated, IsAdmin, IsManagerLocal,
    IsManagerGlobal, IsGuichetier, IsChauffeur, IsVoyageur
)


# ==============================================================================
# AGENCES
# ==============================================================================

class AgenceListCreateView(generics.ListCreateAPIView):
    """
    GET:  Liste des agences (Public)
    POST: Créer une agence (Admin uniquement)
    """
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [AllowAny()]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['statut_global']
    search_fields = ['name', 'email_officiel', 'telephone']
    ordering_fields = ['name', 'date_inscription', 'statut_global']

    def get_queryset(self):
        queryset = Agence.objects.all()
        statut = self.request.query_params.get('statut_global')
        if statut:
            queryset = queryset.filter(statut_global=statut)
        return queryset.order_by('-date_inscription')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AgenceSerializer
        return AgenceListSerializer

    @extend_schema(
        tags=['Agences'],
        summary="Liste des agences",
        description="Récupère la liste de toutes les agences (accès public). Possibilité de filtrer par statut.",
        parameters=[
            OpenApiParameter(
                name='statut_global',
                description="Filtrer par statut (active, suspendue, expiree, en_attente)",
                required=False, type=str, location=OpenApiParameter.QUERY
            )
        ],
        responses={200: AgenceListSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Agences'],
        summary="Créer une agence",
        description="Crée une nouvelle agence (nécessite droits Administrateur)",
        request=AgenceSerializer,
        examples=[
            OpenApiExample(
                'Exemple de création',
                value={
                    'name': 'Express Voyages',
                    'adresse': '123 Boulevard de la Liberté, Douala',
                    'telephone': '699888888',
                    'email_officiel': 'contact@express.cm',
                    'statut_global': 'active'
                },
                request_only=True,
            ),
            OpenApiExample(
                'Exemple de réponse',
                value={
                    'id_agence': '123e4567-e89b-12d3-a456-426614174000',
                    'name': 'Express Voyages',
                    'adresse': '123 Boulevard de la Liberté, Douala',
                    'telephone': '699888888',
                    'email_officiel': 'contact@express.cm',
                    'statut_global': 'active',
                    'date_inscription': '2026-04-08T10:00:00Z',
                    '_events': {
                        'agence_created': True,
                        'subscription_request': True,
                        'booking_sync': True,
                        'all_sent': True,
                    }
                },
                response_only=True,
            )
        ],
        responses={
            201: AgenceSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Admin requis"),
            409: OpenApiResponse(description="Email déjà utilisé"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    @transaction.atomic
    def perform_create(self, serializer):
        agence = serializer.save()

        events_status = {
            'agence_created':       publish_agence_created(agence),
            'subscription_request': publish_agence_subscription_request(agence),
            'booking_sync':         publish_agency_updated_for_booking(agence),
        }

        # Stocker le statut des événements pour y accéder dans create()
        self._rabbitmq_events = events_status

        all_sent = all(events_status.values())
        if all_sent:
            logger.info(
                "Agence créée: %s | RabbitMQ: tous les événements envoyés ✓ | %s",
                agence.name, events_status
            )
        else:
            logger.warning(
                "Agence créée: %s | RabbitMQ: certains événements ont échoué ✗ | %s",
                agence.name, events_status
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        headers = self.get_success_headers(serializer.data)

        # Enrichir la réponse avec le statut des événements RabbitMQ
        response_data = dict(serializer.data)
        events = getattr(self, '_rabbitmq_events', {})
        response_data['_events'] = {
            'agence_created':       events.get('agence_created',       False),
            'subscription_request': events.get('subscription_request', False),
            'booking_sync':         events.get('booking_sync',         False),
            'all_sent':             all(events.values()) if events else False,
        }

        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)


class AgenceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET:        Détail agence (Public)
    PUT/PATCH: Modifier agence (ADMIN + MANAGER_GLOBAL sur sa propre agence)
    DELETE:     Supprimer agence (ADMIN uniquement)
    """

    queryset = Agence.objects.all()
    lookup_field = 'id_agence'
    serializer_class = AgenceSerializer

    # ─────────────────────────────────────────────────────────────
    # Permissions
    # ─────────────────────────────────────────────────────────────
    def get_permissions(self):

        # Lecture publique
        if self.request.method in ['GET', 'HEAD', 'OPTIONS']:
            return [AllowAny()]

        # Toutes les écritures passent par AgencePermission
        return [AgencePermission()]


    @extend_schema(
        tags=['Agences'], summary="Détail d'une agence",
        description="Récupère les détails d'une agence spécifique par son ID (accès public)",
        responses={200: AgenceSerializer, 404: OpenApiResponse(description="Agence non trouvée")},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Agences'], summary="Modifier une agence",
        description="Modifie une agence existante (nécessite droits Administrateur)",
        request=AgenceSerializer,
        examples=[
            OpenApiExample(
                'Exemple de modification',
                value={'name': 'Express Voyages SA', 'telephone': '699888889', 'statut_global': 'active'}
            )
        ],
        responses={
            200: AgenceSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Agence non trouvée"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        tags=['Agences'], summary="Modification partielle d'une agence",
        description="Modifie partiellement une agence existante (nécessite droits Administrateur)",
        request=AgenceSerializer,
        responses={
            200: AgenceSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Agence non trouvée"),
        }
    )
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @extend_schema(
        tags=['Agences'], summary="Supprimer une agence",
        description="Supprime une agence (nécessite droits Administrateur). L'agence ne doit pas avoir de bus associés.",
        responses={
            204: OpenApiResponse(description="Suppression réussie"),
            400: OpenApiResponse(description="Impossible de supprimer - des bus sont associés"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Agence non trouvée"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)

    @transaction.atomic
    def perform_update(self, serializer):
        agence = serializer.save()

        events_status = {
            'agence_updated': publish_agence_updated(agence),
            'booking_sync':   publish_agency_updated_for_booking(agence),
        }

        all_sent = all(events_status.values())
        if all_sent:
            logger.info(
                "Agence mise à jour: %s | RabbitMQ: tous les événements envoyés ✓ | %s",
                agence.name, events_status
            )
        else:
            logger.warning(
                "Agence mise à jour: %s | RabbitMQ: certains événements ont échoué ✗ | %s",
                agence.name, events_status
            )

    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.bus.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"error": f"Impossible de supprimer l'agence {instance.name} car elle possède {instance.bus.count()} bus"}
            )
        instance.delete()
        logger.info(f"Agence supprimée: {instance.name}")


# ==============================================================================
# FILIALES
# ==============================================================================

class FilialeListCreateView(generics.ListCreateAPIView):
    """
    GET:  Liste des filiales (Public)
    POST: Créer une filiale (Manager Global ou Admin)
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ville', 'est_active', 'agence']
    search_fields = ['nom', 'code', 'ville', 'email']
    ordering_fields = ['nom', 'ville', 'created_at']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerGlobal()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Filiale.objects.all()
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(agence_id=agence_id)
        ville = self.request.query_params.get('ville')
        if ville:
            queryset = queryset.filter(ville=ville)

        if hasattr(self.request, 'user_info') and self.request.method != 'POST':
            role = self.request.user_info.get('role')
            if role == 'MANAGER_GLOBAL':
                user_agence_id = self.request.user_info.get('agence_id')
                queryset = queryset.filter(agence_id=user_agence_id)

        return queryset.select_related('agence').order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return FilialeSerializer
        return FilialeListSerializer

    @extend_schema(
        tags=['Filiales'], summary="Liste des filiales",
        description="Récupère la liste des filiales (accès public). Possibilité de filtrer par agence ou par ville.",
        parameters=[
            OpenApiParameter(name='agence_id', description="ID de l'agence parente",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='ville', description="Filtrer par ville (Douala, Yaoundé, etc.)",
                             required=False, type=str, location=OpenApiParameter.QUERY)
        ],
        responses={200: FilialeListSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Filiales'], summary="Créer une filiale",
        description="Crée une nouvelle filiale (nécessite droits Manager Global)",
        request=FilialeSerializer,
        examples=[
            OpenApiExample(
                'Exemple de création',
                value={
                    'nom': 'Agence Centrale Douala', 'code': 'DLA-CENTRAL-01',
                    'ville': 'Douala', 'adresse': '123 Boulevard de la Liberté, Douala',
                    'telephone': '699777777', 'email': 'douala@express.cm',
                    'est_active': True, 'agence': 'uuid-de-l-agence'
                },
                request_only=True,
            )
        ],
        responses={
            201: FilialeSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Global requis"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    @transaction.atomic
    def perform_create(self, serializer):
        filiale = serializer.save()

        events_status = {
            'filiale_created': publish_filiale_created(filiale),
            'booking_sync':    publish_filiale_updated_for_booking(filiale),
        }

        all_sent = all(events_status.values())
        if all_sent:
            logger.info(
                "Filiale créée: %s | RabbitMQ: tous les événements envoyés ✓ | %s",
                filiale.nom, events_status
            )
        else:
            logger.warning(
                "Filiale créée: %s | RabbitMQ: certains événements ont échoué ✗ | %s",
                filiale.nom, events_status
            )


class FilialeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET:        Détail filiale (Public)
    PUT/PATCH:  Modifier filiale (Manager Global ou Admin)
    DELETE:     Supprimer filiale (Manager Global ou Admin)
    """
    queryset = Filiale.objects.all()
    lookup_field = 'id_filiale'
    serializer_class = FilialeSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerGlobal()]

    @extend_schema(
        tags=['Filiales'], summary="Détail d'une filiale",
        description="Récupère les détails d'une filiale spécifique (accès public)",
        responses={200: FilialeSerializer, 404: OpenApiResponse(description="Filiale non trouvée")},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Filiales'], summary="Modifier une filiale",
        description="Modifie une filiale existante (nécessite droits Manager Global)",
        request=FilialeSerializer,
        responses={
            200: FilialeSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Filiale non trouvée"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        tags=['Filiales'], summary="Supprimer une filiale",
        description="Supprime une filiale (nécessite droits Manager Global)",
        responses={
            204: OpenApiResponse(description="Suppression réussie"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Filiale non trouvée"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)

    @transaction.atomic
    def perform_update(self, serializer):
        filiale = serializer.save()

        events_status = {
            'filiale_updated': publish_filiale_updated(filiale),
            'booking_sync':    publish_filiale_updated_for_booking(filiale),
        }

        all_sent = all(events_status.values())
        if all_sent:
            logger.info(
                "Filiale mise à jour: %s | RabbitMQ: tous les événements envoyés ✓ | %s",
                filiale.nom, events_status
            )
        else:
            logger.warning(
                "Filiale mise à jour: %s | RabbitMQ: certains événements ont échoué ✗ | %s",
                filiale.nom, events_status
            )

    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.bus.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"error": f"Impossible de supprimer la filiale {instance.nom} car elle possède {instance.bus.count()} bus"}
            )
        instance.delete()
        logger.info(f"Filiale supprimée: {instance.nom}")


class FilialeStatsView(APIView):
    """GET: Statistiques d'une filiale (Public)"""
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Filiales'], summary="Statistiques d'une filiale",
        description="Récupère les statistiques d'une filiale (nombre de bus, voyages, etc.)",
        responses={
            200: OpenApiResponse(description="Statistiques récupérées avec succès"),
            404: OpenApiResponse(description="Filiale non trouvée"),
        }
    )
    def get(self, request, id_filiale):
        filiale = get_object_or_404(Filiale, id_filiale=id_filiale)

        bus_stats = Bus.objects.filter(Id_agence=filiale.agence).aggregate(
            total=Count('IdBus'),
            disponibles=Count('IdBus', filter=Q(etat=StatusBus.DISPONIBLE)),
            en_panne=Count('IdBus',    filter=Q(etat=StatusBus.EN_PANNE)),
            en_voyage=Count('IdBus',   filter=Q(etat=StatusBus.EN_VOYAGE)),
            maintenance=Count('IdBus', filter=Q(etat=StatusBus.MAINTENANCE)),
            capacite_totale=Sum('capacite')
        )

        voyages_stats = Voyage.objects.filter(IdBus__Id_agence=filiale.agence).aggregate(
            total=Count('Id_voyage'),
            programmes=Count('Id_voyage', filter=Q(status=StatusVoyage.PROGRAMME)),
            en_cours=Count('Id_voyage',   filter=Q(status=StatusVoyage.EN_COURS)),
            termines=Count('Id_voyage',   filter=Q(status=StatusVoyage.TERMINE)),
            annules=Count('Id_voyage',    filter=Q(status=StatusVoyage.ANNULE))
        )

        return Response({
            'filiale': {
                'id': filiale.id_filiale,
                'nom': filiale.nom,
                'ville': filiale.ville,
                'est_active': filiale.est_active
            },
            'bus_stats': bus_stats,
            'voyages_stats': voyages_stats,
            'date_calcul': timezone.now()
        })


# ==============================================================================
# BUS
# ==============================================================================

class BusListCreateView(generics.ListCreateAPIView):
    """
    GET:  Liste des bus (Public)
    POST: Ajouter un bus (Manager Local ou supérieur)
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['etat', 'Id_agence']
    search_fields = ['immatriculation', 'modele']
    ordering_fields = ['created_at', 'immatriculation', 'capacite']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerLocal()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Bus.objects.all()
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(Id_agence_id=agence_id)
        etat = self.request.query_params.get('etat')
        if etat:
            queryset = queryset.filter(etat=etat)
        disponible = self.request.query_params.get('disponible')
        if disponible and disponible.lower() == 'true':
            queryset = queryset.filter(etat=StatusBus.DISPONIBLE)

        if hasattr(self.request, 'user_info'):
            role = self.request.user_info.get('role')
            if role == 'MANAGER_LOCAL':
                user_agence_id = self.request.user_info.get('agence_id')
                queryset = queryset.filter(Id_agence_id=user_agence_id)

        return queryset.select_related('Id_agence').order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return BusCreateUpdateSerializer
        return BusListSerializer

    @extend_schema(
        tags=['Bus'], summary="Liste des bus",
        description="Récupère la liste des bus (accès public). Possibilité de filtrer par agence ou par état.",
        parameters=[
            OpenApiParameter(name='agence_id', description="ID de l'agence",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='etat', description="Filtrer par état (disponible, en_panne, maintenance, en_voyage)",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='disponible', description="Filtrer les bus disponibles (true/false)",
                             required=False, type=bool, location=OpenApiParameter.QUERY)
        ],
        responses={200: BusListSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Bus'], summary="Ajouter un bus",
        description="Ajoute un nouveau bus (nécessite droits Manager Local)",
        request=BusCreateUpdateSerializer,
        examples=[
            OpenApiExample(
                "Exemple d'ajout",
                value={'immatriculation': 'LT 001 AB', 'modele': 'Toyota Coaster',
                       'capacite': 30, 'etat': 'disponible', 'Id_agence': 'uuid-de-l-agence'},
                request_only=True,
            ),
            OpenApiExample(
                'Exemple de réponse',
                value={'IdBus': 1, 'immatriculation': 'LT 001 AB', 'modele': 'Toyota Coaster',
                       'capacite': 30, 'etat': 'disponible', 'Id_agence': 'uuid-de-l-agence'},
                response_only=True,
            )
        ],
        responses={
            201: BusDetailSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Local requis"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        bus = serializer.save()
        event_sent = publish_bus_updated_for_booking(bus)
        if event_sent:
            logger.info("Bus créé: %s | RabbitMQ: booking_sync ✓", bus.immatriculation)
        else:
            logger.warning("Bus créé: %s | RabbitMQ: booking_sync ✗", bus.immatriculation)


class BusRetrieveUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET:        Détail bus (Public)
    PUT/PATCH:  Modifier bus (Manager Local ou supérieur)
    DELETE:     Supprimer bus (Manager Local ou supérieur)
    """
    queryset = Bus.objects.all()
    lookup_field = 'IdBus'

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerLocal()]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return BusCreateUpdateSerializer
        return BusDetailSerializer

    @extend_schema(
        tags=['Bus'], summary="Détail d'un bus",
        description="Récupère les détails d'un bus spécifique (accès public)",
        responses={200: BusDetailSerializer, 404: OpenApiResponse(description="Bus non trouvé")},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Bus'], summary="Modifier un bus",
        description="Modifie un bus existant (nécessite droits Manager Local)",
        request=BusCreateUpdateSerializer,
        responses={
            200: BusDetailSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Bus non trouvé"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        tags=['Bus'], summary="Supprimer un bus",
        description="Supprime un bus (nécessite droits Manager Local). Le bus ne doit pas être en voyage.",
        responses={
            204: OpenApiResponse(description="Suppression réussie"),
            400: OpenApiResponse(description="Impossible de supprimer un bus en voyage"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Bus non trouvé"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)

    def perform_update(self, serializer):
        bus = serializer.save()
        event_sent = publish_bus_updated_for_booking(bus)
        if event_sent:
            logger.info("Bus mis à jour: %s | RabbitMQ: booking_sync ✓", bus.immatriculation)
        else:
            logger.warning("Bus mis à jour: %s | RabbitMQ: booking_sync ✗", bus.immatriculation)

    def perform_destroy(self, instance):
        if instance.etat == StatusBus.EN_VOYAGE:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "Impossible de supprimer un bus en voyage"})
        instance.delete()
        logger.info(f"Bus supprimé: {instance.immatriculation}")


class BusStatusUpdateView(APIView):
    """PUT: Changer l'état d'un bus (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]

    @extend_schema(
        tags=['Bus'], summary="Changer l'état d'un bus",
        description="Modifie l'état d'un bus (disponible, en_panne, maintenance, en_voyage)",
        request={
            'type': 'object',
            'properties': {
                'etat':   {'type': 'string', 'enum': ['disponible', 'en_panne', 'maintenance', 'en_voyage'],
                           'description': 'Nouvel état du bus'},
                'raison': {'type': 'string', 'description': 'Raison du changement (optionnel)'}
            },
            'required': ['etat']
        },
        examples=[
            OpenApiExample('Exemple - Mise en panne',      value={'etat': 'en_panne',    'raison': 'Panne moteur'}),
            OpenApiExample('Exemple - Mise en maintenance', value={'etat': 'maintenance', 'raison': 'Révision périodique'}),
            OpenApiExample('Exemple - Remise en service',  value={'etat': 'disponible',  'raison': 'Réparation terminée'}),
        ],
        responses={
            200: OpenApiResponse(description="État modifié avec succès"),
            400: OpenApiResponse(description="État invalide"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Bus non trouvé"),
        }
    )
    def put(self, request, IdBus):
        bus          = get_object_or_404(Bus, IdBus=IdBus)
        ancien_etat  = bus.etat
        nouveau_etat = request.data.get('etat')
        raison       = request.data.get('raison', '')

        if not nouveau_etat or nouveau_etat not in dict(StatusBus.choices):
            return Response({"error": "État invalide"}, status=status.HTTP_400_BAD_REQUEST)

        if ancien_etat == nouveau_etat:
            return Response({"message": f"Le bus est déjà en état {nouveau_etat}"}, status=status.HTTP_200_OK)

        bus.etat = nouveau_etat
        bus.save()

        events_status = {
            'bus_status_changed': publish_bus_status_changed(bus, ancien_etat, nouveau_etat, raison),
            'booking_sync':       publish_bus_updated_for_booking(bus),
        }

        if nouveau_etat == StatusBus.EN_PANNE:
            events_status['bus_breakdown'] = publish_bus_breakdown(bus, raison)

        all_sent = all(events_status.values())
        if all_sent:
            logger.info(
                "Bus %s: état changé %s → %s | RabbitMQ: tous les événements envoyés ✓ | %s",
                bus.immatriculation, ancien_etat, nouveau_etat, events_status
            )
        else:
            logger.warning(
                "Bus %s: état changé %s → %s | RabbitMQ: certains événements ont échoué ✗ | %s",
                bus.immatriculation, ancien_etat, nouveau_etat, events_status
            )

        return Response({
            "message": f"État du bus changé de {ancien_etat} à {nouveau_etat}",
            "bus": {
                "IdBus": bus.IdBus,
                "immatriculation": bus.immatriculation,
                "etat": bus.etat,
            },
            "_events": {
                **events_status,
                "all_sent": all_sent,
            },
        }, status=status.HTTP_200_OK)


class BusStatsView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Bus'], summary="Statistiques des bus",
        description="Récupère les statistiques globales des bus (total, par état, capacités)",
        parameters=[
            OpenApiParameter(name='agence_id', description="ID de l'agence pour filtrer les statistiques",
                             required=False, type=str, location=OpenApiParameter.QUERY)
        ],
        responses={200: OpenApiResponse(description="Statistiques récupérées avec succès")},
    )
    def get(self, request):
        agence_id = request.query_params.get('agence_id')
        queryset  = Bus.objects.filter(Id_agence_id=agence_id) if agence_id else Bus.objects.all()

        stats = {
            'total_bus': queryset.count(),
            'par_etat':  queryset.values('etat').annotate(count=Count('IdBus')).order_by('etat'),
            'capacite_totale':  queryset.aggregate(total=Sum('capacite'))['total'] or 0,
            'capacite_moyenne': queryset.aggregate(moyenne=Avg('capacite'))['moyenne'] or 0,
        }
        for item in stats['par_etat']:
            item['etat_label'] = dict(StatusBus.choices).get(item['etat'], item['etat'])

        return Response(stats)


class BusDisponiblesListView(generics.ListAPIView):
    serializer_class   = BusListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset  = Bus.objects.filter(etat=StatusBus.DISPONIBLE)
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(Id_agence_id=agence_id)
        return queryset.select_related('Id_agence').order_by('-created_at')

    @extend_schema(
        tags=['Bus'], summary="Bus disponibles",
        description="Liste des bus actuellement disponibles",
        parameters=[
            OpenApiParameter(name='agence_id', description="ID de l'agence pour filtrer",
                             required=False, type=str, location=OpenApiParameter.QUERY)
        ],
        responses={200: BusListSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


# ==============================================================================
# CHAUFFEURS
# ==============================================================================

class ChauffeurListCreateView(generics.ListCreateAPIView):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['est_disponible', 'Id_agence']
    search_fields    = ['name', 'surname', 'email', 'numero_permis']
    ordering_fields  = ['name', 'date_embauche']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerLocal()]
        return [AllowAny()]

    def get_queryset(self):
        queryset  = Chauffeur.objects.all()
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(Id_agence_id=agence_id)
        disponible = self.request.query_params.get('disponible')
        if disponible and disponible.lower() == 'true':
            queryset = queryset.filter(est_disponible=True)

        if hasattr(self.request, 'user_info'):
            role = self.request.user_info.get('role')
            if role == 'MANAGER_LOCAL':
                user_agence_id = self.request.user_info.get('agenceId')
                queryset = queryset.filter(Id_agence_id=user_agence_id)

        return queryset.select_related('Id_agence').order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ChauffeurSerializer
        return ChauffeurListSerializer

    @extend_schema(
        tags=['Chauffeurs'], summary="Liste des chauffeurs",
        description="Récupère la liste des chauffeurs (accès public)",
        parameters=[
            OpenApiParameter(name='agence_id', description="ID de l'agence",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='disponible', description="Filtrer les chauffeurs disponibles",
                             required=False, type=bool, location=OpenApiParameter.QUERY)
        ],
        responses={200: ChauffeurListSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Chauffeurs'], summary="Créer un chauffeur",
        description="Crée un nouveau chauffeur (nécessite droits Manager Local)",
        request=ChauffeurSerializer,
        examples=[
            OpenApiExample(
                'Exemple de création',
                value={
                    'numero_permis': 'P12345678', 'name': 'Pierre', 'surname': 'Kamga',
                    'email': 'pierre.kamga@express.cm', 'phone': '699555555',
                    'Adresse': 'Quartier Makepe, Douala', 'date_embauche': '2024-01-15',
                    'Id_agence': 'uuid-de-l-agence', 'est_disponible': True
                },
                request_only=True,
            )
        ],
        responses={
            201: ChauffeurSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Local requis"),
            409: OpenApiResponse(description="Numéro de permis ou email déjà utilisé"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        chauffeur = serializer.save()
        event_sent = publish_staff_created(
            user_id=chauffeur.id_chauffeur,
            role='CHAUFFEUR',
            agence_id=chauffeur.Id_agence.id_agence
        )
        if event_sent:
            logger.info(
                "Chauffeur créé: %s %s | RabbitMQ: staff_created ✓",
                chauffeur.name, chauffeur.surname
            )
        else:
            logger.warning(
                "Chauffeur créé: %s %s | RabbitMQ: staff_created ✗",
                chauffeur.name, chauffeur.surname
            )


class ChauffeurDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail chauffeur | PUT: Modifier | DELETE: Supprimer (Manager Local ou supérieur)"""
    queryset     = Chauffeur.objects.all()
    lookup_field = 'id_chauffeur'
    serializer_class = ChauffeurSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerLocal()]

    @extend_schema(
        tags=['Chauffeurs'], summary="Détail d'un chauffeur",
        description="Récupère les détails d'un chauffeur spécifique (accès public)",
        responses={200: ChauffeurSerializer, 404: OpenApiResponse(description="Chauffeur non trouvé")},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Chauffeurs'], summary="Modifier un chauffeur",
        description="Modifie un chauffeur existant (nécessite droits Manager Local)",
        request=ChauffeurSerializer,
        responses={
            200: ChauffeurSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Chauffeur non trouvé"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        tags=['Chauffeurs'], summary="Supprimer un chauffeur",
        description="Supprime un chauffeur (nécessite droits Manager Local). Le chauffeur ne doit pas avoir de voyages programmés.",
        responses={
            204: OpenApiResponse(description="Suppression réussie"),
            400: OpenApiResponse(description="Impossible de supprimer - des voyages sont associés"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Chauffeur non trouvé"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if instance.voyages.filter(status__in=[StatusVoyage.PROGRAMME, StatusVoyage.EN_COURS]).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"error": "Impossible de supprimer un chauffeur avec des voyages programmés ou en cours"}
            )
        instance.delete()
        logger.info(f"Chauffeur supprimé: {instance.name} {instance.surname}")


class ChauffeurStatusUpdateView(APIView):
    """PUT: Changer la disponibilité d'un chauffeur (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]

    @extend_schema(
        tags=['Chauffeurs'], summary="Changer la disponibilité d'un chauffeur",
        description="Modifie la disponibilité d'un chauffeur (disponible/indisponible)",
        request={
            'type': 'object',
            'properties': {
                'est_disponible': {'type': 'boolean', 'description': 'True = disponible, False = indisponible'}
            },
            'required': ['est_disponible']
        },
        examples=[
            OpenApiExample('Exemple - Rendre indisponible', value={'est_disponible': False}),
            OpenApiExample('Exemple - Rendre disponible',   value={'est_disponible': True}),
        ],
        responses={
            200: OpenApiResponse(description="Disponibilité modifiée avec succès"),
            400: OpenApiResponse(description="Champ est_disponible requis"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Chauffeur non trouvé"),
        }
    )
    def put(self, request, id_chauffeur):
        chauffeur      = get_object_or_404(Chauffeur, id_chauffeur=id_chauffeur)
        est_disponible = request.data.get('est_disponible')

        if est_disponible is None:
            return Response({"error": "Le champ est_disponible est requis"}, status=status.HTTP_400_BAD_REQUEST)

        chauffeur.est_disponible = est_disponible
        chauffeur.save()

        return Response({
            "message": "Disponibilité du chauffeur changée",
            "chauffeur": {
                "id": chauffeur.id_chauffeur,
                "nom": f"{chauffeur.name} {chauffeur.surname}",
                "est_disponible": chauffeur.est_disponible
            }
        }, status=status.HTTP_200_OK)


# ==============================================================================
# GUICHETIERS
# ==============================================================================

class GuichetierListCreateView(generics.ListCreateAPIView):
    """GET: Liste des guichetiers | POST: Ajouter un guichetier (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields   = ['est_actif', '_id_filiale']
    search_fields      = ['name', 'surname', 'email', 'phone']
    ordering_fields    = ['name', 'created_at']

    def get_queryset(self):
        queryset   = Guichetier.objects.all()
        filiale_id = self.request.query_params.get('filiale_id')
        if filiale_id:
            queryset = queryset.filter(_id_filiale_id=filiale_id)
        actif = self.request.query_params.get('actif')
        if actif and actif.lower() == 'true':
            queryset = queryset.filter(est_actif=True)

        if hasattr(self.request, 'user_info'):
            role = self.request.user_info.get('role')
            if role == 'MANAGER_LOCAL':
                user_filiale_id = self.request.user_info.get('filiale_id')
                queryset = queryset.filter(_id_filiale_id=user_filiale_id)

        return queryset.select_related('_id_filiale').order_by('-created_at')

    def get_serializer_class(self):
        return GuichetierSerializer

    @extend_schema(
        tags=['Guichetiers'], summary="Liste des guichetiers",
        description="Récupère la liste des guichetiers (nécessite droits Manager Local)",
        parameters=[
            OpenApiParameter(name='filiale_id', description="ID de la filiale",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='actif', description="Filtrer les guichetiers actifs",
                             required=False, type=bool, location=OpenApiParameter.QUERY)
        ],
        responses={200: GuichetierSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Guichetiers'], summary="Créer un guichetier",
        description="Crée un nouveau guichetier (nécessite droits Manager Local)",
        request=GuichetierSerializer,
        examples=[
            OpenApiExample(
                'Exemple de création',
                value={
                    'name': 'Marie', 'surname': 'Essonba', 'email': 'marie.essonba@express.cm',
                    'phone': '699444444', 'adresse': 'Rue 123, Douala', 'password': 'TempPass123',
                    'est_actif': True, '_id_filiale': 'uuid-de-la-filiale'
                },
                request_only=True,
            )
        ],
        responses={
            201: GuichetierSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Local requis"),
            409: OpenApiResponse(description="Email déjà utilisé"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        guichetier = serializer.save()
        event_sent = publish_staff_created(
            user_id=guichetier.Id_guichetier,
            role='GUICHETIER',
            filiale_id=guichetier._id_filiale.id_filiale if guichetier._id_filiale else None
        )
        if event_sent:
            logger.info(
                "Guichetier créé: %s %s | RabbitMQ: staff_created ✓",
                guichetier.name, guichetier.surname
            )
        else:
            logger.warning(
                "Guichetier créé: %s %s | RabbitMQ: staff_created ✗",
                guichetier.name, guichetier.surname
            )


class GuichetierDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail guichetier | PUT: Modifier | DELETE: Supprimer (Manager Local ou supérieur)"""
    queryset         = Guichetier.objects.all()
    lookup_field     = 'Id_guichetier'
    serializer_class = GuichetierSerializer
    permission_classes = [IsManagerLocal]

    @extend_schema(
        tags=['Guichetiers'], summary="Détail d'un guichetier",
        description="Récupère les détails d'un guichetier spécifique",
        responses={200: GuichetierSerializer, 404: OpenApiResponse(description="Guichetier non trouvé")},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Guichetiers'], summary="Modifier un guichetier",
        description="Modifie un guichetier existant",
        request=GuichetierSerializer,
        responses={
            200: GuichetierSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Guichetier non trouvé"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        tags=['Guichetiers'], summary="Supprimer un guichetier",
        description="Supprime un guichetier",
        responses={
            204: OpenApiResponse(description="Suppression réussie"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Guichetier non trouvé"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)

    def perform_destroy(self, instance):
        instance.delete()
        logger.info(f"Guichetier supprimé: {instance.name} {instance.surname}")


# ==============================================================================
# TRAJETS
# ==============================================================================

class TrajetListCreateView(generics.ListCreateAPIView):
    """GET: Liste des trajets | POST: Créer un trajet (Manager Global ou Admin)"""
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['est_actif', 'filiale_depart', 'filiale_arrive']
    search_fields    = ['filiale_depart__nom', 'filiale_arrive__nom']
    ordering_fields  = ['distance', 'created_at']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerGlobal()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Trajet.objects.all()
        depart   = self.request.query_params.get('depart')
        if depart:
            queryset = queryset.filter(filiale_depart__ville=depart)
        arrivee  = self.request.query_params.get('arrivee')
        if arrivee:
            queryset = queryset.filter(filiale_arrive__ville=arrivee)
        return queryset.select_related('filiale_depart', 'filiale_arrive').order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TrajetSerializer
        return TrajetListSerializer

    @extend_schema(
        tags=['Trajets'], summary="Liste des trajets",
        description="Récupère la liste des trajets (accès public)",
        parameters=[
            OpenApiParameter(name='depart',  description="Filtrer par ville de départ",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='arrivee', description="Filtrer par ville d'arrivée",
                             required=False, type=str, location=OpenApiParameter.QUERY)
        ],
        responses={200: TrajetListSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Trajets'], summary="Créer un trajet",
        description="Crée un nouveau trajet entre deux filiales (nécessite droits Manager Global)",
        request=TrajetSerializer,
        examples=[
            OpenApiExample(
                'Exemple de création',
                value={'filiale_depart': 'uuid-filiale-depart', 'filiale_arrive': 'uuid-filiale-arrivee',
                       'distance': 250.5, 'est_actif': True},
                request_only=True,
            )
        ],
        responses={
            201: TrajetSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Global requis"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        trajet = serializer.save()
        logger.info(f"Trajet créé: {trajet}")


class TrajetDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail trajet | PUT: Modifier | DELETE: Supprimer (Manager Global ou Admin)"""
    queryset         = Trajet.objects.all()
    lookup_field     = 'Id_trajet'
    serializer_class = TrajetSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerGlobal()]

    @extend_schema(
        tags=['Trajets'], summary="Détail d'un trajet",
        description="Récupère les détails d'un trajet spécifique (accès public)",
        responses={200: TrajetSerializer, 404: OpenApiResponse(description="Trajet non trouvé")},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Trajets'], summary="Modifier un trajet",
        description="Modifie un trajet existant (nécessite droits Manager Global)",
        request=TrajetSerializer,
        responses={
            200: TrajetSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Trajet non trouvé"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        tags=['Trajets'], summary="Supprimer un trajet",
        description="Supprime un trajet (nécessite droits Manager Global). Le trajet ne doit pas avoir de voyages associés.",
        responses={
            204: OpenApiResponse(description="Suppression réussie"),
            400: OpenApiResponse(description="Impossible de supprimer - des voyages sont associés"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Trajet non trouvé"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if instance.voyages.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                {"error": f"Impossible de supprimer le trajet {instance} car il a {instance.voyages.count()} voyages associés"}
            )
        instance.delete()
        logger.info(f"Trajet supprimé: {instance}")


# ==============================================================================
# VOYAGES
# ==============================================================================

class VoyageListCreateView(generics.ListCreateAPIView):
    """
    GET:  Liste des voyages (Public)
    POST: Programmer un voyage (Manager Local ou supérieur)
    """
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'type_voyage', 'Id_trajet', 'IdBus']
    search_fields    = ['Id_trajet__filiale_depart__nom', 'Id_trajet__filiale_arrive__nom']
    ordering_fields  = ['date_heure_depart', 'prix', 'created_at']
 
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerLocal()]
        return [AllowAny()]
 
    def get_queryset(self):
        queryset = Voyage.objects.all()
        date_debut = self.request.query_params.get('date_debut')
        if date_debut:
            queryset = queryset.filter(date_heure_depart__gte=date_debut)
        date_fin = self.request.query_params.get('date_fin')
        if date_fin:
            queryset = queryset.filter(date_heure_depart__lte=date_fin)
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(IdBus__Id_agence_id=agence_id)
 
        # FIX : select_related étendu aux relations profondes pour que
        # VoyageListSerializer.get_codeAgence() et get_codeFiliale()
        # puissent accéder à IdBus.Id_agence.name et
        # Id_trajet.filiale_depart.code sans requêtes N+1 ni None.
        return queryset.select_related(
            'Id_trajet__filiale_depart',
            'Id_trajet__filiale_arrive',
            'IdBus__Id_agence',
            'id_chauffeur',
        ).order_by('date_heure_depart')
 
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return VoyageCreateUpdateSerializer
        return VoyageListSerializer
 
    @extend_schema(
        tags=['Voyages'], summary="Liste des voyages",
        description="Récupère la liste des voyages (accès public). Possibilité de filtrer par dates, statut, etc.",
        parameters=[
            OpenApiParameter(name='date_debut', description="Date de début (YYYY-MM-DD)",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='date_fin',   description="Date de fin (YYYY-MM-DD)",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='agence_id',  description="ID de l'agence",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='status',
                             description="Statut du voyage (programme, confirme, en_cours, termine, annule, retarde)",
                             required=False, type=str, location=OpenApiParameter.QUERY)
        ],
        responses={200: VoyageListSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
 
    @extend_schema(
        tags=['Voyages'], summary="Programmer un voyage",
        description="Programme un nouveau voyage (nécessite droits Manager Local)",
        request=VoyageCreateUpdateSerializer,
        examples=[
            OpenApiExample(
                'Exemple de création',
                value={
                    'date_heure_depart': '2026-04-10T10:00:00',
                    'date_heure_arrive_prevue': '2026-04-10T15:00:00',
                    'prix': 5000, 'type_voyage': 'standard', 'status': 'programme',
                    'places_disponibles': 30, 'places_total_reservees': 0,
                    'Id_trajet': 'uuid-du-trajet', 'IdBus': 1, 'id_chauffeur': 'uuid-du-chauffeur'
                },
                request_only=True,
            )
        ],
        responses={
            201: VoyageSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Local requis"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)
 
    @transaction.atomic
    def perform_create(self, serializer):
        voyage = serializer.save()
 
        if voyage.id_chauffeur:
            chauffeur = voyage.id_chauffeur
            if chauffeur.est_disponible:
                chauffeur.est_disponible = False
                chauffeur.save()
                logger.info(
                    "Chauffeur %s %s marqué indisponible (assigné au voyage %s)",
                    chauffeur.name, chauffeur.surname, voyage.Id_voyage
                )
 
        bus = voyage.IdBus
        bus.etat = StatusBus.EN_VOYAGE
        bus.save()
 
        events_status = {
            'bus_updated':    publish_bus_updated_for_booking(bus),
            'voyage_updated': publish_voyage_updated_for_booking(voyage),
        }
 
        all_sent = all(events_status.values())
        if all_sent:
            logger.info(
                "Voyage programmé: %s | RabbitMQ: tous les événements envoyés ✓ | %s",
                voyage, events_status
            )
        else:
            logger.warning(
                "Voyage programmé: %s | RabbitMQ: certains événements ont échoué ✗ | %s",
                voyage, events_status
            )
 
 


class VoyageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET:        Détail voyage (Public)
    PUT/PATCH:  Modifier voyage (Manager Local ou supérieur)
    DELETE:     Supprimer voyage (Manager Local ou supérieur)
    """
    queryset         = Voyage.objects.all()
    lookup_field     = 'Id_voyage'
    serializer_class = VoyageSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerLocal()]

    @extend_schema(
        tags=['Voyages'], summary="Détail d'un voyage",
        description="Récupère les détails d'un voyage spécifique (accès public)",
        responses={200: VoyageSerializer, 404: OpenApiResponse(description="Voyage non trouvé")},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Voyages'], summary="Modifier un voyage",
        description="Modifie un voyage existant (nécessite droits Manager Local)",
        request=VoyageCreateUpdateSerializer,
        responses={
            200: VoyageSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Voyage non trouvé"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        tags=['Voyages'], summary="Supprimer un voyage",
        description="Supprime un voyage (nécessite droits Manager Local). Le voyage ne doit pas être en cours.",
        responses={
            204: OpenApiResponse(description="Suppression réussie"),
            400: OpenApiResponse(description="Impossible de supprimer un voyage en cours"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Voyage non trouvé"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)

    @transaction.atomic
    def perform_update(self, serializer):
        # ✅ Capturer l'ancien chauffeur AVANT la sauvegarde
        ancien_chauffeur = self.get_object().id_chauffeur

        voyage = serializer.save()

        # ✅ Gérer le changement de chauffeur
        nouveau_chauffeur = voyage.id_chauffeur

        if ancien_chauffeur != nouveau_chauffeur:
            # Libérer l'ancien chauffeur s'il existait
            if ancien_chauffeur:
                ancien_chauffeur.est_disponible = True
                ancien_chauffeur.save()
                logger.info(
                    "Ancien chauffeur %s %s libéré (retiré du voyage %s)",
                    ancien_chauffeur.name, ancien_chauffeur.surname, voyage.Id_voyage
                )

            # Bloquer le nouveau chauffeur s'il y en a un
            if nouveau_chauffeur:
                nouveau_chauffeur.est_disponible = False
                nouveau_chauffeur.save()
                logger.info(
                    "Nouveau chauffeur %s %s marqué indisponible (assigné au voyage %s)",
                    nouveau_chauffeur.name, nouveau_chauffeur.surname, voyage.Id_voyage
                )

        event_sent = publish_voyage_updated_for_booking(voyage)
        if event_sent:
            logger.info("Voyage mis à jour: %s | RabbitMQ: voyage_updated ✓", voyage)
        else:
            logger.warning("Voyage mis à jour: %s | RabbitMQ: voyage_updated ✗", voyage)

    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.status == StatusVoyage.EN_COURS:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "Impossible de supprimer un voyage en cours"})

        # ✅ Libérer le chauffeur lors de la suppression du voyage
        if instance.id_chauffeur:
            chauffeur = instance.id_chauffeur
            chauffeur.est_disponible = True
            chauffeur.save()
            logger.info(
                "Chauffeur %s %s libéré (voyage %s supprimé)",
                chauffeur.name, chauffeur.surname, instance.Id_voyage
            )

        bus = instance.IdBus
        bus.etat = StatusBus.DISPONIBLE
        bus.save()

        event_sent = publish_bus_updated_for_booking(bus)
        if event_sent:
            logger.info("Voyage supprimé: %s | RabbitMQ: bus_updated (libéré) ✓", instance)
        else:
            logger.warning("Voyage supprimé: %s | RabbitMQ: bus_updated (libéré) ✗", instance)

        instance.delete()


class VoyageStatusUpdateView(APIView):
    """PUT: Changer le statut d'un voyage (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]

    @extend_schema(
        tags=['Voyages'], summary="Changer le statut d'un voyage",
        description="Modifie le statut d'un voyage (programme, confirme, en_cours, termine, annule, retarde)",
        request={
            'type': 'object',
            'properties': {
                'status': {
                    'type': 'string',
                    'enum': ['programme', 'confirme', 'en_cours', 'termine', 'annule', 'retarde'],
                    'description': 'Nouveau statut du voyage'
                },
                'motif': {'type': 'string', 'description': "Motif (obligatoire pour l'annulation)"}
            },
            'required': ['status']
        },
        examples=[
            OpenApiExample('Exemple - Annulation', value={'status': 'annule', 'motif': 'Problème technique'}),
            OpenApiExample('Exemple - Retard',     value={'status': 'retarde'}),
            OpenApiExample('Exemple - Départ',     value={'status': 'en_cours'}),
            OpenApiExample('Exemple - Terminé',    value={'status': 'termine'}),
        ],
        responses={
            200: OpenApiResponse(description="Statut modifié avec succès"),
            400: OpenApiResponse(description="Statut invalide"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Local requis"),
            404: OpenApiResponse(description="Voyage non trouvé"),
        }
    )
    @transaction.atomic
    def put(self, request, Id_voyage):
        voyage         = get_object_or_404(Voyage, Id_voyage=Id_voyage)
        ancien_status  = voyage.status
        nouveau_status = request.data.get('status')
        motif          = request.data.get('motif', '')

        if not nouveau_status or nouveau_status not in dict(StatusVoyage.choices):
            return Response({"error": "Statut invalide"}, status=status.HTTP_400_BAD_REQUEST)

        if ancien_status == nouveau_status:
            return Response({"message": f"Le voyage est déjà en statut {nouveau_status}"}, status=status.HTTP_200_OK)

        voyage.status = nouveau_status
        voyage.save()

        events_status = {}

        # ── Notifications métier spécifiques ──────────────────────────
        if nouveau_status == StatusVoyage.ANNULE:
            voyage.motif_annulation = motif
            voyage.save()
            events_status['voyage_cancelled'] = publish_voyage_cancelled(voyage, motif)

            if voyage.IdBus:
                bus = voyage.IdBus
                bus.etat = StatusBus.DISPONIBLE
                bus.save()
                events_status['bus_updated'] = publish_bus_updated_for_booking(bus)

            if voyage.id_chauffeur:
                chauffeur = voyage.id_chauffeur
                chauffeur.est_disponible = True
                chauffeur.save()

        elif nouveau_status == StatusVoyage.RETARDE:
            events_status['voyage_delayed'] = publish_voyage_delayed(voyage, voyage.date_heure_depart)

        elif nouveau_status == StatusVoyage.EN_COURS:
            events_status['voyage_departed'] = publish_voyage_departed(voyage)

        elif nouveau_status == StatusVoyage.TERMINE:
            if voyage.IdBus:
                bus = voyage.IdBus
                bus.etat = StatusBus.DISPONIBLE
                bus.save()
                events_status['bus_updated'] = publish_bus_updated_for_booking(bus)

            if voyage.id_chauffeur:
                chauffeur = voyage.id_chauffeur
                chauffeur.est_disponible = True
                chauffeur.save()

        # ── Projection booking (tous les changements de statut) ───────
        events_status['voyage_updated'] = publish_voyage_updated_for_booking(voyage)

        all_sent = all(events_status.values())
        if all_sent:
            logger.info(
                "Voyage %s: statut %s → %s | RabbitMQ: tous les événements envoyés ✓ | %s",
                voyage.Id_voyage, ancien_status, nouveau_status, events_status
            )
        else:
            logger.warning(
                "Voyage %s: statut %s → %s | RabbitMQ: certains événements ont échoué ✗ | %s",
                voyage.Id_voyage, ancien_status, nouveau_status, events_status
            )

        return Response({
            "message": f"Statut du voyage changé de {ancien_status} à {nouveau_status}",
            "voyage":  {"Id_voyage": voyage.Id_voyage, "status": voyage.status},
            "_events": {
                **events_status,
                "all_sent": all_sent,
            },
        }, status=status.HTTP_200_OK)


class VoyageSearchView(generics.ListAPIView):
    """GET: Recherche de voyages disponibles (Public)"""
    serializer_class   = VoyageListSerializer
    permission_classes = [AllowAny]
 
    def get_queryset(self):
        depart  = self.request.query_params.get('depart')
        arrivee = self.request.query_params.get('arrivee')
        date    = self.request.query_params.get('date')
 
        queryset = Voyage.objects.filter(
            status=StatusVoyage.PROGRAMME,
            places_disponibles__gt=0,
            date_heure_depart__gte=timezone.now()
        )
        if depart:
            queryset = queryset.filter(Id_trajet__filiale_depart__ville=depart)
        if arrivee:
            queryset = queryset.filter(Id_trajet__filiale_arrive__ville=arrivee)
        if date:
            queryset = queryset.filter(date_heure_depart__date=date)
 
        # FIX : select_related étendu aux relations profondes pour que
        # VoyageListSerializer.get_codeAgence() et get_codeFiliale()
        # puissent accéder à IdBus.Id_agence.name et
        # Id_trajet.filiale_depart.code sans requêtes N+1 ni None.
        return queryset.select_related(
            'Id_trajet__filiale_depart',
            'Id_trajet__filiale_arrive',
            'IdBus__Id_agence',
            'id_chauffeur',
        ).order_by('date_heure_depart')
 
    @extend_schema(
        tags=['Voyages'], summary="Rechercher des voyages",
        description="Recherche des voyages disponibles pour une ville de départ, d'arrivée et une date (accès public)",
        parameters=[
            OpenApiParameter(name='depart',  description="Ville de départ",  required=True,  type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='arrivee', description="Ville d'arrivée",  required=True,  type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='date',    description="Date de départ (format: YYYY-MM-DD)", required=False, type=str, location=OpenApiParameter.QUERY)
        ],
        responses={200: VoyageListSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

# ==============================================================================
# ANNONCES
# ==============================================================================

class AnnonceListCreateView(generics.ListCreateAPIView):
    """
    GET:  Liste des annonces (Public)
    POST: Publier une annonce (Manager Local ou supérieur)
    """
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'Id_voyage']
    search_fields    = ['message']
    ordering_fields  = ['datePublication', 'created_at']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerLocal()]
        return [AllowAny()]

    def get_queryset(self):
        queryset  = Annonce.objects.all()
        voyage_id = self.request.query_params.get('voyage_id')
        if voyage_id:
            queryset = queryset.filter(Id_voyage_id=voyage_id)
        return queryset.select_related('Id_voyage').order_by('-datePublication')

    def get_serializer_class(self):
        return AnnonceSerializer

    @extend_schema(
        tags=['Annonces'], summary="Liste des annonces",
        description="Récupère la liste des annonces (accès public)",
        parameters=[
            OpenApiParameter(name='voyage_id', description="ID du voyage pour filtrer les annonces",
                             required=False, type=str, location=OpenApiParameter.QUERY)
        ],
        responses={200: AnnonceSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Annonces'], summary="Publier une annonce",
        description="Publie une annonce pour un voyage (nécessite droits Manager Local)",
        request=AnnonceSerializer,
        examples=[
            OpenApiExample(
                'Exemple de publication',
                value={'type': 'information', 'message': 'Le voyage est maintenu malgré la pluie',
                       'Id_voyage': 'uuid-du-voyage', 'est_active': True},
                request_only=True,
            )
        ],
        responses={
            201: AnnonceSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Local requis"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        annonce = serializer.save()
        event_sent = publish_annonce_published(annonce)
        if event_sent:
            logger.info(
                "Annonce publiée: %s pour voyage %s | RabbitMQ: annonce_published ✓",
                annonce.get_type_display(), annonce.Id_voyage
            )
        else:
            logger.warning(
                "Annonce publiée: %s pour voyage %s | RabbitMQ: annonce_published ✗",
                annonce.get_type_display(), annonce.Id_voyage
            )


class AnnonceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET:        Détail annonce (Public)
    PUT/PATCH:  Modifier annonce (Manager Local ou supérieur)
    DELETE:     Supprimer annonce (Manager Local ou supérieur)
    """
    queryset         = Annonce.objects.all()
    lookup_field     = 'id_annonce'
    serializer_class = AnnonceSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerLocal()]

    @extend_schema(
        tags=['Annonces'], summary="Détail d'une annonce",
        description="Récupère les détails d'une annonce spécifique (accès public)",
        responses={200: AnnonceSerializer, 404: OpenApiResponse(description="Annonce non trouvée")},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Annonces'], summary="Modifier une annonce",
        description="Modifie une annonce existante (nécessite droits Manager Local)",
        request=AnnonceSerializer,
        responses={
            200: AnnonceSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Annonce non trouvée"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        tags=['Annonces'], summary="Supprimer une annonce",
        description="Supprime une annonce (nécessite droits Manager Local)",
        responses={
            204: OpenApiResponse(description="Suppression réussie"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants"),
            404: OpenApiResponse(description="Annonce non trouvée"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


# ==============================================================================
# AVIS
# ==============================================================================

class AvisListCreateView(generics.ListCreateAPIView):
    """
    GET:  Liste des avis (Public)
    POST: Laisser un avis (Voyageur uniquement)
    """
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['note', 'Id_voyage']
    search_fields    = ['commentaires']
    ordering_fields  = ['date_avis', 'note']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsVoyageur()]
        return [AllowAny()]

    def get_queryset(self):
        queryset  = Avis.objects.filter(est_approuve=True)
        voyage_id = self.request.query_params.get('voyage_id')
        if voyage_id:
            queryset = queryset.filter(Id_voyage_id=voyage_id)
        note_min = self.request.query_params.get('note_min')
        if note_min:
            queryset = queryset.filter(note__gte=note_min)
        return queryset.select_related('Id_voyage').order_by('-date_avis')

    def get_serializer_class(self):
        return AvisSerializer

    @extend_schema(
        tags=['Avis'], summary="Liste des avis",
        description="Récupère la liste des avis approuvés (accès public)",
        parameters=[
            OpenApiParameter(name='voyage_id', description="ID du voyage pour filtrer les avis",
                             required=False, type=str, location=OpenApiParameter.QUERY),
            OpenApiParameter(name='note_min',  description="Note minimum (1-5)",
                             required=False, type=int, location=OpenApiParameter.QUERY)
        ],
        responses={200: AvisSerializer(many=True)},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Avis'], summary="Laisser un avis",
        description="Laisse un avis sur un voyage (nécessite droits Voyageur)",
        request=AvisSerializer,
        examples=[
            OpenApiExample(
                "Exemple d'avis",
                value={'note': 5, 'commentaires': 'Excellent voyage, très confortable!',
                       'Id_voyage': 'uuid-du-voyage', 'user_id': 'uuid-de-l-utilisateur', 'est_approuve': True},
                request_only=True,
            )
        ],
        responses={
            201: AvisSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Voyageur requis"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        avis = serializer.save()
        logger.info(f"Avis créé: note {avis.note}/5 pour voyage {avis.Id_voyage}")


class AvisDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET:        Détail avis (Public)
    PUT/PATCH:  Modifier avis (Propriétaire ou Admin)
    DELETE:     Supprimer avis (Propriétaire ou Admin)
    """
    queryset         = Avis.objects.all()
    lookup_field     = 'id_avis'
    serializer_class = AvisSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=['Avis'], summary="Détail d'un avis",
        description="Récupère les détails d'un avis spécifique (accès public)",
        responses={200: AvisSerializer, 404: OpenApiResponse(description="Avis non trouvé")},
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        tags=['Avis'], summary="Modifier un avis",
        description="Modifie un avis existant (nécessite droits Propriétaire ou Admin)",
        request=AvisSerializer,
        responses={
            200: AvisSerializer,
            400: OpenApiResponse(description="Données invalides"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Propriétaire requis"),
            404: OpenApiResponse(description="Avis non trouvé"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        tags=['Avis'], summary="Supprimer un avis",
        description="Supprime un avis (nécessite droits Propriétaire ou Admin)",
        responses={
            204: OpenApiResponse(description="Suppression réussie"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Propriétaire requis"),
            404: OpenApiResponse(description="Avis non trouvé"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)

    def perform_update(self, serializer):
        if hasattr(self.request, 'user_info'):
            user_id = self.request.user_info.get('userId')
            avis    = self.get_object()
            role    = self.request.user_info.get('role')
            if str(avis.user_id) != user_id and role != 'ADMINISTRATEUR':
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Vous n'êtes pas autorisé à modifier cet avis")
        serializer.save()
        logger.info(f"Avis modifié: {serializer.instance.id_avis}")

    def perform_destroy(self, instance):
        if hasattr(self.request, 'user_info'):
            user_id = self.request.user_info.get('userId')
            role    = self.request.user_info.get('role')
            if str(instance.user_id) != user_id and role != 'ADMINISTRATEUR':
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Vous n'êtes pas autorisé à supprimer cet avis")
        instance.delete()
        logger.info(f"Avis supprimé: {instance.id_avis}")


class AvisStatsView(APIView):
    """GET: Statistiques des avis pour un voyage (Public)"""
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Avis'], summary="Statistiques des avis",
        description="Récupère les statistiques des avis pour un voyage (note moyenne, répartition des notes)",
        responses={
            200: OpenApiResponse(description="Statistiques récupérées avec succès"),
            404: OpenApiResponse(description="Voyage non trouvé"),
        }
    )
    def get(self, request, Id_voyage):
        voyage = get_object_or_404(Voyage, Id_voyage=Id_voyage)
        avis   = Avis.objects.filter(Id_voyage=voyage, est_approuve=True)

        stats = {
            'voyage':       str(voyage),
            'total_avis':   avis.count(),
            'note_moyenne': avis.aggregate(avg=Avg('note'))['avg'] or 0,
            'repartition':  {
                '5_etoiles': avis.filter(note=5).count(),
                '4_etoiles': avis.filter(note=4).count(),
                '3_etoiles': avis.filter(note=3).count(),
                '2_etoiles': avis.filter(note=2).count(),
                '1_etoile':  avis.filter(note=1).count(),
            }
        }
        return Response(stats)


# ==============================================================================
# ASSIGNATION BUS ET CHAUFFEUR
# ==============================================================================

class VoyageAssignBusView(APIView):
    """POST: Assigner un bus à un voyage (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]

    @extend_schema(
        tags=['Voyages'], summary="Assigner un bus à un voyage",
        description="Assigne un bus disponible à un voyage (nécessite droits Manager Local)",
        request={
            'type': 'object',
            'properties': {'bus_id': {'type': 'integer', 'description': 'ID du bus à assigner'}},
            'required': ['bus_id']
        },
        examples=[OpenApiExample("Exemple d'assignation", value={'bus_id': 1})],
        responses={
            200: OpenApiResponse(description="Bus assigné avec succès"),
            400: OpenApiResponse(description="Bus non disponible ou ID manquant"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Local requis"),
            404: OpenApiResponse(description="Voyage ou bus non trouvé"),
        }
    )
    @transaction.atomic
    def post(self, request, Id_voyage):
        voyage = get_object_or_404(Voyage, Id_voyage=Id_voyage)
        bus_id = request.data.get('bus_id')

        if not bus_id:
            return Response({"error": "bus_id est requis"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bus = Bus.objects.get(IdBus=bus_id)
        except Bus.DoesNotExist:
            return Response({"error": "Bus non trouvé"}, status=status.HTTP_404_NOT_FOUND)

        if bus.etat != StatusBus.DISPONIBLE:
            return Response({"error": "Ce bus n'est pas disponible"}, status=status.HTTP_400_BAD_REQUEST)

        if voyage.status not in [StatusVoyage.PROGRAMME, StatusVoyage.CONFIRME]:
            return Response(
                {"error": "Impossible d'assigner un bus à un voyage déjà en cours ou terminé"},
                status=status.HTTP_400_BAD_REQUEST
            )

        events_status = {}

        # Libérer l'ancien bus si existant
        if voyage.IdBus:
            ancien_bus = voyage.IdBus
            ancien_bus.etat = StatusBus.DISPONIBLE
            ancien_bus.save()
            events_status['ancien_bus_updated'] = publish_bus_updated_for_booking(ancien_bus)

        voyage.IdBus = bus
        voyage.save()

        bus.etat = StatusBus.EN_VOYAGE
        bus.save()

        events_status['nouveau_bus_updated'] = publish_bus_updated_for_booking(bus)
        events_status['voyage_updated']      = publish_voyage_updated_for_booking(voyage)

        all_sent = all(events_status.values())
        if all_sent:
            logger.info(
                "Bus %s assigné au voyage %s | RabbitMQ: tous les événements envoyés ✓ | %s",
                bus.immatriculation, voyage.Id_voyage, events_status
            )
        else:
            logger.warning(
                "Bus %s assigné au voyage %s | RabbitMQ: certains événements ont échoué ✗ | %s",
                bus.immatriculation, voyage.Id_voyage, events_status
            )

        return Response({
            "message": "Bus assigné avec succès",
            "voyage_id": str(voyage.Id_voyage),
            "bus": {"IdBus": bus.IdBus, "immatriculation": bus.immatriculation},
            "_events": {
                **events_status,
                "all_sent": all_sent,
            },
        }, status=status.HTTP_200_OK)


class VoyageAssignChauffeurView(APIView):
    """POST: Assigner un chauffeur à un voyage (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]

    @extend_schema(
        tags=['Voyages'], summary="Assigner un chauffeur à un voyage",
        description="Assigne un chauffeur disponible à un voyage (nécessite droits Manager Local)",
        request={
            'type': 'object',
            'properties': {
                'chauffeur_id': {'type': 'string', 'format': 'uuid', 'description': 'UUID du chauffeur à assigner'}
            },
            'required': ['chauffeur_id']
        },
        examples=[OpenApiExample("Exemple d'assignation", value={'chauffeur_id': 'uuid-du-chauffeur'})],
        responses={
            200: OpenApiResponse(description="Chauffeur assigné avec succès"),
            400: OpenApiResponse(description="Chauffeur non disponible ou ID manquant"),
            401: OpenApiResponse(description="Non authentifié"),
            403: OpenApiResponse(description="Droits insuffisants - Manager Local requis"),
            404: OpenApiResponse(description="Voyage ou chauffeur non trouvé"),
        }
    )
    @transaction.atomic
    def post(self, request, Id_voyage):
        voyage       = get_object_or_404(Voyage, Id_voyage=Id_voyage)
        chauffeur_id = request.data.get('chauffeur_id')

        if not chauffeur_id:
            return Response({"error": "chauffeur_id est requis"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            chauffeur = Chauffeur.objects.get(id_chauffeur=chauffeur_id)
        except Chauffeur.DoesNotExist:
            return Response({"error": "Chauffeur non trouvé"}, status=status.HTTP_404_NOT_FOUND)

        if not chauffeur.est_disponible:
            return Response({"error": "Ce chauffeur n'est pas disponible"}, status=status.HTTP_400_BAD_REQUEST)

        if voyage.status not in [StatusVoyage.PROGRAMME, StatusVoyage.CONFIRME]:
            return Response(
                {"error": "Impossible d'assigner un chauffeur à un voyage déjà en cours ou terminé"},
                status=status.HTTP_400_BAD_REQUEST
            )

        voyage.id_chauffeur = chauffeur
        voyage.save()

        chauffeur.est_disponible = False
        chauffeur.save()

        event_sent = publish_voyage_updated_for_booking(voyage)
        if event_sent:
            logger.info(
                "Chauffeur %s %s assigné au voyage %s | RabbitMQ: voyage_updated ✓",
                chauffeur.name, chauffeur.surname, voyage.Id_voyage
            )
        else:
            logger.warning(
                "Chauffeur %s %s assigné au voyage %s | RabbitMQ: voyage_updated ✗",
                chauffeur.name, chauffeur.surname, voyage.Id_voyage
            )

        return Response({
            "message": "Chauffeur assigné avec succès",
            "voyage_id": str(voyage.Id_voyage),
            "chauffeur": {"id": chauffeur.id_chauffeur, "nom": f"{chauffeur.name} {chauffeur.surname}"},
            "_events": {
                "voyage_updated": event_sent,
                "all_sent": event_sent,
            },
        }, status=status.HTTP_200_OK)


# ==============================================================================
# HEALTH CHECK
# ==============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
@extend_schema(
    tags=['Health'], summary="Health check",
    description="Vérifie que le service est opérationnel",
    responses={200: OpenApiResponse(description="Service en bonne santé")},
)
def health_check(request):
    """Endpoint public pour vérifier que le service est vivant"""
    return Response({
        'status':  'healthy',
        'service': 'fleet-management-service',
        'version': '1.0.0',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
@extend_schema(
    tags=['Health'], summary="Health check RabbitMQ",
    description="Vérifie la connexion au broker RabbitMQ",
    responses={200: OpenApiResponse(description="Statut de la connexion RabbitMQ")},
)
def rabbitmq_health_check(request):
    """Endpoint public pour vérifier la connexion RabbitMQ"""
    connected = rabbitmq_client._is_connected()
    if not connected:
        connected = rabbitmq_client.connect()

    return Response({
        'rabbitmq_connected': connected,
        'host':  rabbitmq_client.host,
        'port':  rabbitmq_client.port,
        'vhost': rabbitmq_client.vhost,
        'status': 'ok' if connected else 'unreachable',
    }, status=status.HTTP_200_OK if connected else status.HTTP_503_SERVICE_UNAVAILABLE)
