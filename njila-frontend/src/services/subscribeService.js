import api from "./axios";

export const subscribeService = {
  // ── Agences (/api/agencies/) ──────────────────────────────────────────────
  getAgences: async () => {
    const { data } = await api.get("/api/agencies/agences");
    return data;
  },

  getAgence: async (id) => {
    const { data } = await api.get(`/api/agencies/agences/${id}`);
    return data;
  },

  creerAgence: async (payload) => {
    const { data } = await api.post("/api/agencies/agences", payload);
    return data;
  },

  getMonAbonnement: async (agenceId) => {
    const { data } = await api.get(`/api/agencies/agences/${agenceId}/mon-abonnement`);
    return data;
  },

  demandeEssai: async (agenceId) => {
    const { data } = await api.post(`/api/agencies/agences/${agenceId}/demande-essai`);
    return data;
  },

  souscrire: async (agenceId, payload) => {
    const { data } = await api.post(`/api/agencies/agences/${agenceId}/souscrire`, payload);
    return data;
  },

  renouveler: async (agenceId, payload) => {
    const { data } = await api.post(`/api/agencies/agences/${agenceId}/renouveler`, payload);
    return data;
  },

  suspendre: async (agenceId, payload) => {
    const { data } = await api.post(`/api/agencies/agences/${agenceId}/suspendre`, payload);
    return data;
  },

  reactiver: async (agenceId, payload) => {
    const { data } = await api.post(`/api/agencies/agences/${agenceId}/reactiver`, payload);
    return data;
  },

  // ── Subscribe (/api/subscribe/) ───────────────────────────────────────────
  getTableauDeBord: async () => {
    const { data } = await api.get("/api/subscribe/tableau-de-bord");
    return data;
  },

  verifyAbonnement: async (agenceId) => {
    const { data } = await api.get(`/api/subscribe/verify/${agenceId}`);
    return data;
  },

  getModules: async (agenceId) => {
    const { data } = await api.get(`/api/subscribe/modules/${agenceId}`);
    return data;
  },
};
