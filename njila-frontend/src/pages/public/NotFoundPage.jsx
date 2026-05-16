import { useNavigate } from "react-router-dom";
import { Bus, Home, AlertTriangle, ArrowLeft, HelpCircle } from "lucide-react";
import Button from "../../components/ui/Button";
import { useAuthStore } from "../../store/authStore";

// Configuration des routes par rôle
const ROLE_CONFIG = {
  ADMIN: {
    dashboard: "/admin",
    label: "Administrateur",
    icon: "🛡️",
    color: "purple",
  },
  MANAGER_GLOBAL: {
    dashboard: "/manager",
    label: "Manager Global",
    icon: "🌍",
    color: "blue",
  },
  MANAGER_LOCAL: {
    dashboard: "/manager",
    label: "Manager Local",
    icon: "🏢",
    color: "indigo",
  },
  GUICHETIER: {
    dashboard: "/guichet",
    label: "Guichetier",
    icon: "🎫",
    color: "green",
  },
  VOYAGEUR: {
    dashboard: "/voyageur",
    label: "Voyageur",
    icon: "👤",
    color: "teal",
  },
};

// Couleurs par rôle
const COLOR_STYLES = {
  purple: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
    button: "bg-purple-600 hover:bg-purple-700",
    accent: "purple",
  },
  blue: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    button: "bg-blue-600 hover:bg-blue-700",
    accent: "blue",
  },
  indigo: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    border: "border-indigo-200",
    button: "bg-indigo-600 hover:bg-indigo-700",
    accent: "indigo",
  },
  green: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
    button: "bg-green-600 hover:bg-green-700",
    accent: "green",
  },
  teal: {
    bg: "bg-teal-100",
    text: "text-teal-700",
    border: "border-teal-200",
    button: "bg-teal-600 hover:bg-teal-700",
    accent: "teal",
  },
};

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

  // Obtenir la configuration du rôle
  const getRoleConfig = () => {
    if (!isAuthenticated || !user) return null;
    const role = user.role;
    return ROLE_CONFIG[role] || {
      dashboard: "/",
      label: "Utilisateur",
      icon: "👤",
      color: "gray",
    };
  };

  const roleConfig = getRoleConfig();
  const colors = roleConfig ? COLOR_STYLES[roleConfig.color] || COLOR_STYLES.blue : COLOR_STYLES.blue;

  const handleGoToDashboard = () => {
    if (roleConfig) {
      navigate(roleConfig.dashboard);
    } else {
      navigate("/");
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Animation d'erreur */}
        <div className="relative">
          <div className={`w-28 h-28 ${colors.bg} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse`}>
            <AlertTriangle className={`w-14 h-14 ${colors.text}`} />
          </div>
          <div className="absolute -top-2 -right-2 text-2xl animate-bounce">
            {roleConfig?.icon || "🔍"}
          </div>
        </div>

        {/* Code erreur */}
        <h1 className="text-9xl font-black text-slate-800 mb-2 tracking-tighter">404</h1>
        <div className={`w-24 h-1 ${colors.bg} mx-auto mb-4 rounded-full`} />

        {/* Message principal */}
        <p className="text-xl font-semibold text-slate-700 mb-2">Oups ! Page introuvable</p>
        <p className="text-slate-500 mb-6">
          La page que vous recherchez n'existe pas, a été déplacée ou vous n'avez pas les droits pour y accéder.
        </p>

        {/* Carte utilisateur connecté */}
        {isAuthenticated && user && roleConfig && (
          <div className={`bg-white rounded-xl p-4 mb-6 shadow-sm border ${colors.border}`}>
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm text-slate-500">Connecté en tant que</p>
                <p className={`font-bold ${colors.text}`}>
                  {roleConfig.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {user.email || user.username || ""}
                </p>
              </div>
              <div className={`w-10 h-10 ${colors.bg} rounded-full flex items-center justify-center text-xl`}>
                {roleConfig.icon}
              </div>
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        <div className="space-y-3">
          <Button
            size="lg"
            onClick={handleGoToDashboard}
            className={`w-full ${colors.button} text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-md flex items-center justify-center gap-2`}
          >
            <Home className="w-4 h-4" />
            {isAuthenticated && roleConfig
              ? `Accéder au tableau de bord ${roleConfig.label}`
              : "Retour à l'accueil"}
          </Button>

          <div className="flex gap-3">
            <button
              onClick={handleGoBack}
              className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Page précédente
            </button>

            <button
              onClick={() => navigate("/")}
              className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Bus className="w-4 h-4" />
              Accueil
            </button>
          </div>

          {/* Bouton déconnexion pour les utilisateurs connectés */}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="w-full text-slate-400 hover:text-red-500 text-sm font-medium py-2 transition-colors"
            >
              Se déconnecter
            </button>
          )}
        </div>

        {/* Liens d'aide */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
            <a href="/contact" className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              Support
            </a>
            <span>•</span>
            <a href="/faq" className="hover:text-blue-600 transition-colors">
              FAQ
            </a>
            <span>•</span>
            <a href="/legal" className="hover:text-blue-600 transition-colors">
              Mentions légales
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
