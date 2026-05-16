/**
 * filialeService.js
 *
 * Aligné sur le modèle Django Filiale et les routes API exactes.
 *
 * Modèle Filiale — champs :
 *   id_filiale (UUID PK), agence (FK → Agence.id_agence),
 *   nom, code (unique), ville (choices), adresse, telephone,
 *   email, est_active (bool)
 *
 * Villes disponibles (choices Django) :
 *   Douala, Yaoundé, Bafoussam, Garoua, Ngaoundéré,
 *   Bamenda, Maroua, Kribi, Limbe, Ebolowa, Dschang
 *
 * Routes :
 *   GET    /api/filiales/
 *   POST   /api/filiales/
 *   GET    /api/filiales/{id_filiale}/
 *   PUT    /api/filiales/{id_filiale}/
 *   PATCH  /api/filiales/{id_filiale}/
 *   DELETE /api/filiales/{id_filiale}/
 *   GET    /api/filiales/{id_filiale}/stats/
 */

import api from "./axios";

export const filialeService = {

  // ═══════════════════════════════════════════════════════════
  //  LISTE & DÉTAIL
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /api/filiales/
   * @param {Object} params - ex: { est_active: true, ville: "Douala" }
   */
  getFiliales: async (params) => {
    const { data } = await api.get("/api/filiales/", { params });
    return data;
  },

  /**
   * GET /api/filiales/{id_filiale}/
   * @param {string} id_filiale - UUID
   */
  getFilialeDetail: async (id_filiale) => {
    const { data } = await api.get(`/api/filiales/${id_filiale}/`);
    return data;
  },

  /**
   * GET /api/filiales/{id_filiale}/stats/
   * @param {string} id_filiale - UUID
   */
  getFilialeStats: async (id_filiale) => {
    const { data } = await api.get(`/api/filiales/${id_filiale}/stats/`);
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  CRÉATION
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/filiales/
   * @param {Object} payload
   *   { nom, code, ville, adresse, telephone, email, agence (UUID) }
   *   est_active par défaut : true (côté Django)
   *   Contrainte : code unique + unique_together [agence, code]
   */
  creerFiliale: async (payload) => {
    const { data } = await api.post("/api/filiales/", payload);
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  MODIFICATION
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /api/filiales/{id_filiale}/
   * Modification partielle — ex: changer seulement est_active
   * @param {string} id_filiale - UUID
   * @param {Object} payload - champs partiels
   */
  modifierFiliale: async (id_filiale, payload) => {
    const { data } = await api.patch(`/api/filiales/${id_filiale}/`, payload);
    return data;
  },

  /**
   * PUT /api/filiales/{id_filiale}/
   * Remplacement complet
   * @param {string} id_filiale - UUID
   * @param {Object} payload - tous les champs requis
   */
  remplacerFiliale: async (id_filiale, payload) => {
    const { data } = await api.put(`/api/filiales/${id_filiale}/`, payload);
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  TOGGLE ACTIVATION  (raccourci PATCH sur est_active)
  // ═══════════════════════════════════════════════════════════

  /**
   * PATCH /api/filiales/{id_filiale}/
   * Active ou désactive une filiale
   * @param {string} id_filiale - UUID
   * @param {boolean} est_active
   */
  toggleFiliale: async (id_filiale, est_active) => {
    const { data } = await api.patch(`/api/filiales/${id_filiale}/`, { est_active });
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  SUPPRESSION
  // ═══════════════════════════════════════════════════════════

  /**
   * DELETE /api/filiales/{id_filiale}/
   * Attention : CASCADE sur Guichetier et Trajet (filiale_depart/filiale_arrive)
   * @param {string} id_filiale - UUID
   */
  supprimerFiliale: async (id_filiale) => {
    await api.delete(`/api/filiales/${id_filiale}/`);
  },
};
