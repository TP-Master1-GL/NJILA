import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bus, LayoutDashboard, Truck, Calendar, Users, BarChart3,
  Ticket, LogOut, MapPin, CreditCard, Building2, ChevronLeft,
  ChevronRight, Settings, Menu, X
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { cn } from "../../utils/cn";
import { ROLES } from "../../utils/constants";

const managerLinks = [
  { to: "/manager",            icon: LayoutDashboard, label: "Dashboard" },
  { to: "/manager/voyages",    icon: Calendar,        label: "Voyages" },
  { to: "/manager/flotte",     icon: Truck,           label: "Flotte" },
  { to: "/manager/chauffeurs", icon: Users,           label: "Chauffeurs" },
  { to: "/manager/stats",      icon: BarChart3,       label: "Statistiques" },
];

const guichetierLinks = [
  { to: "/guichet",            icon: Ticket,     label: "Point de vente" },
  { to: "/guichet/scan",       icon: MapPin,     label: "Scanner billet" },
  { to: "/guichet/passagers",  icon: Users,      label: "Passagers du jour" },
];

const adminLinks = [
  { to: "/admin",                icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/agences",        icon: Building2,       label: "Agences" },
  { to: "/admin/abonnements",    icon: CreditCard,      label: "Abonnements" },
  { to: "/admin/utilisateurs",   icon: Users,           label: "Utilisateurs" },
];

// Logos fictifs pour chaque agence
const AGENCY_LOGOS = {
  [ROLES.MANAGER_LOCAL]:  { name: "General Voyages", short: "GV", color: "#135bec" },
  [ROLES.MANAGER_GLOBAL]: { name: "General Voyages", short: "GV", color: "#135bec" },
  [ROLES.GUICHETIER]:     { name: "General Voyages", short: "GV", color: "#135bec" },
  [ROLES.ADMIN]:          { name: "NJILA Platform",  short: "NJ", color: "#6366f1" },
};

export default function Sidebar({ onMobileClose, mobileOpen }) {
  const location = useLocation();
  const { logout } = useAuth();
  const { user, role } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const links =
    role === ROLES.ADMIN          ? adminLinks     :
    role === ROLES.GUICHETIER     ? guichetierLinks:
    managerLinks;

  const agency = AGENCY_LOGOS[role] || { name: "NJILA", short: "NJ", color: "#135bec" };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col bg-slate-900 transition-all duration-300 z-50",
        // Desktop
        "hidden lg:flex",
        collapsed ? "w-[68px]" : "w-60",
        // Mobile
        "fixed lg:relative inset-y-0 left-0",
        mobileOpen ? "flex w-72" : "hidden lg:flex"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
          {/* Agency logo */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
            style={{ backgroundColor: agency.color }}
          >
            {agency.short}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white font-extrabold text-sm truncate">{agency.name}</p>
              <p className="text-slate-400 text-[10px] truncate mt-0.5">Powered by NJILA</p>
            </div>
          )}
          {/* Collapse btn desktop */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-7 h-7 bg-slate-800 hover:bg-slate-700 rounded-lg items-center justify-center transition-colors flex-shrink-0"
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              : <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            }
          </button>
          {/* Mobile close */}
          <button onClick={onMobileClose} className="lg:hidden w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {links.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={onMobileClose}
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

        {/* User + Logout */}
        <div className="px-2 py-3 border-t border-slate-800">
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0"
                style={{ backgroundColor: agency.color }}
              >
                {user?.nom?.[0]}{user?.prenom?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.nom} {user?.prenom}</p>
                <p className="text-[10px] text-slate-500 truncate capitalize">{role?.replace("_", " ")}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/20 rounded-xl transition-colors",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>
    </>
  );
}