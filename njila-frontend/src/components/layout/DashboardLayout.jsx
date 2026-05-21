import { useState } from "react";
import Sidebar from "./Sidebar";
import {
  Menu, Bell, Search, Sun, Moon,
  ChevronDown, LayoutDashboard, Ticket,
  User, Edit3, Lock, LogOut,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useThemeStore } from "../../store/themeStore";
import { useProfile } from "../../hooks/useProfile";
import { useAgence } from "../../hooks/useAgence";
import { useAuth } from "../../hooks/useAuth";
import { ROLES } from "../../utils/constants";
import NjilaLogo from "../ui/NjilaLogo";
import EditProfilModal from "../shared/EditProfilModal";
import ChangePasswordModal from "../shared/ChangePasswordModal";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard par rôle
// ─────────────────────────────────────────────────────────────────────────────
const DASHBOARD_BY_ROLE = {
  VOYAGEUR:        { path: "/voyageur",  label: "Mon espace voyageur" },
  GUICHETIER:      { path: "/guichet",   label: "Espace guichetier"   },
  MANAGER_LOCAL:   { path: "/manager",   label: "Tableau de bord"     },
  MANAGER_GLOBAL:  { path: "/manager",   label: "Tableau de bord"     },
  ADMINISTRATEUR:  { path: "/admin",     label: "Administration"      },
  ADMIN:           { path: "/admin",     label: "Administration"      },
};

const ROLES_WITH_RESERVATIONS = ["VOYAGEUR"];

export default function DashboardLayout({ children }) {
  const [mobileOpen,     setMobileOpen]     = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [editOpen,       setEditOpen]       = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);

  const { user: authUser } = useAuthStore();
  const { darkMode, toggleDarkMode } = useThemeStore();
  const { logout } = useAuth();
  const { profil, updateProfil, isUpdating, updatePhoto } = useProfile();
  const { agence } = useAgence(authUser?.agenceId);

  // ── Données affichées ─────────────────────────────────────────────────────
  const displayPhoto   = profil?.photoProfil || profil?.photo_url || null;
  const displayName    = profil?.name    || authUser?.name    || "";
  const displaySurname = profil?.surname || authUser?.surname || "";
  const displayEmail   = profil?.email   || authUser?.email   || "";
  const role           = authUser?.role  || profil?.role      || "";
  const initiales      = `${displayName?.[0] || ""}${displaySurname?.[0] || ""}`.toUpperCase() || "?";

  const dashboard       = DASHBOARD_BY_ROLE[role] || { path: "/", label: "Accueil" };
  const hasReservations = ROLES_WITH_RESERVATIONS.includes(role);
  const isAdmin         = role === ROLES.ADMIN || role === "ADMINISTRATEUR";

  // ── Handlers modals ───────────────────────────────────────────────────────
  const handleSaveProfil = (form) => {
    updateProfil(form, {
      onSuccess: () => { setEditOpen(false); toast.success("Profil mis à jour !"); },
      onError:   () => toast.error("Erreur lors de la mise à jour"),
    });
  };

  const handlePhotoUploaded = (url) => {
    updatePhoto({ photoProfil: url }, {
      onError: () => toast.error("Erreur lors de la mise à jour de la photo"),
    });
  };

  // ── Badge agence dans la topbar ───────────────────────────────────────────
  const getAgencyDisplay = () => {
    if (isAdmin)                        return { text: "Administration",              color: "text-purple-600" };
    if (role === ROLES.MANAGER_GLOBAL)  return { text: agence?.name || "Multi-agences", color: "text-emerald-600" };
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
    <>
      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <EditProfilModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        profil={profil}
        onSave={handleSaveProfil}
        isSaving={isUpdating}
        onPhotoUploaded={handlePhotoUploaded}
      />
      <ChangePasswordModal
        isOpen={changePassOpen}
        onClose={() => setChangePassOpen(false)}
      />

      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* ── Top bar ───────────────────────────────────────────────────── */}
          <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 md:px-6 py-3.5 flex items-center gap-4 flex-shrink-0">

            {/* Burger mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center"
            >
              <Menu className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>

            {/* Logo mobile admin */}
            {isAdmin && (
              <div className="lg:hidden">
                <NjilaLogo size="sm" />
              </div>
            )}

            {/* Search */}
            <div className="hidden md:flex items-center flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={isAdmin
                    ? "Rechercher une agence, un utilisateur..."
                    : "Rechercher..."}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/30 dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2">

              {/* Badge agence */}
              {agencyDisplay.text && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {isAdmin ? (
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

              {/* Dark mode */}
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

              {/* ── Avatar + Menu déroulant ── */}
              <div className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setMenuOpen(v => !v)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#135bec] flex items-center justify-center flex-shrink-0">
                    {displayPhoto
                      ? <img src={displayPhoto} alt="avatar" className="w-full h-full object-cover" />
                      : <span className="text-white text-xs font-extrabold">{initiales}</span>}
                  </div>
                  <div className="hidden sm:block text-left">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block leading-tight">
                      {displaySurname} {displayName}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize block">
                      {role?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform hidden sm:block ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                {/* ── Dropdown menu ── */}
                {menuOpen && (
                  <>
                    {/* Overlay transparent pour fermer */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuOpen(false)}
                    />

                    <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 py-2 z-50">

                      {/* En-tête : avatar + nom + email + rôle */}
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 mb-1 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#135bec] flex items-center justify-center flex-shrink-0">
                          {displayPhoto
                            ? <img src={displayPhoto} alt="avatar" className="w-full h-full object-cover" />
                            : <span className="text-white text-sm font-extrabold">{initiales}</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {displaySurname} {displayName}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{displayEmail}</p>
                          {role && (
                            <span className="inline-block mt-0.5 text-[9px] font-black uppercase tracking-widest bg-[#135bec]/10 text-[#135bec] px-1.5 py-0.5 rounded">
                              {role.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ── Tableau de bord ── */}
                      <a
                        href={dashboard.path}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-slate-400" />
                        {dashboard.label}
                      </a>

                      {/* ── Mes réservations (voyageur uniquement) ── */}
                      {hasReservations && (
                        <a
                          href="/voyageur/reservations"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Ticket className="w-4 h-4 text-slate-400" /> Mes réservations
                        </a>
                      )}

                      {/* ── Modifier mon profil ── */}
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-slate-400" /> Modifier mon profil
                      </button>

                      {/* ── Modifier mot de passe ── */}
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); setChangePassOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Lock className="w-4 h-4 text-slate-400" /> Modifier le mot de passe
                      </button>

                      {/* ── Déconnexion ── */}
                      <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                        <button
                          type="button"
                          onClick={() => { setMenuOpen(false); logout(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Se déconnecter
                        </button>
                      </div>
                    </div>
                  </>
                )}
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
    </>
  );
}