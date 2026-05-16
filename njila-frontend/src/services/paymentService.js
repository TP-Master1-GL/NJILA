import api from "./axios";

export const paymentService = {
  getStatutPaiement: async (id) => {
    const { data } = await api.get(`/api/payments/${id}/status`);
    return data;
  },

  getHistoriquePaiements: async (userId) => {
    const { data } = await api.get(`/api/payments/history/${userId}`);
    return data;
  },

  getFilialeSummary: async (id) => {
    const { data } = await api.get(`/api/payments/filiale/${id}/summary`);
    return data;
  },

  getStats: async () => {
    const { data } = await api.get("/api/payments/stats");
    return data;
  },
};
