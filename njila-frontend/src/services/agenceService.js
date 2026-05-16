/**
 * agenceService.js
 *
 * Aligné sur les routes API exactes et le modèle Django Agence.
 *
 * Modèle Agence — champs :
 *   id_agence (UUID PK), name, adresse, telephone,
 *   email_officiel (unique), statut_global (active|suspendue|expiree|en_attente),
 *   logo_image (ImageField), date_inscription, created_at, updated_at
 *
 * Routes fleet-service :
 *   GET    /api/agences/              → liste
 *   POST   /api/agences/              → créer
 *   GET    /api/agences/{id_agence}/  → détail
 *   PUT    /api/agences/{id_agence}/  → modifier (complet)
 *   PATCH  /api/agences/{id_agence}/  → modifier (partiel)
 *   DELETE /api/agences/{id_agence}/  → supprimer
 *
 * Routes user-service :
 *   POST   /api/users/admin/managers-globaux  → créer compte ManagerGlobal
 */

import api from "./axios";

export const agenceService = {

  // ═══════════════════════════════════════════════════════════
  //  LISTE & DÉTAIL
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /api/agences/
   * On ignore le contexte React Query passé automatiquement comme params
   * pour éviter l'URL invalide /api/agences/?queryKey[]=agences
   */
  getAgences: async (params) => {
    const isRQContext = params && ("queryKey" in params || "signal" in params);
    const { data } = await api.get("/api/agences/", isRQContext ? {} : { params });
    return data;
  },

  /**
   * GET /api/agences/{id_agence}/
   */
  getAgenceDetail: async (id_agence) => {
    const { data } = await api.get(`/api/agences/${id_agence}/`);
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  CRÉATION
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/agences/
   * Passer un FormData si logo_image (ImageField) est inclus
   */
  creerAgence: async (payload) => {
    const isMultipart = payload instanceof FormData;
    const { data } = await api.post("/api/agences/", payload, {
      headers: isMultipart ? { "Content-Type": "multipart/form-data" } : {},
    });
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  MODIFICATION
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /api/agences/{id_agence}/
   */
  modifierAgence: async (id_agence, payload) => {
    const isMultipart = payload instanceof FormData;
    const { data } = await api.patch(`/api/agences/${id_agence}/`, payload, {
      headers: isMultipart ? { "Content-Type": "multipart/form-data" } : {},
    });
    return data;
  },

  /**
   * PUT /api/agences/{id_agence}/
   */
  remplacerAgence: async (id_agence, payload) => {
    const isMultipart = payload instanceof FormData;
    const { data } = await api.put(`/api/agences/${id_agence}/`, payload, {
      headers: isMultipart ? { "Content-Type": "multipart/form-data" } : {},
    });
    return data;
  },

  /**
   * PATCH /api/agences/{id_agence}/ — changer le statut uniquement
   */
  changerStatut: async (id_agence, statut_global) => {
    const { data } = await api.patch(`/api/agences/${id_agence}/`, { statut_global });
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  AFFILIER MANAGER GLOBAL
  //  → POST /api/users/admin/managers-globaux  (user-service)
  //  Le user-service crée le compte, génère les credentials,
  //  envoie l'email et publie l'event RabbitMQ vers le fleet-service
  //  pour mettre à jour la projection agence si nécessaire.
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/users/admin/managers-globaux
   * @param {Object} params
   *   { agenceId, managerNom, managerPrenom, managerEmail, managerTelephone }
   */
  affilierManagerGlobal: async ({ agenceId, managerNom, managerPrenom, managerEmail, managerTelephone }) => {
    const { data } = await api.post("/api/users/admin/managers-globaux", {
      agenceId:  agenceId,
      name:        managerNom,
      surname:     managerPrenom,
      email:      managerEmail,
      phone:  managerTelephone,
    });
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  SUPPRESSION
  // ═══════════════════════════════════════════════════════════

  /**
   * DELETE /api/agences/{id_agence}/
   */
  supprimerAgence: async (id_agence) => {
    await api.delete(`/api/agences/${id_agence}/`);
  },
};
