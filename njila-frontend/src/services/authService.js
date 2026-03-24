import api, { setAccessToken, setRefreshToken, clearAuth } from "./axios";

export const authService = {
  login: async (credentials) => {
    const { data } = await api.post("/api/auth/login", credentials);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    return data;
  },

  register: async (userData) => {
    const { data } = await api.post("/api/auth/register", userData);
    return data;
  },

  logout: async () => {
    await api.post("/api/auth/logout");
    clearAuth();
  },

  me: async () => {
    const { data } = await api.get("/api/auth/me");
    return data;
  },

  refresh: async (refreshToken) => {
    const { data } = await api.post("/api/auth/refresh", { refreshToken });
    setAccessToken(data.accessToken);
    return data;
  },
};
