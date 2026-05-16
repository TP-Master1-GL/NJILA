import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  PAYEE:      { label: "Payée",      bg: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
  EN_ATTENTE: { label: "En attente", bg: "bg-amber-100 text-amber-700 border-amber-200",       icon: Clock },
  ANNULEE:    { label: "Annulée",    bg: "bg-red-100 text-red-700 border-red-200",             icon: XCircle },
  CONFIRMEE:  { label: "Confirmée",  bg: "bg-blue-100 text-blue-700 border-blue-200",          icon: CheckCircle },
  EMBARQUEE:  { label: "Embarquée",  bg: "bg-slate-100 text-slate-600 border-slate-200",       icon: Bus },
};

export default function MesReservations() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("Toutes");
  const [search, setSearch] = useState("");

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", user?.id],
    queryFn: () => bookingService.getMesReservations(user.id),
    enabled: !!user?.id,
  });

  const handleAnnuler = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Voulez-vous vraiment annuler cette réservation ?")) return;
    try {
      await bookingService.annulerReservation(id, user.id);
      toast.success("Réservation annulée");
      qc.invalidateQueries(["reservations"]);
    } catch (err) { 
      toast.error(err.response?.data?.message || "Impossible d'annuler"); 
    }
  };

  const handleDownload = async (id, e) => {
    e.stopPropagation();
    try {
      const blob = await bookingService.telechargerBilletPdf(id);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; 
      a.download = `billet-${id}.pdf`; 
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Le PDF n'est pas encore généré"); }
  };

  const filtered = (reservations || []).filter(r => {
    const matchTab =
      activeTab === "Toutes" ? true :
      activeTab === "Confirmées" ? ["PAYEE", "CONFIRMEE", "EMBARQUEE"].includes(r.statut) :
      activeTab === "En attente" ? r.statut === "EN_ATTENTE" :
      r.statut === "ANNULEE";
    
    const searchLower = search.toLowerCase();
    const matchSearch = search
      ? r.id?.toString().includes(search) || 
        r.voyage_details?.origine?.toLowerCase().includes(searchLower) ||
        r.voyage_details?.destination?.toLowerCase().includes(searchLower)
      : true;
    return matchTab && matchSearch;
  });

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate("/voyageur")} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-slate-900">Mes billets</h1>
            <p className="text-sm text-slate-400">Gérez vos trajets à venir</p>
          </div>
          <button onClick={() => navigate("/recherche")} className="bg-[#135bec] text-white text-sm font-bold px-4 py-2.5 rounded-xl flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau
          </button>
        </div>

        {/* Tabs & Search */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une ville ou un n°..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map(tab => (
              <button
                key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                  activeTab === tab ? "bg-[#135bec] text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="py-20 text-center animate-pulse text-slate-400">Chargement de vos réservations...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <Ticket className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Aucun voyage trouvé</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => {
              const cfg = statutCfg[r.statut] || statutCfg.EN_ATTENTE;
              return (
                <div 
                  key={r.id} onClick={() => navigate(`/voyageur/billet/${r.id}`)}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                        <Bus className="w-5 h-5 text-[#135bec]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">#{r.id}</h3>
                        <p className="text-xs text-slate-400">{formatDate(r.dateReservation)}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${cfg.bg}`}>
                      {cfg.label.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-y border-slate-50">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Montant</p>
                      <p className="font-black text-[#135bec]">{formatMontant(r.montantTotal || r.montant_total)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Places</p>
                      <p className="font-bold text-slate-700">{r.nombrePlaces} siège(s)</p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {r.statut === "PAYEE" && (
                      <button 
                        onClick={(e) => handleDownload(r.id, e)}
                        className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white text-xs font-bold py-2.5 rounded-xl"
                      >
                        <Download className="w-3.5 h-3.5" /> Billet PDF
                      </button>
                    )}
                    {["EN_ATTENTE", "CONFIRMEE"].includes(r.statut) && (
                      <button 
                        onClick={(e) => handleAnnuler(r.id, e)}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 text-xs font-bold py-2.5 rounded-xl border border-red-100"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Annuler
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
