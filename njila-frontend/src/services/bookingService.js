import api from "./axios";

export const bookingService = {
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

  confirmerBillet: async (id, payload) => {
    const { data } = await api.patch(`/api/bookings/${id}/confirm`, payload);
    return data;
  },

  getFidelite: async (idVoyageur, codeAgence) => {
    const { data } = await api.get(`/api/bookings/fidelite/${idVoyageur}`, {
      params: { codeAgence },
    });
    return data;
  },
};
