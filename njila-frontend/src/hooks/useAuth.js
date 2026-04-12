import { useAuthStore } from "../store/authStore";
import { authService } from "../services/authService";
import { useNavigate } from "react-router-dom";
import { ROLES } from "../utils/constants";
import toast from "react-hot-toast";

export const useAuth = () => {
  const { user, role, isAuthenticated, setUser, clearUser, setLoading } = useAuthStore();
  const navigate = useNavigate();

  const login = async (credentials) => {
    setLoading(true);
    try {
      const data = await authService.login(credentials);
      setUser(data.user);
      toast.success(`Bienvenue, ${data.user.nom} !`);
      redirectByRole(data.user.role, navigate);
    } catch (error) {
      toast.error(error.response?.data?.message || "Identifiants incorrects");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      clearUser();
      navigate("/login");
      toast.success("Déconnexion réussie");
    }
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      await authService.register(userData);
      toast.success("Compte créé ! Vérifiez votre email.");
      navigate("/login");
    } catch (error) {
      toast.error(error.response?.data?.message || "Erreur lors de l'inscription");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { user, role, isAuthenticated, login, logout, register };
};

export const redirectByRole = (role, navigate) => {
  const redirects = {
    [ROLES.VOYAGEUR]:       "/voyageur",
    [ROLES.GUICHETIER]:     "/guichet",
    [ROLES.MANAGER_LOCAL]:  "/manager",
    [ROLES.MANAGER_GLOBAL]: "/manager",
    [ROLES.ADMIN]:          "/admin",
    [ROLES.CHAUFFEUR]:      "/guichet",
  };
  navigate(redirects[role] || "/");
};
