import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, User, Menu, X, Search, Ticket, Home } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";

export default function Navbar() {
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const initiales = user ? `${user.nom?.[0] || ""}${user.prenom?.[0] || ""}`.toUpperCase() : "?";

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-9 h-9 bg-[#135bec] rounded-xl flex items-center justify-center shadow-sm shadow-[#135bec]/30">
              <span className="text-white font-black text-sm">NJ</span>
            </div>
            <span className="text-xl font-extrabold text-[#135bec] tracking-tight">NJILA</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/recherche" className="text-sm font-semibold text-slate-600 hover:text-[#135bec] transition-colors">
              Trajets
            </Link>
            <a href="#agences" className="text-sm font-semibold text-slate-600 hover:text-[#135bec] transition-colors">
              Agences
            </a>
            <a href="#comment" className="text-sm font-semibold text-slate-600 hover:text-[#135bec] transition-colors">
              Comment ça marche
            </a>
            <a href="#aide" className="text-sm font-semibold text-slate-600 hover:text-[#135bec] transition-colors">
              Aide
            </a>
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-[#135bec] rounded-xl flex items-center justify-center text-white text-xs font-extrabold">
                      {initiales}
                    </div>
                    <span className="text-sm font-bold text-slate-700">{user?.nom}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                        <div className="px-4 py-2.5 border-b border-slate-50 mb-1">
                          <p className="text-sm font-bold text-slate-900">{user?.nom} {user?.prenom}</p>
                          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                        </div>
                        <Link to="/voyageur" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => setMenuOpen(false)}>
                          <Home className="w-4 h-4 text-slate-400" /> Tableau de bord
                        </Link>
                        <Link to="/voyageur/reservations" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => setMenuOpen(false)}>
                          <Ticket className="w-4 h-4 text-slate-400" /> Mes réservations
                        </Link>
                        <Link to="/voyageur/profil" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          onClick={() => setMenuOpen(false)}>
                          <User className="w-4 h-4 text-slate-400" /> Mon profil
                        </Link>
                        <div className="border-t border-slate-100 mt-1 pt-1">
                          <button onClick={logout}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                            <LogOut className="w-4 h-4" /> Se déconnecter
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login"
                  className="text-sm font-bold text-slate-600 hover:text-[#135bec] px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                  Se connecter
                </Link>
                <Link to="/register"
                  className="text-sm font-extrabold bg-[#135bec] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-[#135bec]/30">
                  S'inscrire
                </Link>
              </>
            )}
          </div>

          {/* Mobile right section */}
          <div className="flex md:hidden items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={() => navigate("/recherche")}
                className="w-9 h-9 bg-[#135bec]/10 rounded-xl flex items-center justify-center"
              >
                <Search className="w-4 h-4 text-[#135bec]" />
              </button>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center"
            >
              {mobileOpen ? <X className="w-4 h-4 text-slate-600" /> : <Menu className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 shadow-lg">
          <div className="space-y-1 mb-4">
            {[
              { label: "Trajets", href: "/recherche" },
              { label: "Comment ça marche", href: "/#comment" },
              { label: "Aide", href: "/#aide" },
            ].map(({ label, href }) => (
              <Link key={label} to={href}
                onClick={() => setMobileOpen(false)}
                className="block py-3 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl">
                {label}
              </Link>
            ))}
          </div>

          {isAuthenticated ? (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3 mb-3 px-3">
                <div className="w-10 h-10 bg-[#135bec] rounded-xl flex items-center justify-center text-white text-sm font-extrabold">
                  {initiales}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{user?.nom} {user?.prenom}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
              </div>
              <Link to="/voyageur" className="block py-2.5 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl"
                onClick={() => setMobileOpen(false)}>
                Mon espace voyageur
              </Link>
              <Link to="/voyageur/reservations" className="block py-2.5 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl"
                onClick={() => setMobileOpen(false)}>
                Mes réservations
              </Link>
              <button onClick={() => { logout(); setMobileOpen(false); }}
                className="w-full text-left py-2.5 px-3 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl mt-1">
                Se déconnecter
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
              <Link to="/login" onClick={() => setMobileOpen(false)}
                className="w-full py-3 text-center text-sm font-bold text-slate-700 bg-slate-100 rounded-xl">
                Se connecter
              </Link>
              <Link to="/register" onClick={() => setMobileOpen(false)}
                className="w-full py-3 text-center text-sm font-extrabold text-white bg-[#135bec] rounded-xl shadow-sm shadow-[#135bec]/30">
                S'inscrire gratuitement
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}