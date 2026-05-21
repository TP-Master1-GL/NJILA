/**
 * GestionFlotte.jsx – Manager Global / Manager Local
 *
 * CORRECTION : les bus sont désormais récupérés via le profil public
 * de l'agence (/api/agences/{agenceId}/profil/) et non via
 * /api/bus/?agence_id=... qui pouvait retourner des bus d'autres agences.
 *
 * Structure du profil (bus) :
 * { id, immatriculation, modele, capacite, etat, etat_label }
 *
 * Les mutations (ajout, changement d'état) continuent d'utiliser
 * les endpoints dédiés (/api/bus/ et /api/bus/{id}/etat/).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Truck, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { fleetService } from "../../services/fleetService";
import { useAuthStore } from "../../store/authStore";

const statutConfig = {
  disponible:  { label: "Disponible",  variant: "success" },
  en_voyage:   { label: "En voyage",   variant: "primary" },
  maintenance: { label: "Maintenance", variant: "warning" },
  en_panne:    { label: "En panne",    variant: "danger"  },
  reserve:     { label: "Réservé",     variant: "gray"    },
};

const ETATS = ["disponible", "en_voyage", "maintenance", "en_panne", "reserve"];

const BUS_FORM_INIT = {
  immatriculation: "",
  modele: "",
  capacite: 70,
  etat: "disponible",
};

export default function GestionFlotte() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [search,      setSearch]      = useState("");
  const [filtreEtat,  setFiltreEtat]  = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editBus,     setEditBus]     = useState(null);
  const [form,        setForm]        = useState(BUS_FORM_INIT);

  const agenceId = user?.agenceId;

  // ── Source unique : profil agence ─────────────────────────────────────────
  // GET /api/agences/{agenceId}/profil/
  // Retourne profil.bus[] — uniquement les bus de cette agence.
  const {
    data: profilAgence,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["agence-profil-flotte", agenceId],
    queryFn: () => fleetService.getAgenceProfil(agenceId),
    enabled: !!agenceId,
    staleTime: 60 * 1000,
    retry: 1,
  });

  // ── Extraction des bus depuis le profil ───────────────────────────────────
  // Le profil expose : { id, immatriculation, modele, capacite, etat, etat_label }
  // On normalise vers la forme attendue par le composant (IdBus = id)
  const busBruts = profilAgence?.bus ?? [];
  const busList = busBruts.map((b) => ({
    IdBus:          b.id,
    immatriculation: b.immatriculation,
    modele:         b.modele,
    capacite:       b.capacite,
    etat:           b.etat,
    etat_label:     b.etat_label,
  }));

  // ── Filtre par état côté client ───────────────────────────────────────────
  const busListFiltresEtat = filtreEtat
    ? busList.filter((b) => b.etat === filtreEtat)
    : busList;

  // ── Recherche locale ───────────────────────────────────────────────────────
  const filtered = busListFiltresEtat.filter((b) => {
    const q = search.toLowerCase();
    return (
      (b.immatriculation || "").toLowerCase().includes(q) ||
      (b.modele          || "").toLowerCase().includes(q)
    );
  });

  // ── Résumé stats depuis le profil ─────────────────────────────────────────
  const busParetat = profilAgence?.resume?.bus_par_etat ?? {};

  // ── Mutations ──────────────────────────────────────────────────────────────
  // POST /api/bus/
  const { mutate: ajouterBus, isPending } = useMutation({
    mutationFn: (payload) => fleetService.ajouterBus(payload),
    onSuccess: () => {
      toast.success("Bus ajouté à la flotte !");
      // Invalider le profil pour recharger la liste des bus
      qc.invalidateQueries({ queryKey: ["agence-profil-flotte", agenceId] });
      setIsModalOpen(false);
      setForm(BUS_FORM_INIT);
    },
    onError: (err) => {
      const detail = err?.response?.data;
      console.error("[GestionFlotte] Erreur ajout bus:", JSON.stringify(detail));

      let message = "Erreur lors de l'ajout du bus.";
      if (detail) {
        if (typeof detail === "string") {
          message = detail;
        } else if (detail.error) {
          message = detail.error;
        } else {
          const firstField = Object.keys(detail)[0];
          if (firstField) {
            const firstError = detail[firstField];
            message = `${firstField} : ${Array.isArray(firstError) ? firstError[0] : firstError}`;
          }
        }
      }
      toast.error(message, { duration: 6000 });
    },
  });

  // PUT /api/bus/{IdBus}/etat/
  const { mutate: changerEtat, isPending: isPendingEtat } = useMutation({
    mutationFn: ({ IdBus, etat }) => fleetService.changerEtatBus(IdBus, etat),
    onSuccess: () => {
      toast.success("État du bus mis à jour.");
      qc.invalidateQueries({ queryKey: ["agence-profil-flotte", agenceId] });
      setEditBus(null);
    },
    onError: (err) => {
      const detail = err?.response?.data;
      console.error("[GestionFlotte] Erreur changement état:", JSON.stringify(detail));
      toast.error(detail?.error || "Erreur lors de la mise à jour.");
    },
  });

  // ── Handler création bus ──────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.immatriculation.trim()) return toast.error("Immatriculation requise.");
    if (!form.capacite)              return toast.error("Capacité requise.");
    if (!agenceId)                   return toast.error("Agence introuvable. Reconnectez-vous.");

    ajouterBus({
      immatriculation: form.immatriculation.trim().toUpperCase(),
      modele:          form.modele.trim() || "Standard",
      capacite:        parseInt(form.capacite, 10),
      etat:            form.etat,
      Id_agence:       agenceId,
    });
  };

  // ── KPIs calculés depuis la liste locale ──────────────────────────────────
  const kpis = [
    {
      label: "Total flotte",
      value: busList.length,
      color: "text-slate-900",
      bg:    "bg-slate-50",
    },
    {
      label: "Disponibles",
      value: busList.filter((b) => b.etat === "disponible").length,
      color: "text-emerald-600",
      bg:    "bg-emerald-50",
    },
    {
      label: "En voyage",
      value: busList.filter((b) => b.etat === "en_voyage").length,
      color: "text-[#135bec]",
      bg:    "bg-blue-50",
    },
    {
      label: "Maintenance / Panne",
      value: busList.filter((b) => ["maintenance", "en_panne"].includes(b.etat)).length,
      color: "text-amber-600",
      bg:    "bg-amber-50",
    },
  ];

  return (
    <DashboardLayout>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Gestion de la Flotte
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLoading
              ? "Chargement…"
              : `${busList.length} bus de votre agence`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-[#135bec]/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> Ajouter un bus
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : isError ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          Impossible de charger la flotte.
        </div>
      ) : (
        <Card padding={false}>
          {/* ── Filtres ── */}
          <div className="flex items-center gap-4 p-5 border-b border-slate-100 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Rechercher par immatriculation, modèle…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <select
              value={filtreEtat}
              onChange={(e) => setFiltreEtat(e.target.value)}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            >
              <option value="">Tous les états</option>
              {ETATS.map((e) => (
                <option key={e} value={e}>{statutConfig[e]?.label || e}</option>
              ))}
            </select>
          </div>

          {/* ── Tableau ── */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Bus", "Modèle", "Capacité", "État", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-slate-400 text-sm">
                    {busList.length === 0
                      ? "Aucun bus enregistré pour votre agence."
                      : "Aucun bus correspond à ces critères."}
                  </td>
                </tr>
              ) : (
                filtered.map((bus) => {
                  const cfg = statutConfig[bus.etat] || { label: bus.etat_label || bus.etat, variant: "gray" };
                  return (
                    <tr
                      key={bus.IdBus}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-[#135bec]/10 rounded-xl flex items-center justify-center">
                            <Truck className="w-4 h-4 text-[#135bec]" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {bus.immatriculation}
                            </p>
                            <p className="text-xs text-slate-400">ID #{bus.IdBus}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {bus.modele || "—"}
                      </td>
                      <td className="px-5 py-4 text-slate-600 text-sm">
                        {bus.capacite} places
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setEditBus(bus)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Modifier l'état"
                        >
                          <Pencil className="w-4 h-4 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="px-5 py-3 flex items-center justify-between border-t border-slate-100 text-sm text-slate-400">
            <span>
              Affichage de {filtered.length} sur {busList.length} bus
            </span>
            <span className="text-xs">
              Source : profil agence
            </span>
          </div>
        </Card>
      )}

      {/* ── Modal Ajout Bus ── */}
      <Modal
        open={isModalOpen}
        onClose={() => { setIsModalOpen(false); setForm(BUS_FORM_INIT); }}
        title="Ajouter un Bus à la Flotte"
        size="md"
        footer={
          <>
            <button
              onClick={() => { setIsModalOpen(false); setForm(BUS_FORM_INIT); }}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl"
            >
              {isPending ? "Ajout…" : "Ajouter le bus"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Info agence */}
          {agenceId && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
              Bus rattaché à l'agence :{" "}
              <strong>{user?.agenceNom || agenceId}</strong>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Immatriculation *{" "}
                <span className="text-slate-400 font-normal text-xs">
                  (lettres majuscules et chiffres uniquement)
                </span>
              </label>
              <input
                placeholder="Ex: LT789CD ou LTCD45"
                value={form.immatriculation}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    immatriculation: e.target.value.toUpperCase(),
                  }))
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] uppercase"
              />
              <p className="text-xs text-slate-400 mt-1">
                Sans tirets ni caractères spéciaux. Espaces autorisés.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Modèle
              </label>
              <input
                placeholder="Ex: Toyota Coaster"
                value={form.modele}
                onChange={(e) =>
                  setForm((f) => ({ ...f, modele: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Capacité (places) *
              </label>
              <input
                type="number"
                min="1"
                max="100"
                placeholder="70"
                value={form.capacite}
                onChange={(e) =>
                  setForm((f) => ({ ...f, capacite: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                État initial
              </label>
              <select
                value={form.etat}
                onChange={(e) =>
                  setForm((f) => ({ ...f, etat: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              >
                {ETATS.map((e) => (
                  <option key={e} value={e}>
                    {statutConfig[e]?.label || e}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Modal Changement d'état ── */}
      {editBus && (
        <Modal
          open={!!editBus}
          onClose={() => setEditBus(null)}
          title={`Modifier l'état — ${editBus.immatriculation}`}
          size="sm"
          footer={
            <button
              onClick={() => setEditBus(null)}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Fermer
            </button>
          }
        >
          <div className="space-y-2">
            {ETATS.map((etat) => {
              const cfg      = statutConfig[etat];
              const isActive = editBus.etat === etat;
              return (
                <button
                  key={etat}
                  onClick={() => changerEtat({ IdBus: editBus.IdBus, etat })}
                  disabled={isActive || isPendingEtat}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    isActive
                      ? "border-[#135bec] bg-[#135bec]/5 text-[#135bec]"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  } disabled:opacity-50`}
                >
                  <span>{cfg.label}</span>
                  {isActive && (
                    <span className="text-xs bg-[#135bec] text-white px-2 py-0.5 rounded-full">
                      Actuel
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}