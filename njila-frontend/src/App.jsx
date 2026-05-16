import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import AppRouter from "./router/AppRouter";
import { useThemeStore } from "./store/themeStore";
import { useAuthStore } from "./store/authStore";
import { authService } from "./services/authService";
import { getRefreshToken } from "./services/axios";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 min
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const { darkMode } = useThemeStore();
  const { setUser, setLoading } = useAuthStore();

  // ── Gestion du thème ────────────────────────────────────────────────────────
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else          document.documentElement.classList.remove("dark");
  }, [darkMode]);

  // ── Restauration de session au démarrage (silent refresh) ───────────────────
  // Si un refreshToken est présent dans localStorage, on tente de récupérer
  // un nouvel accessToken + les infos utilisateur avant que le router ne rende
  // quoi que ce soit. isLoading bloque les redirections prématurées vers /login.
  useEffect(() => {
    if (!getRefreshToken()) {
      // Aucun token persisté → pas de session à restaurer, rien à faire
      return;
    }

    setLoading(true);

    authService
      .initAuth()
      .then((user) => {
        if (user) setUser(user);
      })
      .catch(() => {
        // initAuth gère déjà clearAuth() en interne en cas d'échec
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#0F172A",
            color: "#F8FAFC",
            borderRadius: "8px",
            fontSize: "14px",
          },
          success: { iconTheme: { primary: "#16A34A", secondary: "#F8FAFC" } },
          error:   { iconTheme: { primary: "#DC2626", secondary: "#F8FAFC" } },
        }}
      />
    </QueryClientProvider>
  );
}
