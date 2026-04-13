import { useState } from "react";
import Sidebar from "./Sidebar";
import { Menu, Bell, Search } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

export default function DashboardLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuthStore();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-4 md:px-6 py-3.5 flex items-center gap-4 flex-shrink-0">
          {/* Mobile menu btn */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center"
          >
            <Menu className="w-4 h-4 text-slate-600" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors">
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </button>

            <div className="flex items-center gap-2 ml-1">
              <div className="w-8 h-8 bg-[#135bec] rounded-xl flex items-center justify-center text-white text-xs font-extrabold">
                {user?.nom?.[0]}{user?.prenom?.[0]}
              </div>
              <span className="text-sm font-bold text-slate-700 hidden sm:inline">{user?.nom}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}