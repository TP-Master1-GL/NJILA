import api from "./axios";

export const fleetService = {
  getBus: async (params) => {
    const { data } = await api.get("/api/fleet/bus", { params });
    return data;
  },

  ajouterBus: async (payload) => {
    const { data } = await api.post("/api/fleet/bus", payload);
    return data;
  },

  modifierBus: async (id, payload) => {
    const { data } = await api.patch(`/api/fleet/bus/${id}`, payload);
    return data;
  },

  supprimerBus: async (id) => {
    await api.delete(`/api/fleet/bus/${id}`);
  },

  getVoyages: async (params) => {
    const { data } = await api.get("/api/fleet/voyages", { params });
    return data;
  },

  creerVoyage: async (payload) => {
    const { data } = await api.post("/api/fleet/voyages", payload);
    return data;
  },

  modifierVoyage: async (id, payload) => {
    const { data } = await api.patch(`/api/fleet/voyages/${id}`, payload);
    return data;
  },

  getChauffeurs: async () => {
    const { data } = await api.get("/api/fleet/chauffeurs");
    return data;
  },

  getFiliales: async () => {
    const { data } = await api.get("/api/fleet/filiales");
    return data;
  },
};
