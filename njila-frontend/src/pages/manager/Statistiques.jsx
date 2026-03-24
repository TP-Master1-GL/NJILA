import { TrendingUp, Users, Bus, Ticket, ArrowUp, ArrowDown } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import StatsCard from "../../components/ui/StatsCard";
import { formatMontant } from "../../utils/formatters";

const ROUTES_STATS = [
  { route: "Douala → Yaoundé",   voyages: 142, taux: 87, recette: 4260000 },
  { route: "Yaoundé → Douala",   voyages: 128, taux: 82, recette: 3840000 },
  { route: "Douala → Bafoussam", voyages: 64,  taux: 71, recette: 1920000 },
  { route: "Yaoundé → Garoua",   voyages: 28,  taux: 94, recette: 2240000 },
];

export default function Statistiques() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Statistiques</h1>
          <p className="text-slate-500 mt-1">Analyse des performances — Octobre 2026</p>
        </div>
        <select className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium">
          <option>Ce mois</option><option>Mois dernier</option><option>Cette année</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
        <StatsCard title="Recettes totales"   value={formatMontant(12280500)} trend="up"   trendValue="+18.5%" icon={TrendingUp} color="success" />
        <StatsCard title="Voyageurs ce mois"  value="3 842"                  trend="up"   trendValue="+11%"   icon={Users}      color="primary" />
        <StatsCard title="Taux d'occupation"  value="84.2%"                  trend="down" trendValue="-2%"    icon={Bus}        color="warning" />
        <StatsCard title="Billets émis"        value="4 218"                  trend="up"   trendValue="+9%"    icon={Ticket}     color="success" />
      </div>

      {/* Performances par route */}
      <Card>
        <h2 className="font-bold text-slate-900 mb-6">Performances par route</h2>
        <div className="space-y-4">
          {ROUTES_STATS.map(({ route, voyages, taux, recette }) => (
            <div key={route} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-900 text-sm">{route}</p>
                  <p className="font-extrabold text-[#135bec] text-sm">{formatMontant(recette)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${taux >= 90 ? "bg-emerald-500" : taux >= 70 ? "bg-[#135bec]" : "bg-amber-400"}`}
                      style={{ width: `${taux}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 w-8">{taux}%</span>
                  <span className="text-xs text-slate-400">{voyages} voyages</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </DashboardLayout>
  );
}
