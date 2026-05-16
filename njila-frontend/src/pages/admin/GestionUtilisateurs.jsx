import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, User, MoreVertical, Shield, UserX, Trash2 } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import { userService } from "../../services/userService";
import { formatDate } from "../../utils/formatters";

const roleConfig = {
  VOYAGEUR: { label: "Voyageur", variant: "gray" },
  GUICHETIER: { label: "Guichetier", variant: "primary" },
  MANAGER_LOCAL: { label: "Manager Local", variant: "success" },
  MANAGER_GLOBAL: { label: "Manager Global", variant: "warning" },
  ADMINISTRATEUR: { label: "Administrateur", variant: "danger" },
  ADMIN: { label: "Administrateur", variant: "danger" },
};

export default function GestionUtilisateurs() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Récupérer la liste des utilisateurs
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["utilisateurs", page, search, roleFilter],
    queryFn: () =>
      userService.getUtilisateurs({
        page,
        search: search || undefined,
        limit: 20,
      }),
  });

  // Filtrer par rôle côté client si nécessaire
  const filteredUsers =
    roleFilter === "all"
      ? users
      : users.filter((u) => u.role === roleFilter);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleRoleFilter = (e) => {
    setRoleFilter(e.target.value);
    setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Gestion des Utilisateurs
          </h1>
          <p className="text-slate-500 mt-1">
            Tous les comptes de la plateforme ({filteredUsers.length} utilisateurs)
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">
            Erreur lors du chargement des utilisateurs: {error.message}
          </p>
        </div>
      )}

      <Card padding={false}>
        {/* Barre de recherche et filtres */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={handleSearch}
                placeholder="Rechercher un utilisateur..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <select
              value={roleFilter}
              onChange={handleRoleFilter}
              className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            >
              <option value="all">Tous les rôles</option>
              <option value="VOYAGEUR">Voyageur</option>
              <option value="GUICHETIER">Guichetier</option>
              <option value="MANAGER_LOCAL">Manager Local</option>
              <option value="MANAGER_GLOBAL">Manager Global</option>
              <option value="ADMINISTRATEUR">Administrateur</option>
            </select>
          </div>
        </div>

        {/* Tableau des utilisateurs */}
        {isLoading ? (
          <Spinner className="py-12" />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Utilisateur", "Email", "Rôle", "Inscription", "Actions"].map(
                  (header) => (
                    <th
                      key={header}
                      className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-12 text-slate-400"
                  >
                    <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>Aucun utilisateur trouvé</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleConfig_entry =
                    roleConfig[user.role] || {
                      label: user.role,
                      variant: "gray",
                    };
                  const initials = `${user.name?.[0] || ""}${
                    user.surname?.[0] || ""
                  }`.toUpperCase();

                  return (
                    <tr
                      key={user.idUser}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      {/* Colonne Utilisateur */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#135bec]/10 rounded-full flex items-center justify-center text-[#135bec] text-sm font-bold">
                            {initials || "?"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">
                              {user.name} {user.surname}
                            </p>
                            <p className="text-xs text-slate-400">
                              {user.phone || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Colonne Email */}
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {user.email}
                      </td>

                      {/* Colonne Rôle */}
                      <td className="px-5 py-4">
                        <Badge variant={roleConfig_entry.variant}>
                          {roleConfig_entry.label}
                        </Badge>
                      </td>

                      {/* Colonne Date d'inscription */}
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {user.dateInscription
                          ? formatDate(user.dateInscription)
                          : "—"}
                      </td>

                      {/* Colonne Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Gérer les rôles"
                            onClick={() => {
                              // TODO: Ouvrir modal de gestion des rôles
                              console.log("Gérer les rôles de", user.idUser);
                            }}
                          >
                            <Shield className="w-4 h-4 text-blue-500" />
                          </button>

                          <button
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Désactiver l'utilisateur"
                            onClick={() => {
                              // TODO: Ouvrir modal de confirmation
                              console.log("Désactiver", user.idUser);
                            }}
                          >
                            <UserX className="w-4 h-4 text-red-500" />
                          </button>

                          <button
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer l'utilisateur"
                            onClick={() => {
                              // TODO: Ouvrir modal de confirmation de suppression
                              console.log("Supprimer", user.idUser);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>

                          <button
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Plus d'options"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* Pagination (optionnel) */}
        {!isLoading && filteredUsers.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Affichage de {filteredUsers.length} utilisateur(s)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Précédent
              </button>
              <span className="px-3 py-2 text-sm text-slate-600">
                Page {page}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={filteredUsers.length < 20}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
