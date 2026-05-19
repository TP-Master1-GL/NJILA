import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── accessToken en mémoire (sécurité XSS), refreshToken persisté ─────────────
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

/**
 * Réhydratation au démarrage :
 * Zustand persiste le store dans localStorage sous "auth-storage".
 * On tente de récupérer le token depuis cet état persisté
 * pour que l'intercepteur fonctionne dès le premier rendu,
 * même après un rechargement de page.
 *
 * À appeler UNE FOIS au bootstrap de l'app (main.jsx ou App.jsx).
 */
export const rehydrateAccessToken = () => {
  try {
    const raw = localStorage.getItem("auth-storage");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    // Zustand persist enveloppe dans { state: { ... } }
    const token = parsed?.state?.token || parsed?.state?.user?.token || null;
    if (token && !_accessToken) {
      _accessToken = token;
    }
  } catch {
    // localStorage corrompu ou absent — ignorer silencieusement
  }
};

// ── Intercepteur requête ──────────────────────────────────────────────────────
// Priorité : _accessToken mémoire → Zustand persisté (fallback rechargement page)
api.interceptors.request.use(
  (config) => {
    let token = _accessToken;

    // Fallback : si token absent en mémoire (rechargement page),
    // tenter de le lire depuis le store Zustand persisté
    if (!token) {
      try {
        const raw = localStorage.getItem("auth-storage");
        if (raw) {
          const parsed = JSON.parse(raw);
          token = parsed?.state?.token || parsed?.state?.user?.token || null;
          // Resynchroniser en mémoire pour les prochains appels
          if (token) _accessToken = token;
        }
      } catch {
        // ignorer
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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
        setRefreshToken(data.refreshToken ?? refreshToken);
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