import api from "./axios";

export const avisService = {
  /**
   * Récupère les avis approuvés pour un voyage donné.
   * @param {string} voyageId
   */
  getAvisVoyage: async (voyageId) => {
    const { data } = await api.get("/api/avis/", {
      params: { voyage_id: voyageId },
    });
    return Array.isArray(data) ? data : data.results || [];
  },

  /**
   * Récupère les statistiques d'avis d'un voyage.
   * @param {string} voyageId
   */
  getStatsVoyage: async (voyageId) => {
    const { data } = await api.get(`/api/avis/stats/${voyageId}/`);
    return data;
  },

  /**
   * Soumet un avis pour un voyage (VOYAGEUR uniquement).
   * @param {{ Id_voyage: string, note: number, commentaires: string, user_id: string }} payload
   */
  soumettrreAvis: async (payload) => {
    const { data } = await api.post("/api/avis/", payload);
    return data;
  },

  /**
   * Vérifie si l'utilisateur a déjà laissé un avis pour ce voyage.
   * On interroge la liste et on filtre côté client pour éviter un endpoint dédié.
   * @param {string} voyageId
   * @param {string} userId
   */
  aDejaLaisseUnAvis: async (voyageId, userId) => {
    const avis = await avisService.getAvisVoyage(voyageId);
    return avis.some((a) => String(a.user_id) === String(userId));
  },
};