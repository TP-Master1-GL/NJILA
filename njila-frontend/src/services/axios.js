import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

// ── Instance unique pour tous les appels ──────────────────────────────────────
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Helpers — accessToken en mémoire (sécurité XSS), refreshToken persisté ───
let _accessToken = null;

export const useAuthToken    = ()  => _accessToken;
export const setAccessToken  = (t) => { _accessToken = t ?? null; };

export const getRefreshToken = ()  => localStorage.getItem("refreshToken");
export const setRefreshToken = (t) => {
  if (t) localStorage.setItem("refreshToken", t);
  else   localStorage.removeItem("refreshToken");
};

export const clearAuth = () => {
  _accessToken = null;
  localStorage.removeItem("refreshToken");
};

// ── Intercepteur requête — ajoute le JWT automatiquement ─────────────────────
api.interceptors.request.use(
  (config) => {
    const token = useAuthToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Intercepteur réponse — gère les 401 et refresh token ─────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error("Pas de refresh token disponible");

        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          { refresh_token: refreshToken }
        );

        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken ?? refreshToken); // rotation si fournie
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

export default api;
