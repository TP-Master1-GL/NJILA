import api from "./axios";

export const searchService = {
  rechercherVoyages: async ({ origine, destination, date, nombrePlaces = 1 }) => {
    const { data } = await api.get("/api/fleet/voyages/recherche", {
      params: { origine, destination, date, nombrePlaces },
    });
    return data;
  },

  getVilles: async () => {
    // Dans NJILA, les villes sont déduites des trajets existants
    const { data } = await api.get("/api/fleet/trajets");
    return data;
  },

  getVoyageDetails: async (voyageId) => {
    const { data } = await api.get(`/api/fleet/voyages/${voyageId}`);
    return data;
  },
};
