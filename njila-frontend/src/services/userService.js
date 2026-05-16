import api from "./axios";
import { authService } from "./authService";

export const userService = {
  // ── Profil Utilisateur ─────────────────────────────────────────────────────

  /**
   * Récupérer le profil d'un utilisateur par ID (admin/manager)
   * @param {string} id - UUID de l'utilisateur cible
   */
  getProfil: async (id) => {
    const { data } = await api.get(`/api/users/${id}`);
    return data?.data || data;
  },

  /**
   * Récupérer son propre profil (utilisateur connecté)
   * Endpoint : GET /api/users/{id}
   * @param {string} id - UUID de l'utilisateur connecté (fourni par useAuthStore)
   */
  getMonProfil: async (id) => {
    if (!id) throw new Error("[userService.getMonProfil] id manquant");
    // Normalisation défensive : garantir une string UUID propre
    const userId = typeof id === "string" ? id : String(id);
    const { data } = await api.get(`/api/users/${userId}`);
    return data?.data || data;
  },

  /**
   * Mettre à jour son propre profil (utilisateur connecté)
   * Endpoint : PUT /api/users/{id}
   * @param {string} id          - UUID de l'utilisateur connecté
   * @param {object} payload     - Champs à mettre à jour
   * @param {boolean} skipRefresh - Si true, ne pas forcer le refresh du token
   */
  updateMonProfil: async (id, payload, skipRefresh = false) => {
    const { data } = await api.put(`/api/users/${id}`, payload);
    const result = data?.data || data;

    if (!skipRefresh) {
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          const refreshResult = await authService.refresh(refreshToken);
          if (refreshResult?.access_token) {
            localStorage.setItem("access_token", refreshResult.access_token);
            if (refreshResult.refresh_token) {
              localStorage.setItem("refresh_token", refreshResult.refresh_token);
            }
          }
        }
      } catch (refreshError) {
        console.warn("[userService] Erreur refresh après updateMonProfil:", refreshError);
      }
    }

    return result;
  },

  /**
   * Mettre à jour sa propre photo de profil (utilisateur connecté)
   * Endpoint : PATCH /api/users/{id}/photo
   * Body attendu par le backend : { "photoProfil": "https://..." }
   *
   * @param {string}  id          - UUID de l'utilisateur connecté
   * @param {object}  payload     - { photoProfil: "url_string" } — construit par useProfile, pas par l'appelant
   * @param {boolean} skipRefresh - Si true, ne pas forcer le refresh du token
   *
   * Guard double-wrap : si photoProfil est un objet (ex: { photoProfil: { photoProfil: url } }),
   * on aplatit pour éviter l'erreur Jackson "Cannot deserialize String from Object".
   */
  updateMonPhoto: async (id, payload, skipRefresh = false) => {
    const safePayload =
      payload?.photoProfil && typeof payload.photoProfil === "object"
        ? { photoProfil: payload.photoProfil?.photoProfil ?? String(payload.photoProfil) }
        : payload;

    const { data } = await api.patch(`/api/users/${id}/photo`, safePayload);
    const result = data?.data || data;

    if (!skipRefresh) {
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          const refreshResult = await authService.refresh(refreshToken);
          if (refreshResult?.access_token) {
            localStorage.setItem("access_token", refreshResult.access_token);
            if (refreshResult.refresh_token) {
              localStorage.setItem("refresh_token", refreshResult.refresh_token);
            }
          }
        }
      } catch (refreshError) {
        console.warn("[userService] Erreur refresh après updateMonPhoto:", refreshError);
      }
    }

    return result;
  },

  /**
   * Mettre à jour le profil d'un autre utilisateur (admin/manager)
   * Endpoint : PUT /api/users/{id}
   * @param {string}  id          - UUID de l'utilisateur cible
   * @param {object}  payload     - Champs à mettre à jour
   * @param {boolean} skipRefresh - Si true, ne pas forcer le refresh du token
   */
  updateProfil: async (id, payload, skipRefresh = false) => {
    const { data } = await api.put(`/api/users/${id}`, payload);
    const result = data?.data || data;

    if (!skipRefresh) {
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          const refreshResult = await authService.refresh(refreshToken);
          if (refreshResult?.access_token) {
            localStorage.setItem("access_token", refreshResult.access_token);
            if (refreshResult.refresh_token) {
              localStorage.setItem("refresh_token", refreshResult.refresh_token);
            }
          }
        }
      } catch (refreshError) {
        console.warn("[userService] Erreur refresh après updateProfil:", refreshError);
      }
    }

    return result;
  },

  /**
   * Uploader la photo de profil (POST multipart — legacy)
   * @param {string}   id       - UUID de l'utilisateur
   * @param {FormData} formData - FormData contenant la photo
   */
  uploadPhoto: async (id, formData) => {
    const { data } = await api.post(`/api/users/${id}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const result = data?.data || data;

    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        const refreshResult = await authService.refresh(refreshToken);
        if (refreshResult?.access_token) {
          localStorage.setItem("access_token", refreshResult.access_token);
          if (refreshResult.refresh_token) {
            localStorage.setItem("refresh_token", refreshResult.refresh_token);
          }
        }
      }
    } catch (refreshError) {
      console.warn("[userService] Erreur refresh après uploadPhoto:", refreshError);
    }

    return result;
  },

  /**
   * Mettre à jour la photo de profil via FormData (PATCH multipart — legacy)
   * @param {string}   userId   - UUID de l'utilisateur
   * @param {FormData} formData - FormData contenant la nouvelle photo
   */
  updatePhoto: async (userId, formData) => {
    const { data } = await api.patch(`/api/users/${userId}/photo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const result = data?.data || data;

    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        const refreshResult = await authService.refresh(refreshToken);
        if (refreshResult?.access_token) {
          localStorage.setItem("access_token", refreshResult.access_token);
          if (refreshResult.refresh_token) {
            localStorage.setItem("refresh_token", refreshResult.refresh_token);
          }
        }
      }
    } catch (refreshError) {
      console.warn("[userService] Erreur refresh après updatePhoto:", refreshError);
    }

    return result;
  },

  // ── Gestion Utilisateurs (Listes) ──────────────────────────────────────────

  /**
   * Lister tous les utilisateurs
   * @param {object} params - { page, search, limit }
   */
  getUtilisateurs: async (params = {}) => {
    const { data } = await api.get("/api/users", { params });
    return data?.data || [];
  },

  /**
   * Supprimer un utilisateur
   * @param {string} userId - UUID de l'utilisateur
   */
  deleteUtilisateur: async (userId) => {
    const { data } = await api.delete(`/api/users/${userId}`);
    return data?.data || data;
  },

  // ── Avis ───────────────────────────────────────────────────────────────────

  /**
   * Récupérer les avis d'un utilisateur
   * @param {string} userId - UUID de l'utilisateur
   */
  getUserAvis: async (userId) => {
    const { data } = await api.get(`/api/users/${userId}/avis`);
    return data?.data || [];
  },

  /**
   * Soumettre un avis pour une agence
   * @param {string} userId  - UUID de l'utilisateur (voyageur)
   * @param {object} payload - Contenu de l'avis
   */
  submitAvis: async (userId, payload) => {
    const { data } = await api.post(`/api/users/${userId}/avis`, payload);
    return data?.data || data;
  },

  /**
   * Supprimer un avis
   * @param {string} userId - UUID de l'utilisateur
   * @param {string} avisId - UUID de l'avis
   */
  deleteAvis: async (userId, avisId) => {
    const { data } = await api.delete(`/api/users/${userId}/avis/${avisId}`);
    return data?.data || data;
  },

  /**
   * Récupérer les avis publics d'une agence (paginé)
   * @param {string} agenceId - UUID de l'agence
   */
  getAgenceAvis: async (agenceId) => {
    const { data } = await api.get(`/api/users/avis/agence/${agenceId}`);
    return data?.data || [];
  },

  /**
   * Récupérer les statistiques des avis d'une agence
   * @param {string} agenceId - UUID de l'agence
   */
  getAgenceStats: async (agenceId) => {
    const { data } = await api.get(`/api/users/avis/agence/${agenceId}/stats`);
    return data?.data || data;
  },

  // ── Guichetiers ────────────────────────────────────────────────────────────

  /**
   * Lister les guichetiers d'une filiale
   * @param {string} filialeId - UUID de la filiale
   * @param {object} params    - Paramètres de pagination/recherche
   */
  listGuichetiersByFiliale: async (filialeId, params = {}) => {
    const { data } = await api.get(`/api/users/filiales/${filialeId}/guichetiers`, { params });
    return data?.data || [];
  },

  /**
   * Créer un guichetier dans une filiale
   * @param {string} filialeId - UUID de la filiale
   * @param {object} payload   - Données du guichetier
   */
  createGuichetier: async (filialeId, payload) => {
    const { data } = await api.post(`/api/users/filiales/${filialeId}/guichetiers`, payload);
    return data?.data || data;
  },

  // ── Chauffeurs ─────────────────────────────────────────────────────────────

  /**
   * Lister les chauffeurs d'une filiale
   * @param {string} filialeId - UUID de la filiale
   * @param {object} params    - Paramètres de pagination/recherche
   */
  listChauffeursByFiliale: async (filialeId, params = {}) => {
    const { data } = await api.get(`/api/users/filiales/${filialeId}/chauffeurs`, { params });
    return data?.data || [];
  },

  /**
   * Créer un chauffeur dans une filiale
   * @param {string} filialeId - UUID de la filiale
   * @param {object} payload   - Données du chauffeur
   */
  createChauffeur: async (filialeId, payload) => {
    const { data } = await api.post(`/api/users/filiales/${filialeId}/chauffeurs`, payload);
    return data?.data || data;
  },

  // ── Employés ───────────────────────────────────────────────────────────────

  /**
   * Lister les employés d'une filiale
   * @param {string} filialeId - UUID de la filiale
   * @param {object} params    - Paramètres de pagination/recherche
   */
  listEmployesByFiliale: async (filialeId, params = {}) => {
    const { data } = await api.get(`/api/users/filiales/${filialeId}/employes`, { params });
    return data?.data || [];
  },

  /**
   * Lister les employés d'une agence
   * @param {string} agenceId - UUID de l'agence
   * @param {object} params   - Paramètres de pagination/recherche
   */
  listEmployesByAgence: async (agenceId, params = {}) => {
    const { data } = await api.get(`/api/users/agences/${agenceId}/employes`, { params });
    return data?.data || [];
  },

  /**
   * Lister les employés d'une filiale spécifique dans une agence
   * @param {string} agenceId  - UUID de l'agence
   * @param {string} filialeId - UUID de la filiale
   * @param {object} params    - Paramètres de pagination/recherche
   */
  listEmployesByAgenceAndFiliale: async (agenceId, filialeId, params = {}) => {
    const { data } = await api.get(
      `/api/users/agences/${agenceId}/filiales/${filialeId}/employes`,
      { params }
    );
    return data?.data || [];
  },

  // ── Staff / Managers ───────────────────────────────────────────────────────

  /**
   * Lister tout le staff d'une agence
   * @param {string} agenceId - UUID de l'agence
   * @param {object} params   - Paramètres de pagination/recherche
   */
  listStaffByAgence: async (agenceId, params = {}) => {
    const { data } = await api.get(`/api/users/agences/${agenceId}/staff`, { params });
    return data?.data || [];
  },

  /**
   * Créer un ManagerLocal dans une agence
   * @param {string} agenceId - UUID de l'agence
   * @param {object} payload  - Données du ManagerLocal
   */
  createManagerLocal: async (agenceId, payload) => {
    const { data } = await api.post(`/api/users/agences/${agenceId}/managers-locaux`, payload);
    return data?.data || data;
  },

  /**
   * Créer un ManagerGlobal (admin uniquement)
   * @param {object} payload - Données du ManagerGlobal
   */
  createManagerGlobal: async (payload) => {
    const { data } = await api.post(`/api/users/admin/managers-globaux`, payload);
    return data?.data || data;
  },

  /**
   * Supprimer un compte staff
   * @param {string} staffId - UUID du staff
   */
  deleteStaff: async (staffId) => {
    const { data } = await api.delete(`/api/users/staff/${staffId}`);
    return data?.data || data;
  },

  // ── Santé de l'API ─────────────────────────────────────────────────────────

  /**
   * Vérifier l'état de santé du service
   */
  health: async () => {
    const { data } = await api.get("/api/users/health");
    return data;
  },
};
