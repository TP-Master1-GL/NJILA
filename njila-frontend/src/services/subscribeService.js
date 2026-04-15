import api from "./axios";

export const subscribeService = {
  getAgences: async () => {
    const { data } = await api.get("/api/subscribe/agences");
    return data;
  },

  getAgence: async (id) => {
    const { data } = await api.get(`/api/subscribe/agences/${id}`);
    return data;
  },

  souscrire: async (id, payload) => {
    const { data } = await api.post(`/api/subscribe/agences/${id}/souscrire`, payload);
    return data;
  },

  renouveler: async (id, payload) => {
    const { data } = await api.post(`/api/subscribe/agences/${id}/renouveler`, payload);
    return data;
  },

  suspendre: async (id, payload) => {
    const { data } = await api.post(`/api/subscribe/agences/${id}/suspendre`, payload);
    return data;
  },

  reactiver: async (id, payload) => {
    const { data } = await api.post(`/api/subscribe/agences/${id}/reactiver`, payload);
    return data;
  },

  getTableauDeBord: async () => {
    const { data } = await api.get("/api/subscribe/tableau-de-bord");
    return data;
  },
};
