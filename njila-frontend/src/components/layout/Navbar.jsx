import { Link, useNavigate } from "react-router-dom";
import { Bus, Bell, ChevronDown, LogOut, User, Menu } from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../utils/cn";

export default function Navbar() {
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Bus className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">NJILA</span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/recherche" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
              Trajets
            </Link>
            <Link to="/#agences" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
              Agences
            </Link>
            <Link to="/#aide" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
              Aide
            </Link>
          </div>

          {/* Auth */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <button className="relative p-2 text-gray-400 hover:text-gray-600">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {user?.nom?.[0]}{user?.prenom?.[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-700 hidden md:block">
                      {user?.nom}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                      <Link
                        to="/voyageur/profil"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        <User className="w-4 h-4" /> Mon profil
                      </Link>
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                      >
                        <LogOut className="w-4 h-4" /> Se déconnecter
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-600 hover:text-primary-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Se connecter
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  S'inscrire
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
