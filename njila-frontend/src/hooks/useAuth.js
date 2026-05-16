import { useAuthStore } from "../store/authStore";
import { authService } from "../services/authService";
import { agenceService } from "../services/agenceService";
import { filialeService } from "../services/filialeService";
import { useNavigate } from "react-router-dom";
import { ROLES } from "../utils/constants";
import toast from "react-hot-toast";

// ─── Décodage JWT (sans librairie) ────────────────────────────────────────────
// Lit le payload Base64 du token et retourne l'objet JSON.
// Utilisé uniquement pour extraire agence_id / filiale_id que le body login
// ne retourne pas directement.
const decodeJwt = (token) => {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
};

// ─── Enrichir l'utilisateur avec les noms d'agence et filiale ─────────────────
const enrichUserWithAgencyInfo = async (user) => {
  try {
    // Pour ADMIN ou MANAGER_GLOBAL, pas besoin de détails d'agence spécifique
    if (user.role === ROLES.ADMIN || user.role === ROLES.MANAGER_GLOBAL) {
      return user;
    }

    // Récupérer les détails de l'agence si disponible
    if (user.agenceId) {
      try {
        const agence = await agenceService.getAgenceDetail(user.agenceId);
        user.agenceNom = agence.name || agence.nom;
        user.agenceCode = agence.code;
      } catch (error) {
        console.warn("[useAuth] Impossible de récupérer l'agence:", error);
        user.agenceNom = "Agence non trouvée";
      }
    }

    // Récupérer les détails de la filiale pour MANAGER_LOCAL et GUICHETIER
    if ((user.role === ROLES.MANAGER_LOCAL || user.role === ROLES.GUICHETIER) && user.filialeId) {
      try {
        const filiale = await filialeService.getFilialeDetail(user.filialeId);
        user.filialeNom = filiale.nom || filiale.name;
        user.filialeCode = filiale.code;
        user.filialeVille = filiale.ville;
      } catch (error) {
        console.warn("[useAuth] Impossible de récupérer la filiale:", error);
        user.filialeNom = "Filiale non trouvée";
      }
    }

    return user;
  } catch (error) {
    console.warn("[useAuth] Erreur enrichissement:", error);
    return user;
  }
};

// ─── Construction de l'objet user complet ─────────────────────────────────────
// Fusionne les champs du body de réponse + les champs du JWT (agence_id, filiale_id).
const buildUser = (data, accessToken) => {
  const jwt = decodeJwt(accessToken);
  return {
    id:         data.userId  || data.id,
    email:      data.email,
    name:       data.name,
    surname:    data.surname,
    role:       data.role,
    phone:      data.phone || data.telephone || null,
    photoUrl:   data.photoUrl || data.photo_url || null,
    // ✅ Présents dans le JWT mais absents du body login
    agenceId:   jwt.agence_id  || data.agenceId  || data.agence_id  || null,
    filialeId:  jwt.filiale_id || data.filialeId || data.filiale_id || null,
    // Champs additionnels
    createdAt:  data.createdAt || data.created_at || null,
  };
};

export const useAuth = () => {
  const { user, role, isAuthenticated, setUser, clearUser, setLoading } =
    useAuthStore();
  const navigate = useNavigate();

  // ─── LOGIN ──────────────────────────────────────────────────────────────────
  const login = async (credentials) => {
    setLoading(true);
    try {
      const data = await authService.login(credentials);
      // ✅ On extrait agence_id et filiale_id depuis le JWT
      let user = buildUser(data, data.accessToken);
      
      // ✅ Enrichir avec les noms d'agence et filiale
      user = await enrichUserWithAgencyInfo(user);
      
      setUser(user);
      toast.success(`Bienvenue, ${user.name} ${user.surname || ''} !`);
      redirectByRole(user.role, navigate);
    } catch (error) {
      toast.error(error.response?.data?.message || "Identifiants incorrects");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ─── LOGOUT ─────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      clearUser();
      navigate("/login");
      toast.success("Déconnexion réussie");
    }
  };

  // ─── REGISTER ───────────────────────────────────────────────────────────────
  const register = async (userData) => {
    setLoading(true);
    try {
      await authService.register(userData);
      toast.success("Compte créé avec succès !");
      navigate("/login");
      return { success: true };
    } catch (error) {
      const status  = error.response?.status;
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Erreur lors de l'inscription.";
      if (status !== 409) {
        toast.error(
          status === 504
            ? "Le serveur est momentanément indisponible. Réessayez."
            : message
        );
      }
      return { success: false, errorCode: status, message };
    } finally {
      setLoading(false);
    }
  };

  // ─── Rafraîchir les infos utilisateur ───────────────────────────────────────
  const refreshUserInfo = async () => {
    if (!user?.id) return null;
    
    setLoading(true);
    try {
      const { authService: auth } = await import("../services/authService");
      const meData = await auth.me();
      
      let refreshedUser = {
        ...user,
        ...meData,
        phone: meData.phone || meData.telephone || user.phone,
      };
      
      refreshedUser = await enrichUserWithAgencyInfo(refreshedUser);
      setUser(refreshedUser);
      return refreshedUser;
    } catch (error) {
      console.error("[useAuth] Erreur rafraîchissement:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { 
    user, 
    role, 
    isAuthenticated, 
    login, 
    logout, 
    register,
    refreshUserInfo 
  };
};

// ─── REDIRECT BY ROLE ─────────────────────────────────────────────────────────
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
