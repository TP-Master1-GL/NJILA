import { useAuthStore } from "../../store/authStore";
import { useQuery } from "@tanstack/react-query";
import { bookingService } from "../../services/bookingService";
import PublicLayout from "../../components/layout/PublicLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { useNavigate } from "react-router-dom";
import { Ticket, Clock, CheckCircle, XCircle, Search } from "lucide-react";
import { formatMontant, formatDate } from "../../utils/formatters";

const statutVariant = { PAYEE: "success", EN_ATTENTE: "warning", ANNULEE: "danger", CONFIRMEE: "primary" };

export default function VoyageurDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", user?.id],
    queryFn:  () => bookingService.getMesReservations(user.id),
    enabled:  !!user?.id,
  });

  const stats = [
    { label: "Total voyages",     value: reservations?.length || 0,                                      icon: Ticket,       color: "primary" },
    { label: "En attente",        value: reservations?.filter(r => r.statut === "EN_ATTENTE").length || 0, icon: Clock,        color: "warning" },
    { label: "Confirmées",        value: reservations?.filter(r => r.statut === "PAYEE").length || 0,      icon: CheckCircle,  color: "success" },
    { label: "Annulées",          value: reservations?.filter(r => r.statut === "ANNULEE").length || 0,    icon: XCircle,      color: "danger"  },
  ];

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bonjour, {user?.nom} 👋</h1>
            <p className="text-gray-500 mt-1">Gérez vos réservations et billets</p>
          </div>
          <Button onClick={() => navigate("/recherche")}>
            <Search className="w-4 h-4" /> Nouveau voyage
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="text-center">
              <div className={`w-10 h-10 bg-${color}-50 rounded-xl flex items-center justify-center mx-auto mb-3`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </Card>
          ))}
        </div>

        {/* Réservations récentes */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mes réservations récentes</h2>
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Chargement...</div>
          ) : reservations?.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Aucune réservation</p>
              <p className="text-sm text-gray-400 mb-4">Commencez par rechercher un trajet</p>
              <Button onClick={() => navigate("/recherche")}>Rechercher un voyage</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations?.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => navigate(`/voyageur/billet/${r.id}`)}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                      <Ticket className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Réservation #{r.id}</p>
                      <p className="text-xs text-gray-400">{formatDate(r.dateReservation)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold text-gray-700">{formatMontant(r.montantTotal)}</p>
                    <Badge variant={statutVariant[r.statut] || "gray"}>{r.statut}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PublicLayout>
  );
}
