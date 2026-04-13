import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { bookingService } from "../../services/bookingService";
import PublicLayout from "../../components/layout/PublicLayout";
import Spinner from "../../components/ui/Spinner";
import { Download, Printer, ArrowLeft, CheckCircle, Bus, MapPin, Calendar, User, Hash } from "lucide-react";
import { formatDate } from "../../utils/formatters";
import toast from "react-hot-toast";

export default function MonBillet() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => bookingService.getTicket(id),
  });

  const handleDownload = async () => {
    try {
      const blob = await bookingService.telechargerBilletPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `billet-${ticket?.numeroTicket || id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("PDF non disponible"); }
  };

  if (isLoading) return <PublicLayout><Spinner size="lg" className="py-32" /></PublicLayout>;

  return (
    <PublicLayout>
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim { animation: fadeSlideUp .4s ease both; }
        .anim2 { animation: fadeSlideUp .4s .08s ease both; }
        .anim3 { animation: fadeSlideUp .4s .16s ease both; }
      `}</style>

      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Bouton retour */}
        <button
          onClick={() => navigate(-1)}
          className="anim flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 text-sm font-semibold transition-colors group"
        >
          <div className="w-8 h-8 bg-slate-100 group-hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Retour
        </button>

        <div className="anim2 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-[#135bec] to-blue-700 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-emerald-300" />
                <p className="font-bold text-emerald-200">Billet confirmé</p>
                <span className="ml-auto text-[10px] font-bold bg-white/20 border border-white/30 px-2 py-0.5 rounded-full">
                  {ticket?.type === "WEB" ? "ÉLECTRONIQUE" : "EMBARQUEMENT"}
                </span>
              </div>
              <p className="text-3xl font-extrabold font-mono tracking-wide">{ticket?.numeroTicket || "—"}</p>
              <p className="text-blue-200 text-xs mt-1">Numéro unique de billet</p>
            </div>
          </div>

          {/* Trajet visuel */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-slate-900">
                {ticket?.origine?.slice(0, 3).toUpperCase() || "—"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{ticket?.origine || "—"}</p>
            </div>
            <div className="flex-1 flex items-center gap-2 px-4">
              <div className="flex-1 h-px bg-slate-200" />
              <div className="w-8 h-8 bg-[#135bec]/10 rounded-full flex items-center justify-center">
                <Bus className="w-4 h-4 text-[#135bec]" />
              </div>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-slate-900">
                {ticket?.destination?.slice(0, 3).toUpperCase() || "—"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{ticket?.destination || "—"}</p>
            </div>
          </div>

          {/* Détails */}
          <div className="p-6 grid grid-cols-2 gap-5">
            {[
              { label: "Voyageur",    value: ticket?.nomVoyageur || "—",           icon: User },
              { label: "Téléphone",   value: ticket?.telephoneVoyageur || "—",     icon: null },
              { label: "Date départ", value: ticket?.dateDepart || "—",            icon: Calendar },
              { label: "Bus",         value: ticket?.immatriculationBus || "—",    icon: Bus },
              { label: "Statut",      value: ticket?.statut || "—",                icon: CheckCircle },
              { label: "Type",        value: ticket?.type === "WEB" ? "Billet électronique" : "Billet d'embarquement", icon: Hash },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <div className="flex items-center gap-1.5">
                  {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                  <p className="text-sm font-bold text-slate-900">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Warning WEB */}
          {ticket?.type === "WEB" && (
            <div className="mx-6 mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-sm font-bold text-amber-800 mb-1">⚠️ Important</p>
              <p className="text-xs text-amber-700">Présentez ce billet avec votre CNI au guichetier avant le départ pour obtenir votre billet d'embarquement.</p>
            </div>
          )}

          {/* Actions */}
          <div className="anim3 px-6 pb-6 flex gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 bg-[#135bec] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4" /> Télécharger PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition-all active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" /> Imprimer
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}