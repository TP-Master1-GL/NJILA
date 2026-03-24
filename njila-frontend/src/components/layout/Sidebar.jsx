import { Link, useLocation } from "react-router-dom";
import { Bus, LayoutDashboard, Truck, Calendar, Users, BarChart3, Ticket, LogOut, MapPin, CreditCard, Building2, Settings } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { cn } from "../../utils/cn";
import { ROLES } from "../../utils/constants";

const managerLinks = [
  { to: "/manager",           icon: LayoutDashboard, label: "Dashboard" },
  { to: "/manager/voyages",   icon: Calendar,        label: "Voyages" },
  { to: "/manager/flotte",    icon: Truck,           label: "Flotte" },
  { to: "/manager/chauffeurs",icon: Users,           label: "Chauffeurs" },
  { to: "/manager/stats",     icon: BarChart3,       label: "Statistiques" },
];

const guichetierLinks = [
  { to: "/guichet",           icon: Ticket,     label: "Point de vente" },
  { to: "/guichet/scan",      icon: MapPin,     label: "Scanner billet" },
  { to: "/guichet/passagers", icon: Users,      label: "Passagers du jour" },
];

const adminLinks = [
  { to: "/admin",                 icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/agences",         icon: Building2,       label: "Agences" },
  { to: "/admin/abonnements",     icon: CreditCard,      label: "Abonnements" },
  { to: "/admin/utilisateurs",    icon: Users,           label: "Utilisateurs" },
];

export default function Sidebar() {
  const location = useLocation();
  const { logout } = useAuth();
  const { user, role } = useAuthStore();

  const links =
    role === ROLES.ADMIN          ? adminLinks     :
    role === ROLES.GUICHETIER     ? guichetierLinks:
    managerLinks;

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <Bus className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900">NJILA</span>
      </div>

      {/* Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-primary-600 text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-sm font-bold">
            {user?.nom?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.nom}</p>
            <p className="text-xs text-gray-400 truncate">{role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
