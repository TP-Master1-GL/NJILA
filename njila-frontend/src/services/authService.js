import api, {
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearAuth,
} from "./axios";

// ─── Décodage JWT (sans librairie) ────────────────────────────────────────────
const decodeJwt = (token) => {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
};

export const authService = {
  login: async (credentials) => {
    const { data } = await api.post("/api/auth/login", credentials);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data;
  },

  register: async (userData) => {
    const { data } = await api.post("/api/auth/register", userData);
    if (data.accessToken && data.refreshToken) {
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
    }
    return data;
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      clearAuth();
    }
  },

  me: async () => {
    const { data } = await api.get("/api/auth/me");
    return data;
  },

  refresh: async (refreshToken) => {
    const { data } = await api.post("/api/auth/refresh", {
      refresh_token: refreshToken,
    });
    setAccessToken(data.accessToken);
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    return data;
  },

  // ── Restauration silencieuse de session au démarrage ──────────────────────
  // ✅ Décode le nouveau JWT pour récupérer agence_id / filiale_id
  // et les fusionne avec les données de /me (qui peut ne pas les retourner).
  initAuth: async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const { data: tokenData } = await api.post("/api/auth/refresh", {
        refresh_token: refreshToken,
      });
      setAccessToken(tokenData.accessToken);
      if (tokenData.refreshToken) setRefreshToken(tokenData.refreshToken);

      // Récupère le profil utilisateur
      const { data: meData } = await api.get("/api/auth/me");

      // ✅ Extrait agence_id et filiale_id depuis le nouveau JWT
      const jwt = decodeJwt(tokenData.accessToken);

      return {
        id:        meData.userId  || meData.id,
        email:     meData.email,
        name:      meData.name,
        surname:   meData.surname,
        role:      meData.role,
        photoUrl:  meData.photoUrl || meData.photo_url || null,
        agenceId:  jwt.agence_id  || meData.agenceId  || meData.agence_id  || null,
        filialeId: jwt.filiale_id || meData.filialeId || meData.filiale_id || null,
      };
    } catch (error) {
      console.error("InitAuth error:", error.response?.data || error.message);
      clearAuth();
      return null;
    }
  },

  updateProfile: async (profileData) => {
    const { data } = await api.patch("/api/auth/me", profileData);
    return data;
  },

  updatePhoto: async (photoUrl) => {
    const { data } = await api.patch("/api/auth/me/photo", { photo_url: photoUrl });
    return data;
  },

  changePassword: async (oldPassword, newPassword) => {
    const { data } = await api.post("/api/auth/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return data;
  },

  forgotPassword: async (email) => {
    const { data } = await api.post("/api/auth/forgot-password", { email });
    return data;
  },

  resetPassword: async (token, newPassword) => {
    const { data } = await api.post("/api/auth/reset-password", {
      token,
      new_password: newPassword,
    });
    return data;
  },
};
