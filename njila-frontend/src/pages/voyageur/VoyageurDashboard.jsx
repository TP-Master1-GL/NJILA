import { useAuthStore } from "../../store/authStore";
import { useQuery } from "@tanstack/react-query";
import { bookingService } from "../../services/bookingService";
import PublicLayout from "../../components/layout/PublicLayout";
import { useNavigate } from "react-router-dom";
import {
  Ticket, Clock, CheckCircle, XCircle, Search, MapPin,
  ArrowRight, Star, Bus, ChevronRight, Calendar, TrendingUp,
  Gift, Bell, User, Home, Heart, CreditCard
} from "lucide-react";
import { formatMontant, formatDate } from "../../utils/formatters";

const QUICK_ROUTES = [
  { from: "DLA", to: "YDE", fromFull: "Douala", toFull: "Yaoundé", price: 3500 },
  { from: "YDE", to: "DLA", fromFull: "Yaoundé", toFull: "Douala", price: 3500 },
  { from: "DLA", to: "BAF", fromFull: "Douala", toFull: "Bafoussam", price: 5000 },
  { from: "YDE", to: "GAR", fromFull: "Yaoundé", toFull: "Garoua", price: 8500 },
];

const PROMO_CARDS = [
  { title: "Voyage en VIP", sub: "-20% ce weekend", gradient: "from-[#135bec] to-blue-700", icon: Star },
  { title: "Fidélité", sub: "Encore 3 voyages pour un billet gratuit!", gradient: "from-emerald-500 to-emerald-700", icon: Gift },
];

const statutCfg = {
  PAYEE:      { label: "Confirmée",   className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  EN_ATTENTE: { label: "En attente",  className: "bg-amber-100 text-amber-700 border-amber-200" },
  ANNULEE:    { label: "Annulée",     className: "bg-red-100 text-red-700 border-red-200" },
  CONFIRMEE:  { label: "Confirmée",   className: "bg-blue-100 text-blue-700 border-blue-200" },
  EMBARQUEE:  { label: "Embarquée",   className: "bg-slate-100 text-slate-600 border-slate-200" },
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
    { label: "Total",      value: reservations?.length || 0,                                        icon: Ticket,      bg: "bg-blue-50",    ic: "text-[#135bec]" },
    { label: "Confirmées", value: reservations?.filter(r => r.statut === "PAYEE").length || 0,       icon: CheckCircle, bg: "bg-emerald-50", ic: "text-emerald-600" },
    { label: "En cours",   value: reservations?.filter(r => r.statut === "EN_ATTENTE").length || 0,  icon: Clock,       bg: "bg-amber-50",   ic: "text-amber-600" },
    { label: "Annulées",   value: reservations?.filter(r => r.statut === "ANNULEE").length || 0,     icon: XCircle,     bg: "bg-red-50",     ic: "text-red-500" },
  ];

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">

        {/* ── Hero salutation ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#135bec] to-blue-800 rounded-2xl p-6 mb-6 text-white">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">Bienvenue de retour 👋</p>
              <h1 className="text-2xl font-extrabold mt-0.5">{user?.nom} {user?.prenom}</h1>
              <p className="text-blue-200 text-sm mt-1">{user?.email}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black border-2 border-white/30">
              {user?.nom?.[0]}{user?.prenom?.[0]}
            </div>
          </div>
          <div className="relative z-10 flex items-center gap-3 mt-4">
            <button
              onClick={() => navigate("/recherche")}
              className="flex items-center gap-2 bg-white text-[#135bec] font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
            >
              <Search className="w-4 h-4" /> Rechercher un voyage
            </button>
            <button
              onClick={() => navigate("/voyageur/reservations")}
              className="flex items-center gap-2 bg-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/30 transition-colors border border-white/30"
            >
              Mes billets <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {stats.map(({ label, value, icon: Icon, bg, ic }) => (
            <div key={label} className={`${bg} rounded-2xl p-3 md:p-4 text-center`}>
              <div className="flex justify-center mb-2">
                <Icon className={`w-4 h-4 md:w-5 md:h-5 ${ic}`} />
              </div>
              <p className="text-xl md:text-2xl font-extrabold text-slate-900">{value}</p>
              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Promos ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {PROMO_CARDS.map(({ title, sub, gradient, icon: Icon }) => (
            <div key={title} className={`relative overflow-hidden bg-gradient-to-r ${gradient} rounded-2xl p-5 text-white cursor-pointer hover:opacity-90 transition-opacity`}>
              <div className="absolute -top-3 -right-3 w-16 h-16 bg-white/10 rounded-full" />
              <Icon className="w-6 h-6 mb-3 opacity-90" />
              <p className="font-extrabold text-lg">{title}</p>
              <p className="text-white/80 text-sm mt-0.5">{sub}</p>
              <p className="text-white/70 text-xs mt-3 flex items-center gap-1 font-semibold">
                En savoir plus <ArrowRight className="w-3 h-3" />
              </p>
            </div>
          ))}
        </div>

        {/* ── Trajets rapides ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-slate-900">Trajets populaires</h2>
            <button onClick={() => navigate("/recherche")} className="text-xs text-[#135bec] font-bold hover:underline">Voir tout</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ROUTES.map(({ from, to, fromFull, toFull, price }) => (
              <button
                key={`${from}-${to}`}
                onClick={() => navigate("/recherche")}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-[#135bec]/30 hover:bg-blue-50/50 transition-all text-left group"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-extrabold text-slate-900">{from}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="text-sm font-extrabold text-slate-900">{to}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">{fromFull} → {toFull}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-[#135bec]">{formatMontant(price)}</p>
                  <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-[#135bec] ml-auto mt-0.5 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Dernières réservations ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-extrabold text-slate-900">Mes réservations récentes</h2>
            <button
              onClick={() => navigate("/voyageur/reservations")}
              className="text-xs text-[#135bec] font-bold hover:underline flex items-center gap-1"
            >
              Tout voir <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Chargement...</div>
          ) : !reservations?.length ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Ticket className="w-7 h-7 text-slate-300" />
              </div>
              <p className="font-semibold text-slate-500">Aucune réservation</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">Réservez votre premier trajet dès maintenant</p>
              <button
                onClick={() => navigate("/recherche")}
                className="text-sm font-bold text-white bg-[#135bec] px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Rechercher un voyage
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {reservations.slice(0, 4).map(r => {
                const cfg = statutCfg[r.statut] || {};
                return (
                  <div
                    key={r.id}
                    onClick={() => navigate(`/voyageur/billet/${r.id}`)}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Bus className="w-5 h-5 text-[#135bec]" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">Réservation #{r.id}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-slate-400">{r.codeFiliale || "—"} · {r.canal}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">{formatMontant(r.montantTotal)}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bottom nav mobile ── */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-100 safe-area-pb z-50">
          <div className="grid grid-cols-4 px-2">
            {[
              { icon: Home,    label: "Accueil",   path: "/voyageur" },
              { icon: Search,  label: "Recherche", path: "/recherche" },
              { icon: Ticket,  label: "Billets",   path: "/voyageur/reservations" },
              { icon: User,    label: "Profil",    path: "/voyageur/profil" },
            ].map(({ icon: Icon, label, path }) => {
              const active = window.location.pathname === path;
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                    active ? "text-[#135bec]" : "text-slate-400"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Spacer for bottom nav on mobile */}
        <div className="h-16 md:hidden" />
      </div>
    </PublicLayout>
  );
}