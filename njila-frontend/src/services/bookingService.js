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
  getPassagersVoyage: async (voyageId) => {
    const { data } = await api.get(`/api/bookings/voyage/${voyageId}/passagers`);
    return data;
  },

  getSiegesVoyage: async (voyageId) => {
    const { data } = await api.get(`/api/bookings/voyage/${voyageId}/sieges`);
    return data;
  },

  getReservationsVoyage: async (voyageId) => {
    const { data } = await api.get(`/api/bookings/voyage/${voyageId}`);
    return data;
  },

  // ─── Billets par ID numérique ──────────────────────────────────────────────
  // Ces méthodes attendent un Long (ID numérique de réservation)
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

  convertirBilletElectronique: async (id, payload) => {
    const { data } = await api.patch(`/api/bookings/${id}/convert-ticket`, payload);
    return data;
  },

  // ─── Billets par numéro unique (string) ───────────────────────────────────
  // FIX : ces méthodes utilisent le numéro de ticket string (ex: SUNSET-BAF-WEB-...)
  // Nécessite les nouveaux endpoints backend :
  //   GET  /api/bookings/ticket/by-numero/{numeroTicket}
  //   PATCH /api/bookings/ticket/convert-by-numero

  /**
   * Récupère les infos d'un ticket depuis son numéro unique (string).
   * Utilisé par le guichetier dans VerificationBillet.
   */
  getTicketByNumero: async (numeroTicket) => {
    const { data } = await api.get(
      `/api/bookings/ticket/by-numero/${encodeURIComponent(numeroTicket)}`
    );
    return data;
  },

  /**
   * Convertit un billet électronique en billet d'embarquement
   * en passant directement le numéro de ticket (string).
   * Utilisé par le guichetier dans VerificationBillet.
   */
  convertirParNumero: async (numeroTicketElectronique, idGuichetier) => {
    const { data } = await api.patch("/api/bookings/ticket/convert-by-numero", {
      numeroTicketElectronique,
      idGuichetier,
    });
    return data;
  },

  // ─── Départ ────────────────────────────────────────────────────────────────
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
  getRecettesAgence: async (codeAgence, devise = "XAF") => {
    const { data } = await api.get(
      `/api/bookings/recettes/agence/${codeAgence}`,
      { params: { devise } }
    );
    return data;
  },

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