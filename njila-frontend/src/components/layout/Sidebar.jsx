import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bus, LayoutDashboard, Truck, Calendar, Users, BarChart3,
  Ticket, LogOut, MapPin, CreditCard, Building2, ChevronLeft,
  ChevronRight, X, Network, Route, UserCog,
  Mail, Phone, Building, MapPin as MapPinIcon, Briefcase,
  UserCircle, Edit3, Loader2,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { useProfile } from "../../hooks/useProfile";
import { useAgence } from "../../hooks/useAgence";
import { cn } from "../../utils/cn";
import { ROLES } from "../../utils/constants";
import EditProfilModal from "../shared/EditProfilModal";
import EditAgenceModal from "../shared/EditAgenceModal";
import toast from "react-hot-toast";

// ─── Liens navigation (identiques à avant) ────────────────────────────────────
const BASE_MANAGER_LINKS = [
  { to: "/manager",            icon: LayoutDashboard, label: "Dashboard"    },
  { to: "/manager/voyages",    icon: Calendar,        label: "Voyages"      },
  { to: "/manager/stats",      icon: BarChart3,       label: "Statistiques" },
];
const GLOBAL_ONLY_LINKS = [
  { to: "/manager/flotte",   icon: Truck,   label: "Flotte"   },
  { to: "/manager/trajets",  icon: Route,   label: "Trajets"  },
  { to: "/manager/filiales", icon: Network, label: "Filiales" },
];
const LOCAL_ONLY_LINKS = [
  { to: "/manager/personnel", icon: UserCog, label: "Personnel" },
  { to: "/manager/chauffeurs", icon: Users,           label: "Chauffeurs"   },
];
const guichetierLinks = [
  { to: "/guichet",           icon: Ticket, label: "Point de vente"    },
  { to: "/guichet/scan",      icon: MapPin, label: "Scanner billet"    },
  { to: "/guichet/passagers", icon: Users,  label: "Passagers du jour" },
];
const adminLinks = [
  { to: "/admin",              icon: LayoutDashboard, label: "Dashboard"    },
  { to: "/admin/agences",      icon: Building2,       label: "Agences"      },
  { to: "/admin/abonnements",  icon: CreditCard,      label: "Abonnements"  },
  { to: "/admin/utilisateurs", icon: Users,           label: "Utilisateurs" },
];
function getLinks(role) {
  switch (role) {
    case ROLES.ADMIN:         return adminLinks;
    case ROLES.GUICHETIER:    return guichetierLinks;
    case ROLES.MANAGER_GLOBAL: return [...BASE_MANAGER_LINKS, ...GLOBAL_ONLY_LINKS];
    case ROLES.MANAGER_LOCAL:  return [...BASE_MANAGER_LINKS, ...LOCAL_ONLY_LINKS];
    default:                   return BASE_MANAGER_LINKS;
  }
}

// ─── Modal détail profil (lecture seule + bouton éditer) ──────────────────────
function ProfileViewModal({ isOpen, onClose, profil, agence, role, onEditProfil, onEditAgence }) {
  const [tab, setTab] = useState("info");
  if (!isOpen) return null;

  const displayPhoto   = profil?.photoProfil || profil?.photo_url;
  const displayName    = profil?.name    || "";
  const displaySurname = profil?.surname || "";
  const initiales      = `${displayName?.[0] || ""}${displaySurname?.[0] || ""}`.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header dégradé */}
        <div className="bg-gradient-to-r from-[#135bec] to-blue-600 px-6 pt-8 pb-12 text-center">
          <div className="w-24 h-24 mx-auto bg-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white overflow-hidden">
            {displayPhoto
              ? <img src={displayPhoto} alt="profil" className="w-full h-full object-cover" />
              : <span className="text-3xl font-extrabold text-[#135bec]">{initiales}</span>}
          </div>
          <h3 className="text-white font-bold text-xl mt-3">{displaySurname} {displayName}</h3>
          <p className="text-blue-200 text-sm mt-1 capitalize">{role?.replace(/_/g, " ")}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4">
          {["info", "agency"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === t ? "text-[#135bec] border-b-2 border-[#135bec]" : "text-slate-400 hover:text-slate-600"
              }`}>
              {t === "info" ? "Informations" : "Agence"}
            </button>
          ))}
        </div>

        {/* Tab info */}
        {tab === "info" && (
          <div className="px-6 py-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{profil?.email || "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{profil?.phone || "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MapPinIcon className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{profil?.adresse || "—"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700 capitalize">{role?.replace(/_/g, " ")}</span>
            </div>
          </div>
        )}

        {/* Tab agence */}
        {tab === "agency" && (
          <div className="px-6 py-4 space-y-3">
            {agence ? (
              <>
                {/* Logo agence */}
                {(agence.logo_url || agence.logo_image) && (
                  <div className="flex justify-center mb-2">
                    <img src={agence.logo_url || agence.logo_image} alt="logo" className="w-16 h-16 rounded-xl object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Building className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700 font-semibold">{agence.name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{agence.telephone || "—"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{agence.email_officiel || "—"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPinIcon className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{agence.adresse || "—"}</span>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">Aucune agence associée</p>
            )}
          </div>
        )}

        {/* Footer avec boutons d'édition */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          {/* Modifier profil (tous les rôles) */}
          <button onClick={() => { onClose(); onEditProfil(); }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-[#135bec] text-[#135bec] font-bold rounded-xl hover:bg-blue-50 transition-colors text-sm">
            <Edit3 className="w-3.5 h-3.5" /> Mon profil
          </button>

          {/* Modifier agence (manager global uniquement) */}
          {role === ROLES.MANAGER_GLOBAL && agence && (
            <button onClick={() => { onClose(); onEditAgence(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#135bec] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm">
              <Building2 className="w-3.5 h-3.5" /> L'agence
            </button>
          )}

          {/* Fermer si pas de bouton agence */}
          {role !== ROLES.MANAGER_GLOBAL && (
            <button onClick={onClose}
              className="flex-1 py-2.5 bg-[#135bec] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-sm">
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


export default function Sidebar({ onMobileClose, mobileOpen }) {
  const location = useLocation();
  const { logout } = useAuth();
  const { user: authUser, role } = useAuthStore();

  // ✅ Données réelles depuis les services
  const { profil, updateProfil, isUpdating, updatePhoto } = useProfile();
  const agenceId = authUser?.agenceId;
  const { agence, updateAgence, isUpdating: isUpdatingAgence, updateLogo } = useAgence(agenceId);

  const [collapsed,        setCollapsed]        = useState(false);
  const [viewModalOpen,    setViewModalOpen]    = useState(false);
  const [editProfilOpen,   setEditProfilOpen]   = useState(false);
  const [editAgenceOpen,   setEditAgenceOpen]   = useState(false);

  const links = getLinks(role);

  // Affichage
  const displayPhoto   = profil?.photoProfil || profil?.photo_url || null;
  const displayName    = profil?.name    || authUser?.name    || "";
  const displaySurname = profil?.surname || authUser?.surname || "";
  const initiales      = `${displayName?.[0] || ""}${displaySurname?.[0] || ""}`.toUpperCase() || "?";

  // Logo agence
  const logoUrl = agence?.logo_url || agence?.logo_image || null;
  const agenceShort = agence?.name
    ? agence.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : role === ROLES.ADMIN ? "NJ" : "MG";
  const agenceName = role === ROLES.ADMIN
    ? "NJILA Platform"
    : (agence?.name || authUser?.agenceNom || "Chargement...");

  const handleSaveProfil = (form) => {
    updateProfil(form, {
      onSuccess: () => { setEditProfilOpen(false); toast.success("Profil mis à jour !"); },
      onError:   () => toast.error("Erreur lors de la mise à jour"),
    });
  };

  const handlePhotoUploaded = (url) => {
    updatePhoto({ photoProfil: url }, {
      onError: () => toast.error("Erreur lors de la mise à jour de la photo"),
    });
  };

  const handleSaveAgence = (form) => {
    updateAgence(form, {
      onSuccess: () => { setEditAgenceOpen(false); toast.success("Agence mise à jour !"); },
      onError:   () => toast.error("Erreur lors de la mise à jour"),
    });
  };

  const handleLogoUploaded = (url) => {
    updateLogo(url, {
      onError: () => toast.error("Erreur lors de la mise à jour du logo"),
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={onMobileClose} />
      )}

      {/* Modals */}
      <ProfileViewModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        profil={profil}
        agence={agence}
        role={role}
        onEditProfil={() => setEditProfilOpen(true)}
        onEditAgence={() => setEditAgenceOpen(true)}
      />
      <EditProfilModal
        isOpen={editProfilOpen}
        onClose={() => setEditProfilOpen(false)}
        profil={profil}
        onSave={handleSaveProfil}
        isSaving={isUpdating}
        onPhotoUploaded={handlePhotoUploaded}
      />
      <EditAgenceModal
        isOpen={editAgenceOpen}
        onClose={() => setEditAgenceOpen(false)}
        agence={agence}
        onSave={handleSaveAgence}
        isSaving={isUpdatingAgence}
        onLogoUploaded={handleLogoUploaded}
      />

      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col bg-slate-900 transition-all duration-300 z-50",
        "hidden lg:flex",
        collapsed ? "w-[68px]" : "w-60",
        "fixed lg:relative inset-y-0 left-0",
        mobileOpen ? "flex w-72" : "hidden lg:flex"
      )}>

        {/* Logo agence */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 bg-[#135bec]">
            {logoUrl
              ? <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
              : <span className="text-white font-black text-sm">{agenceShort}</span>}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white font-extrabold text-sm truncate">{agenceName}</p>
              <p className="text-slate-400 text-[10px] truncate mt-0.5">Powered by NJILA</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded-lg items-center justify-center transition-colors flex-shrink-0">
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              : <ChevronLeft  className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          <button onClick={onMobileClose} className="lg:hidden w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {links.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to} onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-[#135bec] text-white shadow-lg shadow-[#135bec]/30"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                  collapsed && "justify-center"
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-2 py-3 border-t border-slate-800">
          {/* Clic → modal détail profil */}
          <button onClick={() => setViewModalOpen(true)} className="w-full text-left">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors">
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#135bec] flex items-center justify-center flex-shrink-0">
                {displayPhoto
                  ? <img src={displayPhoto} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-white text-xs font-extrabold">{initiales}</span>}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {displaySurname} {displayName}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate capitalize">
                    {role?.replace(/_/g, " ")}
                  </p>
                  {agenceName && agenceName !== "NJILA Platform" && agenceName !== "Chargement..." && (
                    <p className="text-[9px] text-slate-600 truncate mt-0.5">{agenceName}</p>
                  )}
                </div>
              )}
            </div>
          </button>

          <button onClick={logout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 mt-1 text-sm text-red-400 hover:bg-red-900/20 rounded-xl transition-colors",
              collapsed && "justify-center"
            )}>
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
