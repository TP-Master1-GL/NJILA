import api from "./axios";

export const paymentService = {
  initierPaiement: async (payload) => {
    const { data } = await api.post("/api/payments/initiate", payload);
    return data;
  },

  getStatutPaiement: async (id) => {
    const { data } = await api.get(`/api/payments/${id}/status`);
    return data;
  },

  getHistoriquePaiements: async (userId) => {
    const { data } = await api.get(`/api/payments/history/${userId}`);
    return data;
  },
};
