import { useQuery } from "@tanstack/react-query";
import { Building2, CreditCard, TrendingUp, Users, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import StatsCard from "../../components/ui/StatsCard";
import { subscribeService } from "../../services/subscribeService";
import { formatMontant, formatDate } from "../../utils/formatters";
import Spinner from "../../components/ui/Spinner";

export default function AdminDashboard() {
  const { data: tableau, isLoading } = useQuery({
    queryKey: ["admin-tableau-de-bord"],
    queryFn:  subscribeService.getTableauDeBord,
  });

  const resume = tableau?.resume || {};

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Admin NJILA</h1>
          <p className="text-sm text-gray-500 mt-1">Supervision de toute la plateforme</p>
        </div>
        <Button><Building2 className="w-4 h-4" /> + Nouvelle agence</Button>
      </div>

      {isLoading ? <Spinner size="lg" className="py-20" /> : (
        <>
          {/* Stats abonnements */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <StatsCard title="Abonnements actifs" value={resume.actifs || 0} trend="up" trendValue="+3 ce mois" icon={CheckCircle} color="success" />
            <StatsCard title="Essais en cours"    value={resume.essais || 0} icon={Clock}   color="primary" />
            <StatsCard title="Expirant < 30j"     value={resume.expirant_sous_30j || 0} icon={AlertTriangle} color="warning" />
            <StatsCard title="Recettes totales"   value={formatMontant(resume.recette_totale_fcfa || 0)} trend="up" trendValue="+12%" icon={TrendingUp} color="success" />
          </div>

          {/* Recettes par plan */}
          {resume.recettes_par_plan && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {Object.entries(resume.recettes_par_plan).map(([plan, montant]) => (
                <Card key={plan} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase">{plan}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{formatMontant(montant)}</p>
                  </div>
                  <Badge variant={plan === "ANNUEL" ? "success" : plan === "TRIMESTRIEL" ? "primary" : "gray"}>
                    {plan}
                  </Badge>
                </Card>
              ))}
            </div>
          )}

          {/* Abonnements expirant */}
          {tableau?.abonnements_expirant_bientot?.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Abonnements expirant bientôt</h2>
                <Badge variant="warning">{tableau.abonnements_expirant_bientot.length} agences</Badge>
              </div>
              <div className="space-y-3">
                {tableau.abonnements_expirant_bientot.map(ab => (
                  <div key={ab.id} className="flex items-center justify-between p-4 bg-warning-50 rounded-xl border border-warning-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-warning-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-warning-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{ab.id_agence}</p>
                        <p className="text-xs text-gray-500">Plan {ab.plan} — {ab.jours_restants}j restants</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm">Contacter</Button>
                      <Button size="sm">Renouveler</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
