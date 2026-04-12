import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import PublicLayout from "../../components/layout/PublicLayout";
import { useNavigate } from "react-router-dom";
import {
  Ticket, Download, XCircle, Clock, Calendar,
  Bus, Search, ChevronRight, CheckCircle,
  ArrowLeft, Home, User, Plus
} from "lucide-react";
import { formatMontant, formatDate } from "../../utils/formatters";
import toast from "react-hot-toast";

const TABS = ["Toutes", "Confirmées", "En attente", "Annulées"];

const statutCfg = {
  PAYEE:      { label: "Confirmée",  bg: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
  EN_ATTENTE: { label: "En attente", bg: "bg-amber-100 text-amber-700 border-amber-200",       icon: Clock },
  ANNULEE:    { label: "Annulée",    bg: "bg-red-100 text-red-700 border-red-200",             icon: XCircle },
  CONFIRMEE:  { label: "Confirmée",  bg: "bg-blue-100 text-blue-700 border-blue-200",          icon: CheckCircle },
  EMBARQUEE:  { label: "Embarquée",  bg: "bg-slate-100 text-slate-600 border-slate-200",       icon: Bus },
};

export default function MesReservations() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Toutes");
  const [search, setSearch] = useState("");

  const { data: reservations, isLoading, refetch } = useQuery({
    queryKey: ["reservations", user?.id],
    queryFn: () => bookingService.getMesReservations(user.id),
    enabled: !!user?.id,
  });

  const handleAnnuler = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Confirmer l'annulation ?")) return;
    try {
      await bookingService.annulerReservation(id, user.id);
      toast.success("Réservation annulée");
      refetch();
    } catch { toast.error("Impossible d'annuler"); }
  };

  const handleDownload = async (id, e) => {
    e.stopPropagation();
    try {
      const blob = await bookingService.telechargerBilletPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `billet-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("PDF non disponible"); }
  };

  const filtered = (reservations || []).filter(r => {
    const matchTab =
      activeTab === "Toutes" ? true :
      activeTab === "Confirmées" ? ["PAYEE", "CONFIRMEE"].includes(r.statut) :
      activeTab === "En attente" ? r.statut === "EN_ATTENTE" :
      r.statut === "ANNULEE";
    const matchSearch = search
      ? r.id.toString().includes(search) || r.codeFiliale?.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchTab && matchSearch;
  });

  return (
    <PublicLayout>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .page-enter { animation: fadeSlideUp .35s ease both; }
        .item-enter { animation: fadeSlideUp .3s ease both; }
        .card-hover { transition: transform .15s ease, box-shadow .15s ease; }
        .card-hover:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,.06); }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">

        {/* Header avec bouton retour */}
        <div className="page-enter flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/voyageur")}
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
            aria-label="Retour"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900">Mes réservations</h1>
            <p className="text-sm text-slate-400 mt-0.5">{reservations?.length || 0} au total</p>
          </div>
          <button
            onClick={() => navigate("/recherche")}
            className="flex items-center gap-2 bg-[#135bec] text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors active:scale-95"
          >
            <Plus className="w-4 h-4" /> Nouveau
          </button>
        </div>

        {/* Search */}
        <div className="page-enter relative mb-4" style={{ animationDelay: ".05s" }}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une réservation..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]/30 focus:border-[#135bec] transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="page-enter flex gap-2 mb-6 overflow-x-auto pb-1" style={{ animationDelay: ".1s" }}>
          {TABS.map(tab => {
            const count =
              tab === "Toutes" ? (reservations?.length || 0) :
              tab === "Confirmées" ? (reservations?.filter(r => ["PAYEE","CONFIRMEE"].includes(r.statut)).length || 0) :
              tab === "En attente" ? (reservations?.filter(r => r.statut === "EN_ATTENTE").length || 0) :
              (reservations?.filter(r => r.statut === "ANNULEE").length || 0);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                  activeTab === tab
                    ? "bg-[#135bec] text-white shadow-sm shadow-[#135bec]/30"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {tab}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-extrabold ${
                  activeTab === tab ? "bg-white/25 text-white" : "bg-slate-200 text-slate-600"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-[#135bec] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="page-enter py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-bold text-slate-600 text-lg">Aucune réservation</p>
            <p className="text-sm text-slate-400 mt-1 mb-6">
              {search ? "Aucun résultat pour cette recherche" : "Commencez par réserver un trajet"}
            </p>
            <button
              onClick={() => navigate("/recherche")}
              className="bg-[#135bec] text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-blue-700 transition-colors active:scale-95"
            >
              Rechercher un voyage
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r, idx) => {
              const cfg = statutCfg[r.statut] || { label: r.statut, bg: "bg-slate-100 text-slate-600 border-slate-200", icon: Ticket };
              const StatusIcon = cfg.icon;
              const canCancel = ["EN_ATTENTE", "CONFIRMEE"].includes(r.statut);
              const canDownload = r.statut === "PAYEE";

              return (
                <div
                  key={r.id}
                  className="item-enter bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden card-hover cursor-pointer"
                  style={{ animationDelay: `${idx * 50}ms` }}
                  onClick={() => navigate(`/voyageur/billet/${r.id}`)}
                >
                  {/* Top */}
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Bus className="w-5 h-5 text-[#135bec]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm">Réservation #{r.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{r.codeFiliale || "Trajet"} · {r.canal}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-extrabold text-slate-900">{formatMontant(r.montantTotal)}</p>
                        <p className="text-[10px] text-slate-400">{r.nombrePlaces} place(s)</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>

                  {/* Date row */}
                  <div className="px-4 pb-3 flex items-center gap-4 flex-wrap text-xs text-slate-400 border-t border-slate-50 pt-2.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {r.dateReservation ? formatDate(r.dateReservation) : "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5" />
                      {r.canal === "WEB" ? "En ligne" : "Guichet"}
                    </span>
                  </div>

                  {/* Actions */}
                  {(canDownload || canCancel) && (
                    <div className="px-4 pb-4 flex gap-2" onClick={e => e.stopPropagation()}>
                      {canDownload && (
                        <button
                          onClick={(e) => handleDownload(r.id, e)}
                          className="flex items-center gap-1.5 bg-[#135bec] text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors active:scale-95"
                        >
                          <Download className="w-3.5 h-3.5" /> Billet PDF
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={(e) => handleAnnuler(r.id, e)}
                          className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-bold px-4 py-2 rounded-xl hover:bg-red-100 transition-colors border border-red-200 active:scale-95"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Annuler
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="h-20 md:hidden" />
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-100 z-50">
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
                className={`flex flex-col items-center justify-center py-3 gap-1 ${active ? "text-[#135bec]" : "text-slate-400"}`}>
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
}