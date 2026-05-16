import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell, ChevronDown, LogOut, User, Menu, X,
  Search, Ticket, Home, Edit3,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import { useProfile } from "../../hooks/useProfile";
import EditProfilModal from "../shared/EditProfilModal";
import NjilaLogo from "../../components/ui/NjilaLogo"; 
import toast from "react-hot-toast";

export default function Navbar() {
  const { user: authUser, isAuthenticated } = useAuthStore();
  const { logout } = useAuth();
  const { profil, updateProfil, isUpdating, updatePhoto } = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const navigate = useNavigate();

  // Données affichées : profil user-service > store auth
  const displayName    = profil?.name        || authUser?.name    || "";
  const displaySurname = profil?.surname      || authUser?.surname || "";
  const displayEmail   = profil?.email        || authUser?.email   || "";
  const displayPhoto   = profil?.photoProfil  || profil?.photo_url || null;
  const initiales =
    `${displayName?.[0] || ""}${displaySurname?.[0] || ""}`.toUpperCase() || "?";

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

  return (
    <>
      <EditProfilModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        profil={profil}
        onSave={handleSaveProfil}
        isSaving={isUpdating}
        onPhotoUploaded={handlePhotoUploaded}
      />

      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* ✅ Logo NJILA avec image */}
            <NjilaLogo size="md" />

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                to="/recherche"
                className="text-sm font-semibold text-slate-600 hover:text-[#135bec] transition-colors"
              >
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
                      <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#135bec] flex items-center justify-center flex-shrink-0">
                        {displayPhoto
                          ? <img src={displayPhoto} alt="avatar" className="w-full h-full object-cover" />
                          : <span className="text-white text-xs font-extrabold">{initiales}</span>}
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        {displaySurname} {displayName}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">

                          {/* En-tête dropdown */}
                          <div className="px-4 py-3 border-b border-slate-50 mb-1 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#135bec] flex items-center justify-center flex-shrink-0">
                              {displayPhoto
                                ? <img src={displayPhoto} alt="avatar" className="w-full h-full object-cover" />
                                : <span className="text-white text-sm font-extrabold">{initiales}</span>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {displaySurname} {displayName}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{displayEmail}</p>
                            </div>
                          </div>

                          <Link
                            to="/voyageur"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Home className="w-4 h-4 text-slate-400" /> Tableau de bord
                          </Link>
                          <Link
                            to="/voyageur/reservations"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Ticket className="w-4 h-4 text-slate-400" /> Mes réservations
                          </Link>
                          <Link
                            to="/voyageur/profil"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <User className="w-4 h-4 text-slate-400" /> Mon profil
                          </Link>
                          <button
                            onClick={() => { setMenuOpen(false); setEditOpen(true); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-slate-400" /> Modifier mon profil
                          </button>

                          <div className="border-t border-slate-100 mt-1 pt-1">
                            <button
                              onClick={logout}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                            >
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
                  <Link
                    to="/login"
                    className="text-sm font-bold text-slate-600 hover:text-[#135bec] px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Se connecter
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-extrabold bg-[#135bec] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-[#135bec]/30"
                  >
                    S'inscrire
                  </Link>
                </>
              )}
            </div>

            {/* Mobile right */}
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
                {mobileOpen
                  ? <X className="w-4 h-4 text-slate-600" />
                  : <Menu className="w-4 h-4 text-slate-600" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 shadow-lg">
            <div className="space-y-1 mb-4">
              {[
                { label: "Trajets",              href: "/recherche" },
                { label: "Comment ça marche",    href: "/#comment" },
                { label: "Aide",                 href: "/#aide" },
              ].map(({ label, href }) => (
                <Link
                  key={label}
                  to={href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-3 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl"
                >
                  {label}
                </Link>
              ))}
            </div>

            {isAuthenticated ? (
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-3 px-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#135bec] flex items-center justify-center flex-shrink-0">
                    {displayPhoto
                      ? <img src={displayPhoto} alt="avatar" className="w-full h-full object-cover" />
                      : <span className="text-white text-sm font-extrabold">{initiales}</span>}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      {displaySurname} {displayName}
                    </p>
                    <p className="text-xs text-slate-400">{displayEmail}</p>
                  </div>
                </div>
                <Link
                  to="/voyageur"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2.5 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl"
                >
                  Mon espace voyageur
                </Link>
                <Link
                  to="/voyageur/reservations"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2.5 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl"
                >
                  Mes réservations
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); setEditOpen(true); }}
                  className="w-full text-left py-2.5 px-3 text-sm font-semibold text-[#135bec] hover:bg-blue-50 rounded-xl"
                >
                  Modifier mon profil
                </button>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="w-full text-left py-2.5 px-3 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl mt-1"
                >
                  Se déconnecter
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 text-center text-sm font-bold text-slate-700 bg-slate-100 rounded-xl"
                >
                  Se connecter
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 text-center text-sm font-extrabold text-white bg-[#135bec] rounded-xl"
                >
                  S'inscrire gratuitement
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
