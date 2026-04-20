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
    const formattedPayload = {
      ...payload,
      bus_id: payload.busId,
      chauffeur_id: payload.chauffeurId,
      prix_vip: payload.prixVIP,
      prix_classic: payload.prixClassic
    };
    delete formattedPayload.busId;
    delete formattedPayload.chauffeurId;
    delete formattedPayload.prixVIP;
    delete formattedPayload.prixClassic;

    const { data } = await api.post("/api/fleet/voyages", formattedPayload);
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

  getFilialeStats: async (id) => {
    const { data } = await api.get(`/api/fleet/filiales/${id}/stats`);
    return data;
  },

  getBusStats: async () => {
    const { data } = await api.get("/api/fleet/bus/stats");
    return data;
  },
};
