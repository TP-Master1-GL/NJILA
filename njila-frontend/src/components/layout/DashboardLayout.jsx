import { useState } from "react";
import Sidebar from "./Sidebar";
import { Menu, Bell, Search, Sun, Moon } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useThemeStore } from "../../store/themeStore";
import { useProfile } from "../../hooks/useProfile";
import { useAgence } from "../../hooks/useAgence";
import { ROLES } from "../../utils/constants";
import NjilaLogo from "../ui/NjilaLogo";

export default function DashboardLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user: authUser, role } = useAuthStore();
  const { darkMode, toggleDarkMode } = useThemeStore();

  const { profil } = useProfile();
  const { agence } = useAgence(authUser?.agenceId);

  const displayPhoto   = profil?.photoProfil || profil?.photo_url || null;
  const displayName    = profil?.name    || authUser?.name    || "";
  const displaySurname = profil?.surname || authUser?.surname || "";
  const initiales      = `${displayName?.[0] || ""}${displaySurname?.[0] || ""}`.toUpperCase() || "?";

  const isAdmin = role === ROLES.ADMIN;

  // Badge agence dans la topbar
  const getAgencyDisplay = () => {
    if (role === ROLES.ADMIN)          return { text: "Administration", color: "text-purple-600" };
    if (role === ROLES.MANAGER_GLOBAL) return { text: agence?.name || "Multi-agences", color: "text-emerald-600" };
    if (agence?.name) {
      const filialeText = authUser?.filialeNom || "";
      return {
        text:  filialeText ? `${agence.name} / ${filialeText}` : agence.name,
        color: "text-blue-600",
      };
    }
    return { text: role?.replace(/_/g, " ") || "", color: "text-slate-500" };
  };
  const agencyDisplay = getAgencyDisplay();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ── */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 md:px-6 py-3.5 flex items-center gap-4 flex-shrink-0">

          {/* Burger mobile */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center"
          >
            <Menu className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>

          {/* NjilaLogo visible dans la topbar uniquement sur mobile pour l'admin
              (sur desktop il est déjà dans la sidebar) */}
          {isAdmin && (
            <div className="lg:hidden">
              <NjilaLogo size="sm" />
            </div>
          )}

          {/* Search (non-admin uniquement, ou masqué pour admin si souhaité) */}
          {!isAdmin && (
            <div className="hidden md:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/30 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Search admin */}
          {isAdmin && (
            <div className="hidden md:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher une agence, un utilisateur..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/30 dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-2">

            {/* Badge agence / admin */}
            {agencyDisplay.text && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {isAdmin ? (
                  /* Admin : mini NjilaLogo dans le badge */
                  <div className="w-3.5 h-3.5 bg-[#135bec] rounded-sm flex items-center justify-center">
                    <span className="text-white font-black" style={{ fontSize: "7px" }}>NJ</span>
                  </div>
                ) : (agence?.logo_url || agence?.logo_image) ? (
                  <img src={agence.logo_url || agence.logo_image} alt="logo" className="w-4 h-4 rounded object-cover" />
                ) : (
                  <div className="w-3.5 h-3.5 bg-[#135bec] rounded-sm" />
                )}
                <span className={`text-xs font-medium ${agencyDisplay.color}`}>
                  {agencyDisplay.text}
                </span>
              </div>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {darkMode
                ? <Sun  className="w-4 h-4 text-yellow-500" />
                : <Moon className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Notifications */}
            <button className="relative w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
              <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-800" />
            </button>

            {/* Avatar + nom */}
            <div className="flex items-center gap-2 ml-1">
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#135bec] flex items-center justify-center flex-shrink-0">
                {displayPhoto
                  ? <img src={displayPhoto} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-white text-xs font-extrabold">{initiales}</span>}
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {displaySurname} {displayName}
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                  {role?.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ── Contenu ── */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}