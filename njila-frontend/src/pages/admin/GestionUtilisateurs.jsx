import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, User, MoreVertical, Shield, UserX } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import { userService } from "../../services/userService";
import { formatDate } from "../../utils/formatters";

const roleConfig = {
  VOYAGEUR:       { label: "Voyageur",        variant: "gray"    },
  GUICHETIER:     { label: "Guichetier",      variant: "primary" },
  MANAGER_LOCAL:  { label: "Manager Local",   variant: "success" },
  MANAGER_GLOBAL: { label: "Manager Global",  variant: "warning" },
  ADMIN:          { label: "Administrateur",  variant: "danger"  },
};

export default function GestionUtilisateurs() {
  const [search, setSearch] = useState("");
  const [page] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["utilisateurs", page, search],
    queryFn:  () => userService.getUtilisateurs({ page, search, limit: 20 }),
  });

  const users = data?.users || data || [];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Utilisateurs</h1>
          <p className="text-slate-500 mt-1">Tous les comptes de la plateforme</p>
        </div>
      </div>

      <Card padding={false}>
        <div className="p-4 border-b border-slate-100">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un utilisateur..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <select className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm">
              <option>Tous les rôles</option>
              <option>Voyageur</option><option>Guichetier</option><option>Manager</option>
            </select>
          </div>
        </div>

        {isLoading ? <Spinner className="py-12" /> : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Utilisateur", "Email", "Rôle", "Inscription", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400">Aucun utilisateur trouvé</td></tr>
              ) : users.map(u => {
                const cfg = roleConfig[u.role] || { label: u.role, variant: "gray" };
                return (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#135bec]/10 rounded-full flex items-center justify-center text-[#135bec] text-sm font-bold">
                          {u.nom?.[0]}{u.prenom?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{u.nom} {u.prenom}</p>
                          <p className="text-xs text-slate-400">{u.telephone || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{u.email}</td>
                    <td className="px-5 py-4"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                    <td className="px-5 py-4 text-sm text-slate-400">{u.date_inscription ? formatDate(u.date_inscription) : "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg" title="Rôles">
                          <Shield className="w-4 h-4 text-slate-400" />
                        </button>
                        <button className="p-1.5 hover:bg-red-50 rounded-lg" title="Désactiver">
                          <UserX className="w-4 h-4 text-red-400" />
                        </button>
                        <button className="p-1.5 hover:bg-slate-100 rounded-lg">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </DashboardLayout>
  );
}
