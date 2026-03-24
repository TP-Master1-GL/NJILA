import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { bookingService } from "../../services/bookingService";
import PublicLayout from "../../components/layout/PublicLayout";
import Spinner from "../../components/ui/Spinner";
import Button from "../../components/ui/Button";
import { Download, Printer, ArrowLeft, CheckCircle } from "lucide-react";
import { formatDate } from "../../utils/formatters";
import toast from "react-hot-toast";

export default function MonBillet() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn:  () => bookingService.getTicket(id),
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
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          {/* Header */}
          <div className="bg-[#135bec] p-6 text-white">
            <div className="flex items-center gap-3 mb-1">
              <CheckCircle className="w-5 h-5 text-emerald-300" />
              <p className="font-bold">Billet confirmé</p>
            </div>
            <p className="text-4xl font-extrabold">{ticket?.numeroTicket || "—"}</p>
            <p className="text-blue-200 text-sm mt-1">Numéro unique de billet</p>
          </div>

          {/* Détails */}
          <div className="p-6 grid grid-cols-2 gap-5">
            {[
              ["Voyageur",    ticket?.nomVoyageur || "—"],
              ["Téléphone",   ticket?.telephoneVoyageur || "—"],
              ["Origine",     ticket?.origine || "—"],
              ["Destination", ticket?.destination || "—"],
              ["Date départ", ticket?.dateDepart || "—"],
              ["Bus",         ticket?.immatriculationBus || "—"],
              ["Statut",      ticket?.statut || "—"],
              ["Type",        ticket?.type === "WEB" ? "Billet électronique" : "Billet d'embarquement"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">{label}</p>
                <p className="text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Instructions */}
          {ticket?.type === "WEB" && (
            <div className="mx-6 mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Important</p>
              <p className="text-xs text-amber-700">Présentez ce billet avec votre CNI au guichetier avant le départ pour obtenir votre billet d'embarquement.</p>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <Button size="lg" className="flex-1" onClick={handleDownload}>
              <Download className="w-4 h-4" /> Télécharger PDF
            </Button>
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Imprimer
            </Button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
