import api from "./axios";

export const filialeService = {
  /**
   * Récupérer toutes les filiales de l'agence du manager connecté
   */
  getFiliales: async () => {
    const { data } = await api.get("/api/fleet/filiales");
    return data;
  },

  /**
   * Créer une nouvelle filiale
   * @param {Object} payload - { nom, ville, adresse, managerLocalEmail, managerLocalNom }
   */
  creerFiliale: async (payload) => {
    const { data } = await api.post("/api/fleet/filiales", payload);
    return data;
  },

  /**
   * Désactiver / Activer une filiale
   */
  toggleFiliale: async (id, actif) => {
    const { data } = await api.patch(`/api/fleet/filiales/${id}`, { actif });
    return data;
  },

  /**
   * Statistiques d'une filiale spécifique
   */
  getFilialeStats: async (id) => {
    const { data } = await api.get(`/api/fleet/filiales/${id}/stats`);
    return data;
  },

  /**
   * Retrait des recettes consolidées (Manager Global uniquement)
   * @param {Object} payload - { montant, motif }
   */
  retraitRecettes: async (payload) => {
    const { data } = await api.post("/api/payments/retrait", payload);
    return data;
  },
};
