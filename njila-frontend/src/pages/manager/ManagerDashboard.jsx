import { useQuery } from "@tanstack/react-query";
import { Bus, Users, TrendingUp, Calendar, Clock, MoreVertical, ArrowRight } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import StatsCard from "../../components/ui/StatsCard";
import { formatMontant } from "../../utils/formatters";

const MOCK_DEPARTURES = [
  { id: 1, heure: "08:30", route: "Douala → Yaoundé",  bus: "NJ-VIP-042",  chauffeur: "Amadou K.", statut: "BOARDING"   },
  { id: 2, heure: "07:15", route: "Douala → Limbe",    bus: "NJ-STD-109",  chauffeur: "John Ngwa", statut: "DEPARTED"   },
  { id: 3, heure: "09:45", route: "Douala → Bafoussam",bus: "NJ-VIP-005",  chauffeur: "Fabrice T.",statut: "ON_TIME"    },
  { id: 4, heure: "10:30", route: "Douala → Kribi",    bus: "NJ-STD-221",  chauffeur: "Jean-Pierre",statut:"ON_TIME"   },
  { id: 5, heure: "12:00", route: "Douala → Yaoundé",  bus: "NJ-VIP-031",  chauffeur: "Paul B.",   statut: "SCHEDULED" },
];

const statutConfig = {
  BOARDING:  { label: "Embarquement", variant: "primary"  },
  DEPARTED:  { label: "Parti",        variant: "gray"     },
  ON_TIME:   { label: "À l'heure",    variant: "success"  },
  SCHEDULED: { label: "Planifié",     variant: "warning"  },
  DELAYED:   { label: "Retard",       variant: "danger"   },
};

export default function ManagerDashboard() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agency Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Monitoring en temps réel — NJILA Douala Hub</p>
        </div>
        <Button>
          <Calendar className="w-4 h-4" /> + Nouveau départ
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard title="Recettes du mois" value={formatMontant(4280500)} trend="up" trendValue="+12.5%" icon={TrendingUp} color="success" />
        <StatsCard title="Taux d'occupation" value="84.2%" trend="up" trendValue="Moy. capacité" icon={Users} color="primary" />
        <StatsCard title="Bus actifs" value="24 / 32" icon={Bus} color="warning" />
      </div>

      {/* Départs à venir */}
      <Card padding={false} className="mb-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Départs à venir</h2>
            <p className="text-sm text-gray-400 mt-0.5">Planification en temps réel — prochaines 6 heures</p>
          </div>
          <Button variant="ghost" size="sm">
            Voir tout <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {["Heure", "Trajet", "Bus ID", "Chauffeur", "Statut", "Actions"].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_DEPARTURES.map((dep, i) => {
                const cfg = statutConfig[dep.statut] || {};
                return (
                  <tr key={dep.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${dep.statut === "DEPARTED" ? "opacity-50" : ""}`}>
                    <td className="px-6 py-4 font-semibold text-gray-900">{dep.heure}</td>
                    <td className="px-6 py-4 text-gray-700">{dep.route}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-gray-600">{dep.bus}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{dep.chauffeur}</td>
                    <td className="px-6 py-4">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 text-sm text-gray-400 border-t border-gray-100">
          Affichage de 5 sur 24 départs aujourd'hui
        </div>
      </Card>
    </DashboardLayout>
  );
}
