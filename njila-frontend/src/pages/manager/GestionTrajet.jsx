/**
 * GestionTrajets.jsx – Manager Global
 * Création de trajets entre deux filiales de son agence
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, MapPin, RouteIcon } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { fleetService } from "../../services/fleetService";
import { filialeService } from "../../services/filialeService";
import { useAuthStore } from "../../store/authStore";

const FORM_INIT = {
  filiale_depart: "",
  filiale_arrive: "",
  distance: "",
};

export default function GestionTrajets() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(FORM_INIT);

  const agenceId = user?.agenceId;

  // GET /api/filiales/ — filiales de l'agence du manager global
  const { data: filiales = [], isLoading: loadingFiliales } = useQuery({
    queryKey: ["filiales", agenceId],
    queryFn: () => filialeService.getFiliales({ agence: agenceId }),
    enabled: !!agenceId,
    retry: 1,
  });

  // GET /api/trajets/
  const { data: trajets = [], isLoading, isError } = useQuery({
    queryKey: ["trajets"],
    queryFn: () => fleetService.getTrajets(),
    retry: 1,
  });

  // POST /api/trajets/
  const { mutate: creerTrajet, isPending } = useMutation({
    mutationFn: (payload) => fleetService.creerTrajet(payload),
    onSuccess: () => {
      toast.success("Trajet créé avec succès !");
      qc.invalidateQueries({ queryKey: ["trajets"] });
      setIsModalOpen(false);
      setForm(FORM_INIT);
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Erreur lors de la création du trajet."),
  });

  // DELETE /api/trajets/{Id_trajet}/
  const { mutate: supprimerTrajet } = useMutation({
    mutationFn: (Id_trajet) => fleetService.supprimerTrajet(Id_trajet),
    onSuccess: () => {
      toast.success("Trajet supprimé avec succès !");
      qc.invalidateQueries({ queryKey: ["trajets"] });
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error || "Erreur lors de la suppression du trajet."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.filiale_depart || !form.filiale_arrive)
      return toast.error("Sélectionnez une filiale de départ et d'arrivée.");
    if (form.filiale_depart === form.filiale_arrive)
      return toast.error("Les filiales de départ et d'arrivée doivent être différentes.");
    
    creerTrajet({
      filiale_depart: form.filiale_depart,
      filiale_arrive: form.filiale_arrive,
      distance: parseFloat(form.distance) || null,
    });
  };

  const getFilialeNom = (id) => {
    const f = filiales.find((fil) => fil.id_filiale === id);
    return f ? `${f.nom} (${f.ville})` : "—";
  };

  const filtered = trajets.filter((t) => {
    const q = search.toLowerCase();
    const depart = t.filiale_depart_nom || "";
    const arrive = t.filiale_arrive_nom || "";
    return depart.toLowerCase().includes(q) || arrive.toLowerCase().includes(q);
  });

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Trajets</h1>
          <p className="text-slate-400 mt-1 text-sm">
            {isLoading ? "Chargement…" : `${trajets.length} trajet(s) créé(s)`}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-[#135bec]/20"
        >
          <Plus className="w-4 h-4" /> Créer un trajet
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
        {[
          { label: "Total trajets",  value: trajets.length,                            bg: "bg-slate-50",   color: "text-slate-900"   },
          { label: "Trajets actifs", value: trajets.filter((t) => t.est_actif).length, bg: "bg-emerald-50", color: "text-emerald-600" },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className={`${bg} rounded-2xl p-5`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-sm text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un trajet…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            />
          </div>
        </div>

        {isLoading ? (
          <Spinner size="lg" className="py-20" />
        ) : isError ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Impossible de charger les trajets.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Départ", "Arrivée", "Distance (km)", "Statut", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-slate-400 text-sm">
                    Aucun trajet trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.Id_trajet} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-300" />
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{t.filiale_depart_nom}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-300" />
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{t.filiale_arrive_nom}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {t.distance ? `${t.distance} km` : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${t.est_actif ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {t.est_actif ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => supprimerTrajet(t.Id_trajet)}
                        className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                        title="Supprimer le trajet"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {!isLoading && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            Affichage de {filtered.length} sur {trajets.length} trajet(s)
          </div>
        )}
      </Card>

      {/* Modal Création Trajet */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Créer un Nouveau Trajet"
        size="md"
        footer={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || loadingFiliales}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl"
            >
              {isPending ? "Création…" : "Créer le trajet"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Filiale de départ *</label>
            <select
              value={form.filiale_depart}
              onChange={(e) => setForm((f) => ({ ...f, filiale_depart: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            >
              <option value="">Sélectionner une filiale</option>
              {filiales.map((f) => (
                <option key={f.id_filiale} value={f.id_filiale}>
                  {f.nom} ({f.ville})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Filiale d'arrivée *</label>
            <select
              value={form.filiale_arrive}
              onChange={(e) => setForm((f) => ({ ...f, filiale_arrive: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            >
              <option value="">Sélectionner une filiale</option>
              {filiales.map((f) => (
                <option key={f.id_filiale} value={f.id_filiale}>
                  {f.nom} ({f.ville})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Distance (km)</label>
            <input
              type="number"
              step="0.1"
              placeholder="Ex: 250.5"
              value={form.distance}
              onChange={(e) => setForm((f) => ({ ...f, distance: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <strong>Info :</strong> Vous pouvez créer un trajet entre deux filiales de votre agence. Les trajets seront disponibles pour la création de voyages.
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
