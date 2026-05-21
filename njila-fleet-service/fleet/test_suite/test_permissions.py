"""
test_permissions.py — Tests unitaires des classes de permissions RBAC.

Couverture :
  - IsAuthenticated, IsAdmin, IsVoyageur
  - IsGuichetier, IsChauffeur
  - IsManagerLocal, IsManagerGlobal
  - AgencePermission, FilialePermission
  - has_permission et has_object_permission pour chaque classe
  - Helpers internes (_role, _agence_id, _filiale_id, _obj_agence_id)
"""

import uuid
import pytest
from unittest.mock import MagicMock, patch
from django.test import TestCase, RequestFactory

from fleet.permissions import (
    IsAuthenticated, IsAdmin, IsVoyageur, IsGuichetier,
    IsChauffeur, IsManagerLocal, IsManagerGlobal,
    AgencePermission, FilialePermission,
    _role, _agence_id, _filiale_id, _ensure_authenticated,
    _obj_agence_id, _obj_filiale_id,
    ROLE_ADMIN, ROLE_MANAGER_GLOBAL, ROLE_MANAGER_LOCAL,
    ROLE_GUICHETIER, ROLE_CHAUFFEUR, ROLE_VOYAGEUR,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — fabrication de requêtes mockées
# ─────────────────────────────────────────────────────────────────────────────

def _make_request(role='', agence_id=None, filiale_id=None, user_id=None):
    """Construit une requête factice avec user_info injecté."""
    req = MagicMock()
    req.user_info = {
        'userId':    user_id or str(uuid.uuid4()),
        'role':      role,
        'agenceId':  str(agence_id) if agence_id else None,
        'filialeId': str(filiale_id) if filiale_id else None,
    }
    return req


def _make_request_no_auth():
    """Requête sans user_info (utilisateur non authentifié)."""
    req = MagicMock()
    req.user_info = {}
    return req


def _make_obj(agence_id=None, filiale_id=None):
    """Objet modèle factice avec attributs d'agence/filiale."""
    obj = MagicMock()
    obj.id_agence    = agence_id
    obj.agence_id    = agence_id
    obj.Id_agence_id = agence_id
    obj.id           = filiale_id
    obj.filiale_id   = filiale_id
    obj.agence       = None
    obj.filiale_depart = None
    return obj


# ─────────────────────────────────────────────────────────────────────────────
# Helpers internes
# ─────────────────────────────────────────────────────────────────────────────

class HelpersTest(TestCase):

    def test_role_avec_user_info(self):
        req = _make_request(role='MANAGER_GLOBAL')
        self.assertEqual(_role(req), 'MANAGER_GLOBAL')

    def test_role_sans_user_info(self):
        req = _make_request_no_auth()
        self.assertEqual(_role(req), '')

    def test_agence_id(self):
        uid = uuid.uuid4()
        req = _make_request(agence_id=uid)
        self.assertEqual(_agence_id(req), str(uid))

    def test_filiale_id(self):
        uid = uuid.uuid4()
        req = _make_request(filiale_id=uid)
        self.assertEqual(_filiale_id(req), str(uid))

    def test_agence_id_none(self):
        req = _make_request()
        self.assertEqual(_agence_id(req), '')

    def test_obj_agence_id_via_Id_agence_id(self):
        uid = uuid.uuid4()
        obj = MagicMock()
        obj.Id_agence_id = uid
        obj.agence_id    = None
        obj.agence       = None
        obj.filiale_depart = None
        result = _obj_agence_id(obj)
        self.assertEqual(result, str(uid))

    def test_obj_agence_id_via_agence_id(self):
        uid = uuid.uuid4()
        obj = MagicMock()
        obj.agence_id    = uid
        obj.Id_agence_id = None
        obj.agence       = None
        obj.filiale_depart = None
        result = _obj_agence_id(obj)
        self.assertEqual(result, str(uid))

    def test_obj_agence_id_none(self):
        obj = MagicMock()
        obj.agence_id    = None
        obj.Id_agence_id = None
        obj.agence       = None
        obj.filiale_depart = None
        self.assertEqual(_obj_agence_id(obj), '')


# ─────────────────────────────────────────────────────────────────────────────
# IsAuthenticated
# ─────────────────────────────────────────────────────────────────────────────

class IsAuthenticatedTest(TestCase):

    def setUp(self):
        self.perm = IsAuthenticated()
        self.view = MagicMock()

    def test_authentifie(self):
        req = _make_request(role='VOYAGEUR')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_non_authentifie_sans_token(self):
        req = _make_request_no_auth()
        req.headers = {}
        self.assertFalse(self.perm.has_permission(req, self.view))


# ─────────────────────────────────────────────────────────────────────────────
# IsAdmin
# ─────────────────────────────────────────────────────────────────────────────

class IsAdminTest(TestCase):

    def setUp(self):
        self.perm = IsAdmin()
        self.view = MagicMock()

    def test_admin_autorise(self):
        req = _make_request(role='ADMIN')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_administrateur_autorise(self):
        req = _make_request(role='ADMINISTRATEUR')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_manager_global_refuse(self):
        req = _make_request(role='MANAGER_GLOBAL')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_voyageur_refuse(self):
        req = _make_request(role='VOYAGEUR')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_non_authentifie_refuse(self):
        req = _make_request_no_auth()
        req.headers = {}
        self.assertFalse(self.perm.has_permission(req, self.view))


# ─────────────────────────────────────────────────────────────────────────────
# IsVoyageur
# ─────────────────────────────────────────────────────────────────────────────

class IsVoyageurTest(TestCase):

    def setUp(self):
        self.perm = IsVoyageur()
        self.view = MagicMock()

    def test_voyageur_autorise(self):
        req = _make_request(role='VOYAGEUR')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_manager_refuse(self):
        req = _make_request(role='MANAGER_LOCAL')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_chauffeur_refuse(self):
        req = _make_request(role='CHAUFFEUR')
        self.assertFalse(self.perm.has_permission(req, self.view))


# ─────────────────────────────────────────────────────────────────────────────
# IsGuichetier
# ─────────────────────────────────────────────────────────────────────────────

class IsGuichetierTest(TestCase):

    def setUp(self):
        self.perm = IsGuichetier()
        self.view = MagicMock()

    def test_guichetier_autorise(self):
        req = _make_request(role='GUICHETIER')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_manager_local_autorise(self):
        req = _make_request(role='MANAGER_LOCAL')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_manager_global_autorise(self):
        req = _make_request(role='MANAGER_GLOBAL')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_admin_autorise(self):
        req = _make_request(role='ADMIN')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_voyageur_refuse(self):
        req = _make_request(role='VOYAGEUR')
        self.assertFalse(self.perm.has_permission(req, self.view))


# ─────────────────────────────────────────────────────────────────────────────
# IsManagerLocal
# ─────────────────────────────────────────────────────────────────────────────

class IsManagerLocalTest(TestCase):

    def setUp(self):
        self.perm = IsManagerLocal()
        self.view = MagicMock()
        self.agence_id  = uuid.uuid4()
        self.filiale_id = uuid.uuid4()

    def test_manager_local_has_permission(self):
        req = _make_request(role='MANAGER_LOCAL')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_manager_global_has_permission(self):
        req = _make_request(role='MANAGER_GLOBAL')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_admin_has_permission(self):
        req = _make_request(role='ADMIN')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_guichetier_refuse(self):
        req = _make_request(role='GUICHETIER')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_voyageur_refuse(self):
        req = _make_request(role='VOYAGEUR')
        self.assertFalse(self.perm.has_permission(req, self.view))

    # ── has_object_permission ─────────────────────────────────────────────

    def test_admin_obj_permission_tout(self):
        req = _make_request(role='ADMIN')
        obj = _make_obj(agence_id=self.agence_id)
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_global_obj_meme_agence(self):
        req = _make_request(role='MANAGER_GLOBAL', agence_id=self.agence_id)
        obj = MagicMock()
        obj.agence_id    = self.agence_id
        obj.Id_agence_id = None
        obj.agence       = None
        obj.filiale_depart = None
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_global_obj_autre_agence_refuse(self):
        req = _make_request(role='MANAGER_GLOBAL', agence_id=uuid.uuid4())
        obj = MagicMock()
        obj.agence_id    = uuid.uuid4()
        obj.Id_agence_id = None
        obj.agence       = None
        obj.filiale_depart = None
        self.assertFalse(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_local_obj_meme_filiale(self):
        req = _make_request(role='MANAGER_LOCAL', filiale_id=self.filiale_id)
        obj = MagicMock()
        obj.id         = self.filiale_id
        obj.filiale_id = self.filiale_id
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_local_obj_autre_filiale_refuse(self):
        req = _make_request(role='MANAGER_LOCAL', filiale_id=uuid.uuid4())
        obj = MagicMock()
        obj.id         = uuid.uuid4()
        obj.filiale_id = uuid.uuid4()
        self.assertFalse(self.perm.has_object_permission(req, self.view, obj))


# ─────────────────────────────────────────────────────────────────────────────
# IsManagerGlobal
# ─────────────────────────────────────────────────────────────────────────────

class IsManagerGlobalTest(TestCase):

    def setUp(self):
        self.perm = IsManagerGlobal()
        self.view = MagicMock()
        self.agence_id = uuid.uuid4()

    def test_manager_global_has_permission(self):
        req = _make_request(role='MANAGER_GLOBAL')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_admin_has_permission(self):
        req = _make_request(role='ADMIN')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_manager_local_refuse(self):
        req = _make_request(role='MANAGER_LOCAL')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_guichetier_refuse(self):
        req = _make_request(role='GUICHETIER')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_admin_obj_permission_tout(self):
        req = _make_request(role='ADMIN')
        obj = _make_obj(agence_id=self.agence_id)
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_global_obj_meme_agence(self):
        req = _make_request(role='MANAGER_GLOBAL', agence_id=self.agence_id)
        obj = MagicMock()
        obj.agence_id    = self.agence_id
        obj.Id_agence_id = None
        obj.agence       = None
        obj.filiale_depart = None
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_global_obj_autre_agence_refuse(self):
        req = _make_request(role='MANAGER_GLOBAL', agence_id=uuid.uuid4())
        obj = MagicMock()
        obj.agence_id    = uuid.uuid4()
        obj.Id_agence_id = None
        obj.agence       = None
        obj.filiale_depart = None
        self.assertFalse(self.perm.has_object_permission(req, self.view, obj))


# ─────────────────────────────────────────────────────────────────────────────
# AgencePermission
# ─────────────────────────────────────────────────────────────────────────────

class AgencePermissionTest(TestCase):

    def setUp(self):
        self.perm  = AgencePermission()
        self.view  = MagicMock()
        self.agence_id = uuid.uuid4()

    def _req(self, method, role='', agence_id=None):
        req = _make_request(role=role, agence_id=agence_id)
        req.method = method
        return req

    # ── has_permission ────────────────────────────────────────────────────

    def test_get_public(self):
        req = self._req('GET')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_post_admin(self):
        req = self._req('POST', role='ADMIN')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_post_non_admin_refuse(self):
        req = self._req('POST', role='MANAGER_GLOBAL')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_delete_admin(self):
        req = self._req('DELETE', role='ADMIN')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_delete_non_admin_refuse(self):
        req = self._req('DELETE', role='MANAGER_GLOBAL')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_patch_admin(self):
        req = self._req('PATCH', role='ADMIN')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_patch_manager_global(self):
        req = self._req('PATCH', role='MANAGER_GLOBAL')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_patch_manager_local_refuse(self):
        req = self._req('PATCH', role='MANAGER_LOCAL')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_non_authentifie_post_refuse(self):
        req = _make_request_no_auth()
        req.method   = 'POST'
        req.headers  = {}
        self.assertFalse(self.perm.has_permission(req, self.view))

    # ── has_object_permission ─────────────────────────────────────────────

    def test_get_public_obj(self):
        req = self._req('GET')
        obj = _make_obj()
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_admin_patch_obj(self):
        req = self._req('PATCH', role='ADMIN')
        obj = _make_obj(agence_id=self.agence_id)
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_global_patch_sa_propre_agence(self):
        req = self._req('PATCH', role='MANAGER_GLOBAL', agence_id=self.agence_id)
        obj = MagicMock()
        obj.id_agence = self.agence_id
        obj.id        = self.agence_id
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_global_patch_autre_agence_refuse(self):
        req = self._req('PATCH', role='MANAGER_GLOBAL', agence_id=uuid.uuid4())
        obj = MagicMock()
        obj.id_agence = uuid.uuid4()
        obj.id        = uuid.uuid4()
        self.assertFalse(self.perm.has_object_permission(req, self.view, obj))


# ─────────────────────────────────────────────────────────────────────────────
# FilialePermission
# ─────────────────────────────────────────────────────────────────────────────

class FilialePermissionTest(TestCase):

    def setUp(self):
        self.perm  = FilialePermission()
        self.view  = MagicMock()
        self.agence_id  = uuid.uuid4()
        self.filiale_id = uuid.uuid4()

    def _req(self, method, role='', agence_id=None, filiale_id=None):
        req = _make_request(role=role, agence_id=agence_id, filiale_id=filiale_id)
        req.method = method
        return req

    def test_get_public(self):
        req = self._req('GET')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_post_admin(self):
        req = self._req('POST', role='ADMIN')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_post_manager_global_refuse(self):
        req = self._req('POST', role='MANAGER_GLOBAL')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_delete_admin(self):
        req = self._req('DELETE', role='ADMIN')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_delete_non_admin_refuse(self):
        req = self._req('DELETE', role='MANAGER_GLOBAL')
        self.assertFalse(self.perm.has_permission(req, self.view))

    def test_patch_manager_local(self):
        req = self._req('PATCH', role='MANAGER_LOCAL')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_patch_manager_global(self):
        req = self._req('PATCH', role='MANAGER_GLOBAL')
        self.assertTrue(self.perm.has_permission(req, self.view))

    def test_patch_guichetier_refuse(self):
        req = self._req('PATCH', role='GUICHETIER')
        self.assertFalse(self.perm.has_permission(req, self.view))

    # ── has_object_permission ─────────────────────────────────────────────

    def test_admin_obj_tout(self):
        req = self._req('PATCH', role='ADMIN')
        obj = MagicMock()
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_global_sa_filiale(self):
        req = self._req('PATCH', role='MANAGER_GLOBAL', agence_id=self.agence_id)
        obj = MagicMock()
        obj.agence_id    = self.agence_id
        obj.Id_agence_id = None
        obj.agence       = None
        obj.filiale_depart = None
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_global_autre_agence_refuse(self):
        req = self._req('PATCH', role='MANAGER_GLOBAL', agence_id=uuid.uuid4())
        obj = MagicMock()
        obj.agence_id    = uuid.uuid4()
        obj.Id_agence_id = None
        obj.agence       = None
        obj.filiale_depart = None
        self.assertFalse(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_local_sa_filiale(self):
        req = self._req('PATCH', role='MANAGER_LOCAL', filiale_id=self.filiale_id)
        obj = MagicMock()
        obj.id         = self.filiale_id
        obj.filiale_id = self.filiale_id
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))

    def test_manager_local_autre_filiale_refuse(self):
        req = self._req('PATCH', role='MANAGER_LOCAL', filiale_id=uuid.uuid4())
        obj = MagicMock()
        obj.id         = uuid.uuid4()
        obj.filiale_id = uuid.uuid4()
        self.assertFalse(self.perm.has_object_permission(req, self.view, obj))

    def test_get_obj_public(self):
        req = self._req('GET')
        obj = MagicMock()
        self.assertTrue(self.perm.has_object_permission(req, self.view, obj))