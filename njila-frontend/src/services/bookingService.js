import api from "./axios";

export const bookingService = {
  // ─── Réservations ──────────────────────────────────────────────────────────
  creerReservation: async (payload) => {
    const { data } = await api.post("/api/bookings", payload);
    return data;
  },

  getReservation: async (id) => {
    const { data } = await api.get(`/api/bookings/${id}`);
    return data;
  },

  getMesReservations: async (userId) => {
    const { data } = await api.get(`/api/bookings/history/${userId}`);
    return data;
  },

  annulerReservation: async (id, idUtilisateur) => {
    const { data } = await api.patch(`/api/bookings/${id}/cancel`, null, {
      params: { idUtilisateur },
    });
    return data;
  },

  // ─── Manifeste & Sièges ───────────────────────────────────────────────────
  /**
   * Récupère le manifeste complet des passagers d'un voyage
   * (avec numéro de siège, distinction WEB / GUICHET, etc.)
   */
  getPassagersVoyage: async (voyageId) => {
    const { data } = await api.get(`/api/bookings/voyage/${voyageId}/passagers`);
    return data;
  },

  /**
   * Récupère le plan des sièges (disponibles, occupés, en attente)
   */
  getSiegesVoyage: async (voyageId) => {
    const { data } = await api.get(`/api/bookings/voyage/${voyageId}/sieges`);
    return data;
  },

  // ─── Liste des réservations d'un voyage ───────────────────────────────────
  getReservationsVoyage: async (voyageId) => {
    const { data } = await api.get(`/api/bookings/voyage/${voyageId}`);
    return data;
  },

  // ─── Billets ───────────────────────────────────────────────────────────────
  getTicket: async (id) => {
    const { data } = await api.get(`/api/bookings/${id}/ticket`);
    return data;
  },

  telechargerBilletPdf: async (id) => {
    const response = await api.get(`/api/bookings/${id}/ticket/pdf`, {
      responseType: "blob",
    });
    return response.data;
  },

  // Note : confirmerBillet semble correspondre à la conversion de billet
  confirmerBillet: async (id, payload) => {
    const { data } = await api.patch(`/api/bookings/${id}/confirm`, payload);
    return data;
  },

  convertirBilletElectronique: async (id, payload) => {
    const { data } = await api.patch(`/api/bookings/${id}/convert-ticket`, payload);
    return data;
  },

  validerBilletDepart: async (payload) => {
    const { data } = await api.post("/api/bookings/depart/valider-billet", payload);
    return data;
  },

  cloturerDepart: async (idVoyage, idManager) => {
    const { data } = await api.post("/api/bookings/depart/cloturer", null, {
      params: { idVoyage, idManager },
    });
    return data;
  },

  // ─── Fidélité ──────────────────────────────────────────────────────────────
  getFidelite: async (idVoyageur, codeAgence) => {
    const { data } = await api.get(`/api/bookings/fidelite/${idVoyageur}`, {
      params: { codeAgence },
    });
    return data;
  },

  // ─── Recettes ──────────────────────────────────────────────────────────────
  /**
   * Recettes d'une agence ventilées par canal.
   *
   * @param {string} codeAgence - ex : "GEN", "BNM"
   * @param {string} [devise] - ex : "XAF"
   */
  getRecettesAgence: async (codeAgence, devise = "XAF") => {
    const { data } = await api.get(
      `/api/bookings/recettes/agence/${codeAgence}`,
      { params: { devise } }
    );
    return data;
  },

  /**
   * Recettes d'une filiale ventilées par canal.
   *
   * @param {string} codeFiliale - ex : "BYDE", "DKLA"
   * @param {string} [devise] - ex : "XAF"
   */
  getRecettesFiliale: async (codeFiliale, devise = "XAF") => {
    const { data } = await api.get(
      `/api/bookings/recettes/filiale/${codeFiliale}`,
      { params: { devise } }
    );
    return data;
  },

  // ─── Stats Filiale ─────────────────────────────────────────────────────────
  getStatsFiliale: async (filialeId, codeFiliale) => {
    const { data } = await api.get(`/api/bookings/stats/${filialeId}`, {
      params: { codeFiliale },
    });
    return data;
  },
};
