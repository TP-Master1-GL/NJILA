/**
 * GestionTrajets.jsx – Manager Global / Manager Local
 *
 * CORRECTION : les trajets sont désormais récupérés via le profil public
 * de l'agence (/api/agences/{id_agence}/profil/) et non plus via
 * /api/trajets/ qui retournait les trajets de TOUTES les agences.
 *
 * Manager Global  → tous les trajets de son agence
 * Manager Local   → trajets dont sa filiale est départ OU arrivée
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, MapPin, RefreshCw, ArrowRight } from "lucide-react";
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

  const agenceId  = user?.agenceId;
  const filialeId = user?.filialeId;
  const isManagerLocal  = user?.role === "MANAGER_LOCAL";
  const isManagerGlobal = user?.role === "MANAGER_GLOBAL";

  // ── Profil agence → source unique de vérité pour les trajets ──────────────
  // On utilise getAgenceProfilNormalise() qui appelle
  // GET /api/agences/{agenceId}/profil/
  // Ce endpoint retourne uniquement les trajets de l'agence connectée.
  const {
    data: profilAgence,
    isLoading: isLoadingProfil,
    isError: isErrorProfil,
    refetch: refetchProfil,
  } = useQuery({
    queryKey: ["agence-profil-trajets", agenceId],
    queryFn: () => fleetService.getAgenceProfilNormalise(agenceId),
    enabled: !!agenceId,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  // ── Extraction et filtrage des trajets selon le rôle ─────────────────────
  const tousTrajets = profilAgence?.trajets ?? [];

  const trajetsFiltresParRole = isManagerLocal && filialeId
    ? tousTrajets.filter(
        (t) =>
          // Le profil retourne filiale_depart (nom) et ville_depart
          // On compare avec les infos de la filiale du manager local
          // On utilise id_trajet pour confirmer en récupérant les filiales
          // La structure du profil expose : filiale_depart, ville_depart,
          // filiale_arrivee, ville_arrivee — on compare via les IDs si dispo
          // sinon via les noms (fallback)
          t.filiale_depart_id === filialeId ||
          t.filiale_arrivee_id === filialeId ||
          // fallback : comparaison via filialeNom du store
          t.filiale_depart === user?.filialeNom ||
          t.filiale_arrivee === user?.filialeNom
      )
    : tousTrajets; // Manager Global : tous les trajets de l'agence

  // ── Filiales pour le formulaire de création ───────────────────────────────
  const { data: filiales = [], isLoading: loadingFiliales } = useQuery({
    queryKey: ["filiales", agenceId],
    queryFn: () => filialeService.getFiliales({ agence: agenceId }),
    enabled: !!agenceId && isModalOpen,
    retry: 1,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const { mutate: creerTrajet, isPending } = useMutation({
    mutationFn: (payload) => fleetService.creerTrajet(payload),
    onSuccess: () => {
      toast.success("Trajet créé avec succès !");
      qc.invalidateQueries({ queryKey: ["agence-profil-trajets", agenceId] });
      setIsModalOpen(false);
      setForm(FORM_INIT);
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.error || "Erreur lors de la création du trajet."
      ),
  });

  const { mutate: supprimerTrajet } = useMutation({
    mutationFn: (Id_trajet) => fleetService.supprimerTrajet(Id_trajet),
    onSuccess: () => {
      toast.success("Trajet supprimé !");
      qc.invalidateQueries({ queryKey: ["agence-profil-trajets", agenceId] });
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.error || "Erreur lors de la suppression du trajet."
      ),
  });

  // ── Recherche locale ───────────────────────────────────────────────────────
  const trajetsFiltres = trajetsFiltresParRole.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.filiale_depart   || "").toLowerCase().includes(q) ||
      (t.filiale_arrivee  || "").toLowerCase().includes(q) ||
      (t.ville_depart     || "").toLowerCase().includes(q) ||
      (t.ville_arrivee    || "").toLowerCase().includes(q)
    );
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

  const isLoading = isLoadingProfil;
  const isError   = isErrorProfil;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Gestion des Trajets
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            {isLoading
              ? "Chargement…"
              : isManagerLocal
              ? `${trajetsFiltresParRole.length} trajet(s) de votre filiale`
              : `${trajetsFiltresParRole.length} trajet(s) de votre agence`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetchProfil()}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {isManagerGlobal && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-[#135bec]/20"
            >
              <Plus className="w-4 h-4" /> Créer un trajet
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          {
            label: "Total trajets",
            value: trajetsFiltresParRole.length,
            bg: "bg-slate-50",
            color: "text-slate-900",
          },
          {
            label: isManagerLocal ? "Trajets de ma filiale" : "Trajets actifs",
            value: trajetsFiltresParRole.length,
            bg: "bg-emerald-50",
            color: "text-emerald-600",
          },
        ].map(({ label, value, bg, color }) => (
          <div key={label} className={`${bg} rounded-2xl p-5`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-sm text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Info filtre actif */}
      {isManagerLocal && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          Affichage restreint aux trajets de la filiale{" "}
          <strong>{user?.filialeNom || "votre filiale"}</strong>.
        </div>
      )}

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
                {["Départ", "", "Arrivée", "Distance (km)", "Actions"].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trajetsFiltres.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-14 text-slate-400 text-sm"
                  >
                    Aucun trajet trouvé pour votre{" "}
                    {isManagerLocal ? "filiale" : "agence"}.
                  </td>
                </tr>
              ) : (
                trajetsFiltres.map((t) => (
                  <tr
                    key={t.id_trajet}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    {/* Départ */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <p className="font-semibold text-slate-900 text-sm">
                          {t.filiale_depart}
                        </p>
                        <p className="text-xs text-slate-400">{t.ville_depart}</p>
                      </div>
                    </td>

                    {/* Flèche */}
                    <td className="px-2 py-4 text-slate-300">
                      <ArrowRight className="w-4 h-4" />
                    </td>

                    {/* Arrivée */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <p className="font-semibold text-slate-900 text-sm">
                          {t.filiale_arrivee}
                        </p>
                        <p className="text-xs text-slate-400">{t.ville_arrivee}</p>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {t.distance_km ? `${t.distance_km} km` : "—"}
                    </td>

                    <td className="px-5 py-4">
                      {isManagerGlobal && (
                        <button
                          onClick={() => supprimerTrajet(t.id_trajet)}
                          className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                          title="Supprimer le trajet"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {!isLoading && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            Affichage de {trajetsFiltres.length} sur{" "}
            {trajetsFiltresParRole.length} trajet(s)
          </div>
        )}
      </Card>

      {/* Modal Création Trajet — Manager Global uniquement */}
      {isManagerGlobal && (
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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Filiale de départ *
              </label>
              <select
                value={form.filiale_depart}
                onChange={(e) =>
                  setForm((f) => ({ ...f, filiale_depart: e.target.value }))
                }
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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Filiale d'arrivée *
              </label>
              <select
                value={form.filiale_arrive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, filiale_arrive: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              >
                <option value="">Sélectionner une filiale</option>
                {filiales
                  .filter((f) => f.id_filiale !== form.filiale_depart)
                  .map((f) => (
                    <option key={f.id_filiale} value={f.id_filiale}>
                      {f.nom} ({f.ville})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="Ex: 250.5"
                value={form.distance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, distance: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              <strong>Info :</strong> Seules les filiales de votre agence sont
              disponibles. Les trajets créés seront utilisables pour programmer
              des voyages.
            </div>
          </form>
        </Modal>
      )}
    </DashboardLayout>
  );
}