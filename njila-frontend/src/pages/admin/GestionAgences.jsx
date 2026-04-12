import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Building2, MoreVertical } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import { subscribeService } from "../../services/subscribeService";

const statutConfig = {
  ACTIVE:    { label: "Actif",    variant: "success" },
  SUSPENDED: { label: "Suspendu", variant: "danger"  },
  TRIAL:     { label: "Essai",    variant: "primary" },
  EXPIRED:   { label: "Expiré",   variant: "warning" },
};

export default function GestionAgences() {
  const { data: agences, isLoading } = useQuery({
    queryKey: ["agences"],
    queryFn:  subscribeService.getAgences,
  });

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Agences</h1>
          <p className="text-slate-500 mt-1">{agences?.length || 0} agences enregistrées</p>
        </div>
        <Button><Plus className="w-4 h-4" /> Nouvelle agence</Button>
      </div>

      {isLoading ? <Spinner size="lg" className="py-20" /> : (
        <Card padding={false}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Agence", "ID Agence", "Email", "Statut", "Inscription", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agences?.map(a => {
                const cfg = statutConfig[a.statut_global] || { label: a.statut_global, variant: "gray" };
                return (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#135bec]/10 rounded-xl flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-[#135bec]" />
                        </div>
                        <span className="font-semibold text-slate-900 text-sm">{a.nom}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4"><span className="font-mono text-xs text-slate-500">{a.agence_id}</span></td>
                    <td className="px-5 py-4 text-sm text-slate-500">{a.email_officiel}</td>
                    <td className="px-5 py-4"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                    <td className="px-5 py-4 text-sm text-slate-400">{a.date_inscription?.slice(0, 10)}</td>
                    <td className="px-5 py-4">
                      <button className="p-1.5 hover:bg-slate-100 rounded-lg"><MoreVertical className="w-4 h-4 text-slate-400" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardLayout>
  );
}
