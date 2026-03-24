import api from "./axios";

export const searchService = {
  rechercherVoyages: async ({ origine, destination, date, nombrePlaces = 1 }) => {
    const { data } = await api.get("/api/search/voyages", {
      params: { origine, destination, date, nombrePlaces },
    });
    return data;
  },

  getVilles: async () => {
    const { data } = await api.get("/api/search/villes");
    return data;
  },

  getVoyageDetails: async (voyageId) => {
    const { data } = await api.get(`/api/fleet/voyages/${voyageId}`);
    return data;
  },
};
