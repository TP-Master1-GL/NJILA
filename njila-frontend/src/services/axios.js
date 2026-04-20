import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

// Instance unique pour tous les appels
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Intercepteur requête — ajoute le JWT automatiquement et les préfixes du Gateway ──────────────────────
api.interceptors.request.use(
  (config) => {
    const token = useAuthToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (config.url && !config.url.startsWith("http")) {
      if (config.url.startsWith("/api/auth")) {
        config.url = `/njila-auth-service${config.url}`;
      } else if (config.url.startsWith("/api/fleet")) {
        config.url = `/njila-fleet-service${config.url}`;
      } else if (config.url.startsWith("/api/subscribe")) {
        config.url = `/njila-subscribe-service${config.url}`;
      } else if (config.url.startsWith("/api/bookings")) {
        config.url = `/njila-booking-service${config.url}`;
      } else if (config.url.startsWith("/api/users") || config.url.startsWith("/api/agences-filiales")) {
        config.url = `/njila-user-service${config.url}`;
      } else if (config.url.startsWith("/api/payments")) {
        config.url = `/njila-payment-service${config.url}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Intercepteur réponse — gère les 401 et refresh token ──────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = getRefreshToken();
        const { data } = await axios.post(
          `${API_BASE_URL}/njila-auth-service/api/auth/refresh`,
          { refreshToken }
        );
        setAccessToken(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Helpers — lire/écrire le token en mémoire (pas localStorage)
let _accessToken = null;
let _refreshToken = null;

export const useAuthToken     = () => _accessToken;
export const getRefreshToken  = () => _refreshToken;
export const setAccessToken   = (t) => { _accessToken  = t; };
export const setRefreshToken  = (t) => { _refreshToken = t; };
export const clearAuth        = () => { _accessToken = null; _refreshToken = null; };

export default api;
