import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, MoreVertical, RefreshCw, Pause, Play } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import { subscribeService } from "../../services/subscribeService";
import { formatMontant } from "../../utils/formatters";
import toast from "react-hot-toast";

const PLANS_INFO = {
  MENSUEL:     { prix: 50000,  label: "Mensuel",     color: "primary" },
  TRIMESTRIEL: { prix: 130000, label: "Trimestriel", color: "success" },
  ANNUEL:      { prix: 450000, label: "Annuel",      color: "warning" },
  ESSAI:       { prix: 0,      label: "Essai",       color: "gray"    },
};

export default function GestionAbonnements() {
  const qc = useQueryClient();
  const { data: tableau, isLoading } = useQuery({
    queryKey: ["admin-abonnements"],
    queryFn:  subscribeService.getTableauDeBord,
  });

  const { mutate: suspendre } = useMutation({
    mutationFn: ({ id }) => subscribeService.suspendre(id, { motif: "Action admin", admin_id: "ADMIN-001" }),
    onSuccess: () => { toast.success("Agence suspendue"); qc.invalidateQueries(["admin-abonnements"]); },
  });

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Abonnements</h1>
        <Button><CreditCard className="w-4 h-4" /> Nouvel abonnement</Button>
      </div>

      {isLoading ? <Spinner size="lg" className="py-20" /> : (
        <>
          {/* Plans résumé */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(PLANS_INFO).map(([plan, { prix, label, color }]) => {
              const count = tableau?.resume?.[`plan_${plan.toLowerCase()}`] || 0;
              return (
                <Card key={plan} className="text-center py-4">
                  <Badge variant={color} className="mb-2">{label}</Badge>
                  <p className="text-2xl font-extrabold text-slate-900">
                    {plan === "ESSAI" ? "Gratuit" : formatMontant(prix)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {tableau?.resume?.[plan === "ANNUEL" ? "actifs" : "essais"] || 0} abonnements
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Abonnements expirant */}
          {tableau?.abonnements_expirant_bientot?.length > 0 && (
            <Card>
              <h3 className="font-bold text-slate-900 mb-4">À renouveler bientôt</h3>
              <div className="space-y-3">
                {tableau.abonnements_expirant_bientot.map(ab => (
                  <div key={ab.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{ab.id_agence}</p>
                      <p className="text-xs text-slate-500">Plan {ab.plan} — {ab.jours_restants} jours restants</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => suspendre({ id: ab.id_agence })}>
                        <Pause className="w-4 h-4" /> Suspendre
                      </Button>
                      <Button size="sm">
                        <RefreshCw className="w-4 h-4" /> Renouveler
                      </Button>
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
