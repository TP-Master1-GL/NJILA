import { useAuthStore } from "../../store/authStore";
import { useQuery } from "@tanstack/react-query";
import { bookingService } from "../../services/bookingService";
import PublicLayout from "../../components/layout/PublicLayout";
import { useNavigate } from "react-router-dom";
import {
  Ticket, Clock, CheckCircle, XCircle, Search, ArrowRight,
  Star, Bus, ChevronRight, Calendar, Gift, User, Home,
  CreditCard, TrendingUp, MapPin, Zap
} from "lucide-react";
import { formatMontant, formatDate } from "../../utils/formatters";

const QUICK_ROUTES = [
  { from: "DLA", to: "YDE", fromFull: "Douala", toFull: "Yaoundé", price: 3500, duration: "4h30" },
  { from: "YDE", to: "DLA", fromFull: "Yaoundé", toFull: "Douala", price: 3500, duration: "4h30" },
  { from: "DLA", to: "BAF", fromFull: "Douala", toFull: "Bafoussam", price: 5000, duration: "6h" },
  { from: "YDE", to: "GAR", fromFull: "Yaoundé", toFull: "Garoua", price: 8500, duration: "9h" },
];

const statutCfg = {
  PAYEE:      { label: "Confirmée",  className: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  EN_ATTENTE: { label: "En attente", className: "bg-amber-100 text-amber-700 border border-amber-200" },
  ANNULEE:    { label: "Annulée",    className: "bg-red-100 text-red-700 border border-red-200" },
  CONFIRMEE:  { label: "Confirmée",  className: "bg-blue-100 text-blue-700 border border-blue-200" },
  EMBARQUEE:  { label: "Embarquée",  className: "bg-slate-100 text-slate-600 border border-slate-200" },
};

export default function VoyageurDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", user?.id],
    queryFn: () => bookingService.getMesReservations(user.id),
    enabled: !!user?.id,
  });

  const stats = [
    { label: "Total",      value: reservations?.length || 0,                                       icon: Ticket,      bg: "bg-blue-50",    ic: "text-[#135bec]" },
    { label: "Confirmées", value: reservations?.filter(r => r.statut === "PAYEE").length || 0,      icon: CheckCircle, bg: "bg-emerald-50", ic: "text-emerald-600" },
    { label: "En cours",   value: reservations?.filter(r => r.statut === "EN_ATTENTE").length || 0, icon: Clock,       bg: "bg-amber-50",   ic: "text-amber-600" },
    { label: "Annulées",   value: reservations?.filter(r => r.statut === "ANNULEE").length || 0,    icon: XCircle,     bg: "bg-red-50",     ic: "text-red-500" },
  ];

  return (
    <PublicLayout>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        .anim-1 { animation: fadeSlideUp .4s ease both; }
        .anim-2 { animation: fadeSlideUp .4s .07s ease both; }
        .anim-3 { animation: fadeSlideUp .4s .14s ease both; }
        .anim-4 { animation: fadeSlideUp .4s .21s ease both; }
        .anim-5 { animation: fadeSlideUp .4s .28s ease both; }
        .anim-6 { animation: fadeSlideUp .4s .35s ease both; }
        .card-hover { transition: transform .2s ease, box-shadow .2s ease; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(19,91,236,.1); }
      `}</style>

      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">

        {/* ── Hero salutation ── */}
        <div className="anim-1 relative overflow-hidden bg-gradient-to-br from-[#135bec] to-blue-800 rounded-2xl p-6 mb-6 text-white">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Bienvenue de retour 👋</p>
              <h1 className="text-2xl font-extrabold mt-0.5">{user?.nom} {user?.prenom}</h1>
              <p className="text-blue-200 text-sm mt-1">{user?.email}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black border-2 border-white/30 backdrop-blur-sm">
              {user?.nom?.[0]}{user?.prenom?.[0]}
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-3 mt-5 flex-wrap">
            <button
              onClick={() => navigate("/recherche")}
              className="flex items-center gap-2 bg-white text-[#135bec] font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-all active:scale-95"
            >
              <Search className="w-4 h-4" /> Rechercher un voyage
            </button>
            <button
              onClick={() => navigate("/voyageur/reservations")}
              className="flex items-center gap-2 bg-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/30 transition-all border border-white/30 active:scale-95"
            >
              Mes billets <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="anim-2 grid grid-cols-4 gap-3 mb-6">
          {stats.map(({ label, value, icon: Icon, bg, ic }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 md:p-4 text-center card-hover cursor-default`}>
              <div className="flex justify-center mb-2">
                <Icon className={`w-4 h-4 md:w-5 md:h-5 ${ic}`} />
              </div>
              <p className="text-xl md:text-2xl font-extrabold text-slate-900">{value}</p>
              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Promos ── */}
        <div className="anim-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {[
            { title: "Voyage en VIP", sub: "-20% ce weekend", gradient: "from-[#135bec] to-blue-700", icon: Star, badge: "Offre limitée" },
            { title: "Fidélité NJILA", sub: "Encore 3 voyages pour un billet gratuit!", gradient: "from-emerald-500 to-emerald-700", icon: Gift, badge: "Programme" },
          ].map(({ title, sub, gradient, icon: Icon, badge }) => (
            <div key={title} className={`relative overflow-hidden bg-gradient-to-r ${gradient} rounded-2xl p-5 text-white cursor-pointer card-hover`}>
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full pointer-events-none" />
              <div className="flex items-start justify-between mb-3">
                <Icon className="w-6 h-6 opacity-90" />
                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full border border-white/30">{badge}</span>
              </div>
              <p className="font-extrabold text-lg">{title}</p>
              <p className="text-white/80 text-sm mt-0.5">{sub}</p>
              <p className="text-white/70 text-xs mt-3 flex items-center gap-1 font-semibold">
                En savoir plus <ArrowRight className="w-3 h-3" />
              </p>
            </div>
          ))}
        </div>

        {/* ── Trajets rapides ── */}
        <div className="anim-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#135bec]" /> Trajets populaires
            </h2>
            <button onClick={() => navigate("/recherche")} className="text-xs text-[#135bec] font-bold hover:underline">Voir tout</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ROUTES.map(({ from, to, fromFull, toFull, price, duration }) => (
              <button
                key={`${from}-${to}`}
                onClick={() => navigate("/recherche")}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-[#135bec]/30 hover:bg-blue-50/50 transition-all text-left group active:scale-[0.98]"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-extrabold text-slate-900">{from}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="text-sm font-extrabold text-slate-900">{to}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">{duration}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-[#135bec]">{formatMontant(price)}</p>
                  <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-[#135bec] ml-auto mt-0.5 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Accès rapide ── */}
        <div className="anim-5 grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Paiements", icon: CreditCard, path: null, color: "text-purple-600 bg-purple-50" },
            { label: "Notifications", icon: Calendar, path: null, color: "text-orange-600 bg-orange-50" },
            { label: "Mon profil", icon: User, path: "/voyageur/profil", color: "text-slate-600 bg-slate-100" },
          ].map(({ label, icon: Icon, path, color }) => (
            <button
              key={label}
              onClick={() => path && navigate(path)}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Dernières réservations ── */}
        <div className="anim-6 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-extrabold text-slate-900">Réservations récentes</h2>
            <button
              onClick={() => navigate("/voyageur/reservations")}
              className="text-xs text-[#135bec] font-bold hover:underline flex items-center gap-1"
            >
              Tout voir <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-[#135bec] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : !reservations?.length ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Ticket className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-500">Aucune réservation</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Réservez votre premier trajet</p>
              <button
                onClick={() => navigate("/recherche")}
                className="text-sm font-bold text-white bg-[#135bec] px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors active:scale-95"
              >
                Rechercher un voyage
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {reservations.slice(0, 4).map((r, idx) => {
                const cfg = statutCfg[r.statut] || {};
                return (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/voyageur/billet/${r.id}`)}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#135bec]/20 transition-colors">
                        <Bus className="w-5 h-5 text-[#135bec]" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">Réservation #{r.id}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{r.codeFiliale || "—"} · {r.canal}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">{formatMontant(r.montantTotal)}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#135bec] transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile spacer */}
        <div className="h-20 md:hidden" />
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-100 safe-area-pb z-50">
        <div className="grid grid-cols-4 px-2">
          {[
            { icon: Home,   label: "Accueil",   path: "/voyageur" },
            { icon: Search, label: "Recherche", path: "/recherche" },
            { icon: Ticket, label: "Billets",   path: "/voyageur/reservations" },
            { icon: User,   label: "Profil",    path: "/voyageur/profil" },
          ].map(({ icon: Icon, label, path }) => {
            const active = window.location.pathname === path;
            return (
              <button key={path} onClick={() => navigate(path)}
                className={`flex flex-col items-center justify-center py-3 gap-1 transition-colors ${active ? "text-[#135bec]" : "text-slate-400"}`}>
                <Icon className={`w-5 h-5 transition-transform ${active ? "scale-110" : ""}`} />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
}