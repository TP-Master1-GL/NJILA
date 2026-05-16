import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Download, CheckCircle, Play, XCircle,
  MapPin, Clock, Calendar, Users, Banknote, Edit3,
  ChevronRight, Bus, AlertCircle, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { fleetService } from "../../services/fleetService";
import { useAuthStore } from "../../store/authStore";

// ─── Config statuts ──────────────────────────────────────────────────────────
const STATUT_CONFIG = {
  programme: { label: "Planifié",  variant: "success", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  confirme:  { label: "Confirmé",  variant: "primary", color: "text-blue-600",    bg: "bg-blue-50 border-blue-200"       },
  en_cours:  { label: "En cours",  variant: "primary", color: "text-indigo-600",  bg: "bg-indigo-50 border-indigo-200"   },
  termine:   { label: "Terminé",   variant: "gray",    color: "text-slate-500",   bg: "bg-slate-50 border-slate-200"     },
  annule:    { label: "Annulé",    variant: "danger",  color: "text-red-600",     bg: "bg-red-50 border-red-200"         },
  retarde:   { label: "Retardé",   variant: "warning", color: "text-amber-600",   bg: "bg-amber-50 border-amber-200"     },
};

const FORM_INIT = {
  Id_trajet: "", date_heure_depart: "", date_heure_arrive_prevue: "",
  prix: "", type_voyage: "standard", places_disponibles: "",
  id_chauffeur: "", IdBus: "",
};

const isDisponible = (c) => {
  const v = c.est_disponible ?? c.disponible;
  return v === true || v === "true" || v === "True";
};

const fmtHeure = (dt) =>
  dt ? new Date(dt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDate = (dt) =>
  dt ? new Date(dt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtPrix = (p) =>
  p != null ? Number(p).toLocaleString("fr-FR") + " FCFA" : "—";

// Extrait ville départ / ville arrivée depuis trajet_info "VilleDep → VilleArr"
const parseTrajet = (v) => {
  const info = v.trajet_info || v.trajet_nom || "";
  const parts = info.split("→").map((s) => s.trim());
  return { depart: parts[0] || "—", arrivee: parts[1] || "—" };
};

// ─── Modale confirmation annulation ─────────────────────────────────────────
function ModalAnnulation({ open, onClose, onConfirm, voyage, isPending }) {
  const [motif, setMotif] = useState("");
  if (!open || !voyage) return null;
  const { depart, arrivee } = parseTrajet(voyage);
  return (
    <Modal open={open} onClose={onClose} title="Annuler ce voyage" size="md"
      footer={
        <>
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">
            Retour
          </button>
          <button onClick={() => onConfirm(motif)} disabled={isPending}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {isPending ? "Annulation…" : "Confirmer l'annulation"}
          </button>
        </>
      }>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {depart} → {arrivee}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {fmtDate(voyage.date_heure_depart)} · {fmtHeure(voyage.date_heure_depart)}
            </p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Motif d'annulation <span className="text-slate-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            placeholder="Ex : Problème technique, conditions météo…"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
        </div>
        <p className="text-xs text-slate-400">
          Cette action libérera le bus et le chauffeur assignés et ne peut pas être annulée.
        </p>
      </div>
    </Modal>
  );
}

// ─── Modale modification voyage ──────────────────────────────────────────────
function ModalModification({ open, onClose, voyage, trajets, busDisponibles, chauffeurs, onSave, isPending }) {
  const [form, setForm] = useState(null);

  // Initialiser le formulaire quand la modale s'ouvre
  if (open && voyage && !form) {
    setForm({
      date_heure_depart:        voyage.date_heure_depart?.slice(0, 16) || "",
      date_heure_arrive_prevue: voyage.date_heure_arrive_prevue?.slice(0, 16)
                                  || voyage.dateHeureArrivee?.slice(0, 16) || "",
      prix:                     voyage.prix || "",
      type_voyage:              voyage.type_voyage?.toLowerCase() || "standard",
      places_disponibles:       voyage.places_disponibles || "",
    });
  }

  if (!open || !voyage || !form) return null;

  const { depart, arrivee } = parseTrajet(voyage);

  const handleClose = () => { setForm(null); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="Modifier le voyage" size="lg"
      footer={
        <>
          <button onClick={handleClose}
            className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={() => onSave(form)} disabled={isPending}
            className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </>
      }>
      <div className="space-y-5">

        {/* En-tête trajet non modifiable */}
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-blue-900">{depart} → {arrivee}</p>
            <p className="text-xs text-blue-500 mt-0.5">Le trajet ne peut pas être modifié</p>
          </div>
        </div>

        {/* Horaires */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Horaires</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Heure de départ *</label>
              <input type="datetime-local" value={form.date_heure_depart}
                onChange={(e) => setForm((f) => ({ ...f, date_heure_depart: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Heure d'arrivée prévue</label>
              <input type="datetime-local" value={form.date_heure_arrive_prevue}
                onChange={(e) => setForm((f) => ({ ...f, date_heure_arrive_prevue: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
          </div>
        </div>

        {/* Tarification */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tarification</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type de voyage</label>
              <div className="flex gap-2">
                {["standard", "vip"].map((t) => (
                  <button key={t} type="button"
                    onClick={() => setForm((f) => ({ ...f, type_voyage: t }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                      form.type_voyage === t
                        ? "bg-[#135bec] text-white border-[#135bec]"
                        : "border-slate-200 text-slate-500 hover:border-[#135bec]"
                    }`}>
                    {t === "vip" ? "VIP" : "Standard"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prix (FCFA) *</label>
              <input type="number" min="0" value={form.prix}
                onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Places disponibles</label>
              <input type="number" min="1" value={form.places_disponibles}
                onChange={(e) => setForm((f) => ({ ...f, places_disponibles: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function GestionVoyages() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [search,          setSearch]          = useState("");
  const [filtreDate,      setFiltreDate]      = useState("");
  const [filtreStatut,    setFiltreStatut]    = useState("");
  const [isModalCreate,   setIsModalCreate]   = useState(false);
  const [voyageAnnuler,   setVoyageAnnuler]   = useState(null);
  const [voyageModifier,  setVoyageModifier]  = useState(null);
  const [form,            setForm]            = useState(FORM_INIT);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: voyages = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["voyages", filtreDate],
    queryFn:  () => fleetService.getVoyages(filtreDate ? { date_debut: filtreDate } : {}),
    retry: 1,
  });

  const { data: busDisponibles = [] } = useQuery({
    queryKey: ["bus-disponibles"],
    queryFn:  fleetService.getBusDisponibles,
    enabled:  isModalCreate,
    retry: 1,
  });

  const { data: tousLesChauffeurs = [] } = useQuery({
    queryKey: ["chauffeurs-all"],
    queryFn:  () => fleetService.getChauffeurs({}),
    enabled:  isModalCreate,
    retry: 1,
  });

  const { data: trajets = [] } = useQuery({
    queryKey: ["trajets"],
    queryFn:  () => fleetService.getTrajets(),
    enabled:  isModalCreate,
    retry: 1,
  });

  const chauffeursDisponibles = tousLesChauffeurs.filter(isDisponible);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["voyages"] });
    qc.invalidateQueries({ queryKey: ["chauffeurs-all"] });
    qc.invalidateQueries({ queryKey: ["bus-disponibles"] });
  };

  const { mutate: creerVoyage, isPending: pendingCreate } = useMutation({
    mutationFn: (payload) => fleetService.creerVoyage(payload),
    onSuccess: () => {
      toast.success("Voyage créé avec succès !");
      invalidateAll();
      setIsModalCreate(false);
      setForm(FORM_INIT);
    },
    onError: (err) => toast.error(err?.response?.data?.error || "Erreur lors de la création."),
  });

  const { mutate: changerStatut, isPending: pendingStatut } = useMutation({
    mutationFn: ({ Id_voyage, status, motif }) =>
      fleetService.changerStatutVoyage(Id_voyage, status, motif),
    onSuccess: (_, { status }) => {
      toast.success(
        status === "annule" ? "Voyage annulé." :
        status === "confirme" ? "Voyage confirmé." :
        status === "en_cours" ? "Voyage démarré." : "Statut mis à jour."
      );
      invalidateAll();
      setVoyageAnnuler(null);
    },
    onError: () => toast.error("Erreur lors de la mise à jour du statut."),
  });

  const { mutate: modifierVoyage, isPending: pendingModif } = useMutation({
    mutationFn: ({ Id_voyage, payload }) => fleetService.modifierVoyage(Id_voyage, payload),
    onSuccess: () => {
      toast.success("Voyage modifié avec succès !");
      invalidateAll();
      setVoyageModifier(null);
    },
    onError: (err) => toast.error(err?.response?.data?.error || "Erreur lors de la modification."),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCreate = (e) => {
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

  const handleSaveModif = (formData) => {
    if (!voyageModifier) return;
    modifierVoyage({
      Id_voyage: voyageModifier.Id_voyage,
      payload: {
        date_heure_depart:        formData.date_heure_depart || undefined,
        date_heure_arrive_prevue: formData.date_heure_arrive_prevue || undefined,
        prix:                     formData.prix ? parseInt(formData.prix, 10) : undefined,
        type_voyage:              formData.type_voyage,
        places_disponibles:       formData.places_disponibles
                                    ? parseInt(formData.places_disponibles, 10)
                                    : undefined,
      },
    });
  };

  // ── Filtrage ───────────────────────────────────────────────────────────────
  const filtered = voyages.filter((v) => {
    const { depart, arrivee } = parseTrajet(v);
    const q = search.toLowerCase();
    const matchSearch = !search ||
      depart.toLowerCase().includes(q) ||
      arrivee.toLowerCase().includes(q) ||
      (v.type_voyage || "").toLowerCase().includes(q) ||
      (v.bus_immatriculation || "").toLowerCase().includes(q);
    const matchStatut = !filtreStatut || v.status === filtreStatut;
    return matchSearch && matchStatut;
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = [
    { label: "Total",     value: voyages.length,                                          color: "text-slate-900",   bg: "bg-slate-50"   },
    { label: "Planifiés", value: voyages.filter((v) => v.status === "programme").length,  color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "En cours",  value: voyages.filter((v) => v.status === "en_cours").length,   color: "text-[#135bec]",   bg: "bg-blue-50"    },
    { label: "Annulés",   value: voyages.filter((v) => v.status === "annule").length,     color: "text-red-600",     bg: "bg-red-50"     },
  ];

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handlePDF = () => {
    const rows = filtered.map((v) => {
      const { depart, arrivee } = parseTrajet(v);
      return `<tr>
        <td>${fmtDate(v.date_heure_depart)}</td>
        <td>${fmtHeure(v.date_heure_depart)}</td>
        <td>${fmtHeure(v.date_heure_arrive_prevue || v.dateHeureArrivee)}</td>
        <td>${depart}</td>
        <td>${arrivee}</td>
        <td>${(v.type_voyage || "").toUpperCase()}</td>
        <td>${fmtPrix(v.prix)}</td>
        <td>${v.places_disponibles ?? "—"}</td>
        <td>${STATUT_CONFIG[v.status]?.label || v.status}</td>
      </tr>`;
    }).join("");

    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Planning Voyages</title>
      <style>
        body{font-family:Arial;padding:20px;font-size:11px}
        h1{color:#135bec;margin-bottom:4px}
        p{color:#888;margin-bottom:16px}
        table{width:100%;border-collapse:collapse}
        th{background:#135bec;color:white;padding:8px;text-align:left;font-size:10px;text-transform:uppercase}
        td{padding:8px;border-bottom:1px solid #e2e8f0}
        tr:hover td{background:#f8fafc}
      </style></head><body>
      <h1>Planning des Voyages</h1>
      <p>Généré le ${new Date().toLocaleDateString("fr-FR")} — ${filtered.length} voyage(s)</p>
      <table>
        <tr><th>Date</th><th>Départ</th><th>Arrivée</th><th>Ville départ</th><th>Ville arrivée</th><th>Type</th><th>Prix</th><th>Places</th><th>Statut</th></tr>
        ${rows}
      </table></body></html>`);
    win.document.close();
    win.print();
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <DashboardLayout>
      {/* ── En-tête ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Voyages</h1>
          <p className="text-slate-400 text-sm mt-1">Planning, tarification et suivi des départs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handlePDF}
            className="flex items-center gap-2 border border-slate-200 text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => setIsModalCreate(true)}
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-[#135bec]/20 transition-colors">
            <Plus className="w-4 h-4" /> Créer un voyage
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpis.map(({ label, value, bg, color }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <Card className="mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Ville, trajet, immatriculation…"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
          </div>
          <input type="date" value={filtreDate} onChange={(e) => setFiltreDate(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}
            className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* ── Tableau / Cartes ── */}
      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : isError ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          Impossible de charger les voyages.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">
          Aucun voyage trouvé pour ces critères.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((voyage) => {
            const statut   = voyage.status || "programme";
            const cfg      = STATUT_CONFIG[statut] || { label: statut, variant: "gray", color: "text-slate-500", bg: "bg-slate-50 border-slate-200" };
            const { depart, arrivee } = parseTrajet(voyage);
            const peutModifier = ["programme", "confirme"].includes(statut);
            const peutConfirmer = statut === "programme";
            const peutDemarrer  = statut === "confirme";
            const peutAnnuler   = ["programme", "confirme", "retarde"].includes(statut);

            const dateDepart   = voyage.date_heure_depart;
            const dateArrivee  = voyage.date_heure_arrive_prevue || voyage.dateHeureArrivee;

            return (
              <div key={voyage.Id_voyage}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">

                {/* Barre statut */}
                <div className={`h-1 w-full ${
                  statut === "programme" ? "bg-emerald-400" :
                  statut === "confirme"  ? "bg-blue-400"    :
                  statut === "en_cours"  ? "bg-indigo-500"  :
                  statut === "termine"   ? "bg-slate-300"   :
                  statut === "annule"    ? "bg-red-400"     :
                  "bg-amber-400"
                }`} />

                <div className="p-5">
                  <div className="flex items-start gap-4 flex-wrap">

                    {/* ── Colonne 1 : Date ── */}
                    <div className="flex flex-col items-center justify-center bg-[#135bec]/5 rounded-xl p-3 min-w-[80px]">
                      <Calendar className="w-4 h-4 text-[#135bec] mb-1" />
                      <p className="text-xs font-bold text-[#135bec] text-center leading-tight">
                        {dateDepart
                          ? new Date(dateDepart).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {dateDepart ? new Date(dateDepart).getFullYear() : ""}
                      </p>
                    </div>

                    {/* ── Colonne 2 : Trajet ── */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm font-bold text-slate-900">{depart}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#135bec]" />
                          <span className="text-sm font-bold text-slate-900">{arrivee}</span>
                        </div>
                      </div>

                      {/* Horaires */}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Départ : <strong className="text-slate-700">{fmtHeure(dateDepart)}</strong></span>
                        </div>
                        {dateArrivee && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Arrivée : <strong className="text-slate-700">{fmtHeure(dateArrivee)}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Colonne 3 : Infos ── */}
                    <div className="flex gap-4 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Banknote className="w-3.5 h-3.5" />
                          <span className="font-bold text-slate-800">{fmtPrix(voyage.prix)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Users className="w-3.5 h-3.5" />
                          <span>{voyage.places_disponibles ?? "—"} place(s) dispo.</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Bus className="w-3.5 h-3.5" />
                          <span>{voyage.bus_immatriculation || "Bus non assigné"}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                          voyage.type_voyage === "vip"
                            ? "bg-purple-50 border-purple-200 text-purple-700"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}>
                          {voyage.type_voyage === "vip" ? "VIP" : "Standard"}
                        </span>
                      </div>
                    </div>

                    {/* ── Colonne 4 : Actions ── */}
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      {peutModifier && (
                        <button onClick={() => setVoyageModifier(voyage)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#135bec] hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors">
                          <Edit3 className="w-3.5 h-3.5" /> Modifier
                        </button>
                      )}
                      {peutConfirmer && (
                        <button
                          onClick={() => changerStatut({ Id_voyage: voyage.Id_voyage, status: "confirme" })}
                          disabled={pendingStatut}
                          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                          <CheckCircle className="w-3.5 h-3.5" /> Confirmer
                        </button>
                      )}
                      {peutDemarrer && (
                        <button
                          onClick={() => changerStatut({ Id_voyage: voyage.Id_voyage, status: "en_cours" })}
                          disabled={pendingStatut}
                          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                          <Play className="w-3.5 h-3.5" /> Démarrer
                        </button>
                      )}
                      {peutAnnuler && (
                        <button onClick={() => setVoyageAnnuler(voyage)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
                          <XCircle className="w-3.5 h-3.5" /> Annuler
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4 text-center">
        {filtered.length} voyage(s) affiché(s) sur {voyages.length}
      </p>

      {/* ── Modale Création ── */}
      <Modal open={isModalCreate} onClose={() => { setIsModalCreate(false); setForm(FORM_INIT); }}
        title="Créer un Nouveau Voyage" size="lg"
        footer={
          <>
            <button onClick={() => { setIsModalCreate(false); setForm(FORM_INIT); }}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">
              Annuler
            </button>
            <button onClick={handleCreate} disabled={pendingCreate}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
              {pendingCreate ? "Création…" : "Créer le voyage"}
            </button>
          </>
        }>
        <form onSubmit={handleCreate} className="space-y-5">

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Trajet & Horaires</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Trajet *</label>
                <select value={form.Id_trajet}
                  onChange={(e) => setForm((f) => ({ ...f, Id_trajet: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]">
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
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Heure de départ *</label>
                <input type="datetime-local" value={form.date_heure_depart}
                  onChange={(e) => setForm((f) => ({ ...f, date_heure_depart: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Heure d'arrivée prévue</label>
                <input type="datetime-local" value={form.date_heure_arrive_prevue}
                  onChange={(e) => setForm((f) => ({ ...f, date_heure_arrive_prevue: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Affectation</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Bus disponible *</label>
                <select value={form.IdBus}
                  onChange={(e) => setForm((f) => ({ ...f, IdBus: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]">
                  <option value="">{busDisponibles.length === 0 ? "Aucun bus disponible" : "Sélectionner un bus"}</option>
                  {busDisponibles.map((b) => (
                    <option key={b.IdBus} value={b.IdBus}>
                      {b.immatriculation} — {b.modele || "Bus"} ({b.capacite} pl.)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Chauffeur <span className="text-slate-400 font-normal">({chauffeursDisponibles.length} dispo.)</span>
                </label>
                <select value={form.id_chauffeur}
                  onChange={(e) => setForm((f) => ({ ...f, id_chauffeur: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]">
                  <option value="">{chauffeursDisponibles.length === 0 ? "Aucun chauffeur disponible" : "Optionnel"}</option>
                  {chauffeursDisponibles.map((c) => (
                    <option key={c.id_chauffeur} value={c.id_chauffeur}>
                      {c.name} {c.surname}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Tarification</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
                <div className="flex gap-2">
                  {["standard", "vip"].map((t) => (
                    <button key={t} type="button"
                      onClick={() => setForm((f) => ({ ...f, type_voyage: t }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                        form.type_voyage === t
                          ? "bg-[#135bec] text-white border-[#135bec]"
                          : "border-slate-200 text-slate-500 hover:border-[#135bec]"
                      }`}>
                      {t === "vip" ? "VIP" : "Standard"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prix (FCFA) *</label>
                <input type="number" min="0" placeholder="Ex: 3000" value={form.prix}
                  onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Places disponibles</label>
                <input type="number" min="1"
                  placeholder="Laisser vide pour utiliser la capacité du bus"
                  value={form.places_disponibles}
                  onChange={(e) => setForm((f) => ({ ...f, places_disponibles: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Modale Modification ── */}
      <ModalModification
        open={!!voyageModifier}
        onClose={() => setVoyageModifier(null)}
        voyage={voyageModifier}
        trajets={trajets}
        busDisponibles={busDisponibles}
        chauffeurs={chauffeursDisponibles}
        onSave={handleSaveModif}
        isPending={pendingModif}
      />

      {/* ── Modale Annulation ── */}
      <ModalAnnulation
        open={!!voyageAnnuler}
        onClose={() => setVoyageAnnuler(null)}
        voyage={voyageAnnuler}
        onConfirm={(motif) =>
          changerStatut({ Id_voyage: voyageAnnuler.Id_voyage, status: "annule", motif })
        }
        isPending={pendingStatut}
      />
    </DashboardLayout>
  );
}