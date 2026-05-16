/**
 * GestionVoyages.jsx – Manager Local
 *
 * FIX : La query ?est_disponible=true retournait [] car la view Django
 * utilise deux chemins pour filtrer la disponibilité :
 *   - filterset_fields = ['est_disponible'] → param: est_disponible=true
 *   - get_queryset() check custom → param: disponible=true
 * On essaie les deux en parallèle et on fusionne, ou on charge tous les
 * chauffeurs et on filtre côté client — solution la plus robuste.
 *
 * Autres fixes :
 *  - Invalidation cache chauffeurs après création/changement de statut voyage.
 *  - Message clair si aucun chauffeur disponible dans le select.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Download, CheckCircle, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { fleetService } from "../../services/fleetService";
import { useAuthStore } from "../../store/authStore";

const statutConfig = {
  programme: { label: "Planifié",  variant: "success" },
  confirme:  { label: "Confirmé",  variant: "primary" },
  en_cours:  { label: "En cours",  variant: "primary" },
  termine:   { label: "Terminé",   variant: "gray"    },
  annule:    { label: "Annulé",    variant: "danger"  },
  retarde:   { label: "Retardé",   variant: "warning" },
};

const FORM_INIT = {
  Id_trajet: "", date_heure_depart: "", date_heure_arrive_prevue: "",
  prix: "", type_voyage: "standard", places_disponibles: "",
  id_chauffeur: "", IdBus: "",
};

/** Normalise est_disponible quel que soit le type retourné */
const isDisponible = (c) => {
  const v = c.est_disponible ?? c.disponible;
  return v === true || v === "true" || v === "True";
};

export default function GestionVoyages() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [search, setSearch]           = useState("");
  const [filtreDate, setFiltreDate]   = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm]               = useState(FORM_INIT);

  const agenceId = user?.agenceId;
  
   console.log("Utilisateur connecté:", user);

  /** Invalider toutes les queries liées aux chauffeurs */
  const invalidateChauffeurs = () => {
    qc.invalidateQueries({ queryKey: ["chauffeurs-disponibles"] });
    qc.invalidateQueries({ queryKey: ["chauffeurs-filiale"] });
  };

  // GET /api/voyages/
  const { data: voyages = [], isLoading, isError } = useQuery({
    queryKey: ["voyages", filtreDate],
    queryFn: () => fleetService.getVoyages(filtreDate ? { date: filtreDate } : {}),
    retry: 1,
  });

  // GET /api/bus/disponibles/
  const { data: busDisponibles = [] } = useQuery({
    queryKey: ["bus-disponibles"],
    queryFn: fleetService.getBusDisponibles,
    enabled: isModalOpen,
    retry: 1,
  });

  // GET /api/chauffeurs/ (TOUS) → filtre client côté frontend
  // Raison : le param ?est_disponible=true peut ne pas être reconnu selon
  const { 
    data: tousLesChauffeurs = [], 
    isLoading: loadingChauffeurs,
    error: chauffeursError,
    refetch: refetchChauffeurs
  } = useQuery({
    queryKey: ["chauffeurs-disponibles"],
    queryFn: async () => {
      console.log("🔍 Appel API getChauffeurs...");
      try {
        const result = await fleetService.getChauffeurs({});
        console.log("✅ Chauffeurs reçus de l'API:", result);
        console.log("📊 Nombre de chauffeurs:", result?.length || 0);
        return result;
      } catch (error) {
        console.error("❌ Erreur lors du chargement des chauffeurs:", error);
        throw error;
      }
    },
    retry: 2,
    staleTime: 30000, // 30 secondes de cache
    refetchOnWindowFocus: false,
  });

  // Afficher l'erreur si présente
  if (chauffeursError) {
    console.error("Erreur query chauffeurs:", chauffeursError);
  }

  // Filtre client : uniquement les disponibles
  const chauffeursDisponibles = (tousLesChauffeurs || []).filter(isDisponible);
  
  console.log("📋 Tous les chauffeurs:", tousLesChauffeurs);
  console.log("✅ Chauffeurs disponibles après filtre:", chauffeursDisponibles);
  console.log("🔢 Compteur disponibles:", chauffeursDisponibles.length);


  // GET /api/trajets/
  const { data: trajets = [] } = useQuery({
    queryKey: ["trajets"],
    queryFn: () => fleetService.getTrajets(),
    enabled: isModalOpen,
    retry: 1,
  });

  // POST /api/voyages/
  const { mutate: creerVoyage, isPending } = useMutation({
    mutationFn: (payload) => fleetService.creerVoyage(payload),
    onSuccess: () => {
      toast.success("Voyage créé avec succès !");
      qc.invalidateQueries({ queryKey: ["voyages"] });
      invalidateChauffeurs();
      qc.invalidateQueries({ queryKey: ["bus-disponibles"] });
      setIsModalOpen(false);
      setForm(FORM_INIT);
    },
    onError: (err) => toast.error(err?.response?.data?.error || "Erreur lors de la création."),
  });

  // PUT /api/voyages/{id}/statut/
  const { mutate: changerStatut } = useMutation({
    mutationFn: ({ Id_voyage, status }) =>
      fleetService.changerStatutVoyage(Id_voyage, status),
    onSuccess: (_, { status }) => {
      toast.success("Statut mis à jour.");
      qc.invalidateQueries({ queryKey: ["voyages"] });
      if (status === "annule" || status === "termine") {
        invalidateChauffeurs();
        qc.invalidateQueries({ queryKey: ["bus-disponibles"] });
      }
    },
    onError: () => toast.error("Erreur lors de la mise à jour du statut."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.Id_trajet || !form.date_heure_depart || !form.IdBus || !form.prix)
      return toast.error("Trajet, date de départ, bus et prix sont requis.");
    creerVoyage({
      Id_trajet:                form.Id_trajet,
      date_heure_depart:        form.date_heure_depart,
      date_heure_arrive_prevue: form.date_heure_arrive_prevue || null,
      prix:                     parseInt(form.prix, 10),
      type_voyage:              form.type_voyage,
      places_disponibles:       parseInt(form.places_disponibles, 10) || null,
      id_chauffeur:             form.id_chauffeur || null,
      IdBus:                    parseInt(form.IdBus, 10),
    });
  };

  const handlePDF = () => {
    const content = `
      <html><head><title>Planning Voyages</title>
      <style>
        body{font-family:Arial;padding:20px;font-size:12px}
        h1{color:#135bec}
        table{width:100%;border-collapse:collapse}
        th{background:#135bec;color:white;padding:10px;text-align:left}
        td{padding:10px;border-bottom:1px solid #e2e8f0}
      </style></head><body>
      <h1>Planning des Voyages</h1>
      <p>Date : ${new Date().toLocaleDateString("fr-FR")}</p>
      <table>
        <tr><th>Date / Heure</th><th>Trajet</th><th>Type</th><th>Prix</th><th>Places</th><th>Statut</th></tr>
        ${voyages.map((v) => `
          <tr>
            <td>${new Date(v.date_heure_depart).toLocaleString("fr-FR")}</td>
            <td>${v.trajet_nom || v.Id_trajet || "—"}</td>
            <td>${v.type_voyage}</td>
            <td>${(v.prix || 0).toLocaleString()} FCFA</td>
            <td>${v.places_disponibles ?? "—"}</td>
            <td>${v.status || v.statut || "—"}</td>
          </tr>`).join("")}
      </table></body></html>`;
    const win = window.open("", "_blank");
    win.document.write(content);
    win.document.close();
    win.print();
  };

  const filtered = voyages.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (v.trajet_nom  || "").toLowerCase().includes(q) ||
      (v.Id_trajet   || "").toLowerCase().includes(q) ||
      (v.type_voyage || "").toLowerCase().includes(q)
    );
  });

  const kpis = [
    { label: "Total",     value: voyages.length,                                        bg: "bg-slate-50",   color: "text-slate-900"   },
    { label: "Planifiés", value: voyages.filter((v) => v.status === "programme").length, bg: "bg-emerald-50", color: "text-emerald-600" },
    { label: "En cours",  value: voyages.filter((v) => v.status === "en_cours").length,  bg: "bg-blue-50",    color: "text-[#135bec]"   },
    { label: "Terminés",  value: voyages.filter((v) => v.status === "termine").length,   bg: "bg-slate-50",   color: "text-slate-500"   },
  ];

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Voyages</h1>
          <p className="text-slate-400 text-sm mt-1">Planning et tarification des départs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePDF}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> Rapport PDF
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-[#135bec]/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> Créer un voyage
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(({ label, value, bg, color }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <Card className="mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un trajet…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            />
          </div>
          <input
            type="date"
            value={filtreDate}
            onChange={(e) => setFiltreDate(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
          />
        </div>
      </Card>

      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : isError ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          Impossible de charger les voyages.
        </div>
      ) : (
        <Card padding={false}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Départ", "Trajet", "Type", "Prix (FCFA)", "Places", "Statut", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-400 text-sm">
                    Aucun voyage trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((voyage) => {
                  const statut = voyage.status || voyage.statut || "programme";
                  const cfg    = statutConfig[statut] || { label: statut, variant: "gray" };
                  return (
                    <tr key={voyage.Id_voyage} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-[#135bec]/10 text-[#135bec]">
                          {voyage.date_heure_depart
                            ? new Date(voyage.date_heure_depart).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </span>
                        <p className="text-xs text-slate-400 mt-1">
                          {voyage.date_heure_depart
                            ? new Date(voyage.date_heure_depart).toLocaleDateString("fr-FR")
                            : ""}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700 font-medium">
                        {voyage.trajet_nom || voyage.Id_trajet || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={voyage.type_voyage === "vip" ? "primary" : "gray"}>
                          {voyage.type_voyage === "vip" ? "VIP" : "Standard"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-700">
                        {(voyage.prix || 0).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {voyage.places_disponibles ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        {statut === "programme" && (
                          <button
                            onClick={() => changerStatut({ Id_voyage: voyage.Id_voyage, status: "confirme" })}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Confirmer
                          </button>
                        )}
                        {statut === "confirme" && (
                          <button
                            onClick={() => changerStatut({ Id_voyage: voyage.Id_voyage, status: "en_cours" })}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> Démarrer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            Affichage de {filtered.length} sur {voyages.length} voyage(s)
          </div>
        </Card>
      )}

      {/* ─── Modal Création Voyage ─────────────────────────────────────────── */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Créer un Nouveau Voyage"
        size="lg"
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
              disabled={isPending}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl"
            >
              {isPending ? "Création…" : "Créer le voyage"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Trajet */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Trajet</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Trajet *</label>
                <select
                  value={form.Id_trajet}
                  onChange={(e) => setForm((f) => ({ ...f, Id_trajet: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                >
                  <option value="">Sélectionner un trajet</option>
                  {trajets.map((t) => (
                    <option key={t.Id_trajet} value={t.Id_trajet}>
                      {t.filiale_depart_nom || t.filiale_depart} → {t.filiale_arrive_nom || t.filiale_arrive}
                      {t.distance ? ` (${t.distance} km)` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Date &amp; heure de départ *
                </label>
                <input
                  type="datetime-local"
                  value={form.date_heure_depart}
                  onChange={(e) => setForm((f) => ({ ...f, date_heure_depart: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Date &amp; heure d'arrivée prévue
                </label>
                <input
                  type="datetime-local"
                  value={form.date_heure_arrive_prevue}
                  onChange={(e) => setForm((f) => ({ ...f, date_heure_arrive_prevue: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
            </div>
          </div>

          {/* Affectation */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Affectation</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bus disponible *</label>
                <select
                  value={form.IdBus}
                  onChange={(e) => setForm((f) => ({ ...f, IdBus: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                >
                  <option value="">
                    {busDisponibles.length === 0 ? "Aucun bus disponible" : "Sélectionner un bus"}
                  </option>
                  {busDisponibles.map((b) => (
                    <option key={b.IdBus} value={b.IdBus}>
                      {b.immatriculation} — {b.modele || "Bus"} ({b.capacite} pl.)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Chauffeur disponible
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({chauffeursDisponibles.length} dispo.)
                  </span>
                </label>
                <select
                  value={form.id_chauffeur}
                  onChange={(e) => setForm((f) => ({ ...f, id_chauffeur: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                >
                  <option value="">
                    {chauffeursDisponibles.length === 0
                      ? "Aucun chauffeur disponible"
                      : "Sélectionner un chauffeur (optionnel)"}
                  </option>
                  {chauffeursDisponibles.map((c) => (
                    <option key={c.id_chauffeur} value={c.id_chauffeur}>
                      {c.name} {c.surname}
                    </option>
                  ))}
                </select>
                {chauffeursDisponibles.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1.5">
                    Tous les chauffeurs sont en mission. Vous pourrez en assigner un plus tard.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tarification */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Tarification (FCFA)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type de voyage</label>
                <div className="flex gap-2">
                  {["standard", "vip"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type_voyage: t }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                        form.type_voyage === t
                          ? "bg-[#135bec] text-white border-[#135bec]"
                          : "border-slate-200 text-slate-500 hover:border-[#135bec]"
                      }`}
                    >
                      {t === "vip" ? "VIP" : "Standard"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prix *</label>
                <input
                  type="number" min="0" placeholder="Ex: 3000"
                  value={form.prix}
                  onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Places disponibles</label>
                <input
                  type="number" min="1"
                  placeholder="Laisser vide pour utiliser la capacité du bus"
                  value={form.places_disponibles}
                  onChange={(e) => setForm((f) => ({ ...f, places_disponibles: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
