import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import PublicLayout from "../../components/layout/PublicLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import { useNavigate } from "react-router-dom";
import { Ticket, Download, XCircle, MapPin, Clock, Calendar } from "lucide-react";
import { formatMontant, formatDate } from "../../utils/formatters";
import toast from "react-hot-toast";

const statutConfig = {
  PAYEE:      { label: "Confirmée",   variant: "success" },
  EN_ATTENTE: { label: "En attente",  variant: "warning" },
  ANNULEE:    { label: "Annulée",     variant: "danger"  },
  CONFIRMEE:  { label: "Confirmée",   variant: "primary" },
  EMBARQUEE:  { label: "Embarquée",   variant: "gray"    },
};

export default function MesReservations() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: reservations, isLoading, refetch } = useQuery({
    queryKey: ["reservations", user?.id],
    queryFn:  () => bookingService.getMesReservations(user.id),
    enabled:  !!user?.id,
  });

  const handleAnnuler = async (id) => {
    if (!confirm("Confirmer l'annulation de cette réservation ?")) return;
    try {
      await bookingService.annulerReservation(id, user.id);
      toast.success("Réservation annulée");
      refetch();
    } catch { toast.error("Impossible d'annuler cette réservation"); }
  };

  const handleDownloadPdf = async (id) => {
    try {
      const blob = await bookingService.telechargerBilletPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `billet-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("PDF non disponible"); }
  };

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Mes Réservations</h1>
            <p className="text-slate-500 mt-1">{reservations?.length || 0} réservation(s) au total</p>
          </div>
          <Button onClick={() => navigate("/recherche")}>+ Nouveau voyage</Button>
        </div>

        {isLoading && <Spinner size="lg" className="py-20" />}

        {!isLoading && (!reservations || reservations.length === 0) && (
          <Card className="text-center py-16">
            <Ticket className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium text-lg">Aucune réservation trouvée</p>
            <p className="text-slate-400 text-sm mb-6">Commencez par rechercher un trajet disponible</p>
            <Button onClick={() => navigate("/recherche")}>Rechercher un voyage</Button>
          </Card>
        )}

        <div className="space-y-4">
          {reservations?.map(r => {
            const cfg = statutConfig[r.statut] || { label: r.statut, variant: "gray" };
            return (
              <Card key={r.id} padding={false} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center">
                      <Ticket className="w-5 h-5 text-[#135bec]" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Réservation #{r.id}</p>
                      <p className="text-xs text-slate-400">{formatDate(r.dateReservation)}</p>
                    </div>
                  </div>
                  <Badge variant={cfg.variant}>{cfg.label}</Badge>
                </div>

                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Trajet</p>
                      <p className="text-sm font-semibold text-slate-900">{r.codeFiliale || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Canal</p>
                      <p className="text-sm font-semibold text-slate-900">{r.canal}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-slate-400">Places</p>
                      <p className="text-sm font-semibold text-slate-900">{r.nombrePlaces} place(s)</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Montant</p>
                    <p className="text-sm font-extrabold text-[#135bec]">{formatMontant(r.montantTotal)}</p>
                  </div>
                </div>

                {r.statut !== "ANNULEE" && (
                  <div className="px-5 pb-5 flex gap-2">
                    {r.statut === "PAYEE" && (
                      <Button variant="secondary" size="sm" onClick={() => handleDownloadPdf(r.id)}>
                        <Download className="w-4 h-4" /> Télécharger le billet
                      </Button>
                    )}
                    {["EN_ATTENTE", "CONFIRMEE"].includes(r.statut) && (
                      <Button variant="danger" size="sm" onClick={() => handleAnnuler(r.id)}>
                        <XCircle className="w-4 h-4" /> Annuler
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
}
