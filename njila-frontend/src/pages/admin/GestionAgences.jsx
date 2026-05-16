/**
 * GestionAgences.jsx – Admin NJILA
 * Liste des agences + création agence (opération 1) + affiliation Manager Global (opération 2)
 * (La gestion des abonnements est dans GestionAbonnements.jsx)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserPlus, Download } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { agenceService } from "../../services/agenceService";

// Statuts alignés sur StatutGlobalAgence du modèle Django (valeurs en minuscules)
const statutConfig = {
  active:     { label: "Active",      variant: "success" },
  suspendue:  { label: "Suspendue",   variant: "danger"  },
  expiree:    { label: "Expirée",     variant: "warning" },
  en_attente: { label: "En attente",  variant: "primary" },
};

// Mock aligné sur les champs du modèle Agence Django :
// id_agence (UUID PK), name, adresse, telephone, email_officiel,
// statut_global, logo_image, date_inscription, managerGlobal (via auth)
const MOCK_AGENCES = [
  { id_agence: "uuid-001", name: "Général Voyages",    adresse: "Rue de la Paix, Douala",      telephone: "+237 699 001 001", email_officiel: "contact@general.cm",   statut_global: "active",     date_inscription: "2024-01-15T00:00:00Z", managerGlobal: "Pierre Ndombo" },
  { id_agence: "uuid-002", name: "Binam Express",       adresse: "Avenue Kennedy, Yaoundé",     telephone: "+237 699 002 002", email_officiel: "info@binam.cm",        statut_global: "active",     date_inscription: "2024-03-20T00:00:00Z", managerGlobal: "Sylvie Ateba"  },
  { id_agence: "uuid-003", name: "Touristique Express", adresse: "Carrefour Warda, Bafoussam",  telephone: "+237 699 003 003", email_officiel: "admin@touristique.cm", statut_global: "en_attente", date_inscription: "2024-11-01T00:00:00Z", managerGlobal: null            },
  { id_agence: "uuid-004", name: "Buca Voyages",        adresse: "Boulevard du 20 Mai, Buea",   telephone: "+237 699 004 004", email_officiel: "buca@buca.cm",         statut_global: "suspendue",  date_inscription: "2023-07-08T00:00:00Z", managerGlobal: "Cécile Manga"  },
];

// Payload POST /api/agences/ → champs du modèle Agence
const FORM_AGENCE_INIT = { name: "", adresse: "", telephone: "", email_officiel: "" };
// Payload affilier manager global → id_agence + infos user
const FORM_MANAGER_INIT = { agenceId: "", managerNom: "", managerPrenom: "", managerEmail: "", managerTelephone: "" };

export default function GestionAgences() {
  const qc = useQueryClient();

  // Modal "Créer agence"
  const [isAgenceModalOpen, setIsAgenceModalOpen] = useState(false);
  const [formAgence, setFormAgence] = useState(FORM_AGENCE_INIT);

  // Modal "Affilier Manager Global"
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [formManager, setFormManager] = useState(FORM_MANAGER_INIT);

  /* ── Queries ─────────────────────────────────────────────────── */
  const { data: agences, isLoading } = useQuery({
    queryKey: ["agences"],
    queryFn: () => agenceService.getAgences(),   // GET /api/agences/ — wrapper pour éviter que React Query passe son contexte comme params
    retry: 1,
    placeholderData: MOCK_AGENCES,
  });

  const agenceListe = agences?.length ? agences : MOCK_AGENCES;

  /* ── Mutation : POST /api/agences/ ─────────────────────────── */
  // Payload → { name, adresse, telephone, email_officiel }
  // Réponse → { id_agence, name, adresse, telephone, email_officiel,
  //              statut_global, date_inscription, created_at, updated_at }
  const { mutate: creerAgence, isPending: isPendingAgence } = useMutation({
    mutationFn: agenceService.creerAgence,   // POST /api/agences/
    onSuccess: () => {
      toast.success("Agence créée avec succès !");
      qc.invalidateQueries({ queryKey: ["agences"] });
      setIsAgenceModalOpen(false);
      setFormAgence(FORM_AGENCE_INIT);
    },
    onError: () => toast.error("Erreur lors de la création de l'agence."),
  });

  /* ── Mutation : PATCH /api/agences/{id_agence}/ ─────────────────
     Affilier un Manager Global à une agence existante.
     Payload → { agenceId, managerNom, managerPrenom, managerEmail }
  ─────────────────────────────────────────────────────────────── */
  const { mutate: affilierManager, isPending: isPendingManager } = useMutation({
    mutationFn: agenceService.affilierManagerGlobal,  // PATCH /api/agences/{id_agence}/
    onSuccess: () => {
      toast.success("Manager Global affilié et notifié par email !");
      qc.invalidateQueries({ queryKey: ["agences"] });
      setIsManagerModalOpen(false);
      setFormManager(FORM_MANAGER_INIT);
    },
    onError: () => toast.error("Erreur lors de l'affiliation du Manager Global."),
  });

  /* ── Handlers ────────────────────────────────────────────────── */
  const handleSubmitAgence = (e) => {
    e.preventDefault();
    if (!formAgence.name)           return toast.error("Le nom de l'agence est requis.");
    if (!formAgence.email_officiel) return toast.error("L'email officiel est requis.");
    if (!formAgence.adresse)        return toast.error("L'adresse est requise.");
    creerAgence(formAgence);
  };

  const handleSubmitManager = (e) => {
    e.preventDefault();
    if (!formManager.agenceId) return toast.error("Veuillez sélectionner une agence.");
    if (!formManager.managerEmail) return toast.error("L'email du Manager Global est requis.");
    affilierManager(formManager);
  };

  const handlePDF = () => {
    const content = `
      <html><head><title>Rapport Agences NJILA</title>
      <style>body{font-family:Arial;padding:20px;font-size:12px}h1{color:#135bec}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:8px}
      th{background:#135bec;color:white}</style></head><body>
      <h1>Rapport des Agences — NJILA Admin</h1>
      <p>Date : ${new Date().toLocaleDateString("fr-FR")} | Total : ${agenceListe.length} agences</p>
      <table><tr><th>Agence</th><th>ID</th><th>Statut</th><th>Manager Global</th><th>Inscription</th></tr>
      ${agenceListe.map(a => `<tr><td>${a.name}</td><td>${a.id_agence?.slice(0,8)}…</td><td>${a.statut_global}</td><td>${a.managerGlobal || "—"}</td><td>${a.date_inscription?.slice(0, 10) || "—"}</td></tr>`).join("")}
      </table></body></html>
    `;
    const win = window.open("", "_blank");
    win.document.write(content);
    win.document.close();
    win.print();
  };

  /* ── Rendu ───────────────────────────────────────────────────── */
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Agences</h1>
          <p className="text-slate-400 mt-1 text-sm">{agenceListe.length} agences enregistrées</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePDF}
            className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> PDF
          </button>

          {/* Bouton 1 : Affilier Manager Global */}
          <button
            onClick={() => setIsManagerModalOpen(true)}
            className="flex items-center gap-2 border border-[#135bec] text-[#135bec] bg-white hover:bg-blue-50 text-sm font-bold px-4 py-2 rounded-xl"
          >
            <UserPlus className="w-4 h-4" /> Affilier Manager
          </button>

          {/* Bouton 2 : Créer une agence */}
          <button
            onClick={() => setIsAgenceModalOpen(true)}
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-[#135bec]/20"
          >
            <Plus className="w-4 h-4" /> Nouvelle agence
          </button>
        </div>
      </div>

      {/* KPI rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total",       value: agenceListe.length,                                                   color: "text-slate-900",   bg: "bg-slate-50"   },
          { label: "Actives",     value: agenceListe.filter(a => a.statut_global === "active").length,         color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Suspendues",  value: agenceListe.filter(a => a.statut_global === "suspendue").length,      color: "text-red-600",     bg: "bg-red-50"     },
          { label: "En attente",  value: agenceListe.filter(a => a.statut_global === "en_attente").length,     color: "text-blue-600",    bg: "bg-blue-50"    },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Tableau */}
      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : (
        <Card padding={false}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Agence", "Email", "Manager Global", "Statut", "Inscription"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agenceListe.map(a => {
                const cfg = statutConfig[a.statut_global] || { label: a.statut_global, variant: "gray" };
                return (
                  <tr key={a.id_agence} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {a.logo_image ? (
                          <img src={a.logo_image} className="w-9 h-9 rounded-xl object-cover" alt={a.name} />
                        ) : (
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=135bec&color=fff&size=36&bold=true`}
                            className="w-9 h-9 rounded-xl"
                            alt={a.name}
                          />
                        )}
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{a.name}</p>
                          {/* Affiche les 8 premiers caractères de l'UUID */}
                          <p className="text-xs font-mono text-slate-400">{a.id_agence?.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{a.email_officiel}</td>
                    <td className="px-5 py-4">
                      {a.managerGlobal ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-[#135bec]/10 rounded-full flex items-center justify-center text-xs font-bold text-[#135bec]">
                            {a.managerGlobal[0]}
                          </div>
                          <span className="text-sm text-slate-700">{a.managerGlobal}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setFormManager(f => ({ ...f, agenceId: a.id_agence }));
                            setIsManagerModalOpen(true);
                          }}
                          className="text-xs text-[#135bec] font-semibold hover:underline flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" /> Affilier
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-400">{a.date_inscription?.slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Modal 1 : Créer une Nouvelle Agence
      ═══════════════════════════════════════════════════════════ */}
      <Modal
        open={isAgenceModalOpen}
        onClose={() => setIsAgenceModalOpen(false)}
        title="Créer une Nouvelle Agence"
        size="md"
        footer={
          <>
            <button
              onClick={() => setIsAgenceModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmitAgence}
              disabled={isPendingAgence}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl"
            >
              {isPendingAgence ? "Création…" : "Créer l'agence"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitAgence} className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            Informations de l'agence
          </p>
          {/* name → Agence.name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom de l'agence *</label>
            <input
              placeholder="Ex: Général Voyages"
              value={formAgence.name}
              onChange={e => setFormAgence(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* email_officiel → Agence.email_officiel (unique) */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email officiel *</label>
              <input
                type="email"
                placeholder="contact@agence.cm"
                value={formAgence.email_officiel}
                onChange={e => setFormAgence(f => ({ ...f, email_officiel: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
            {/* telephone → Agence.telephone */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone</label>
              <input
                placeholder="+237 6XX XXX XXX"
                value={formAgence.telephone}
                onChange={e => setFormAgence(f => ({ ...f, telephone: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
              />
            </div>
          </div>
          {/* adresse → Agence.adresse (TextField) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse *</label>
            <textarea
              rows={2}
              placeholder="Ex: Rue de la Paix, Douala"
              value={formAgence.adresse}
              onChange={e => setFormAgence(f => ({ ...f, adresse: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] resize-none"
            />
          </div>
          <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Le statut sera automatiquement défini à <strong>En attente</strong>. Vous pourrez affilier un Manager Global séparément.
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          Modal 2 : Affilier un Manager Global
      ═══════════════════════════════════════════════════════════ */}
      <Modal
        open={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        title="Affilier un Manager Global"
        size="md"
        footer={
          <>
            <button
              onClick={() => setIsManagerModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmitManager}
              disabled={isPendingManager}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl"
            >
              {isPendingManager ? "Affiliation…" : "Affilier le Manager"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitManager} className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            Sélection de l'agence
          </p>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Agence *</label>
            <select
              value={formManager.agenceId}
              onChange={e => setFormManager(f => ({ ...f, agenceId: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] bg-white"
            >
              <option value="">— Choisir une agence —</option>
              {agenceListe.map(a => (
                <option key={a.id_agence} value={a.id_agence}>
                  {a.name}{a.managerGlobal ? ` · ${a.managerGlobal} (actuel)` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Informations du Manager Global
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom *</label>
                <input
                  placeholder="Ndombo"
                  value={formManager.managerNom}
                  onChange={e => setFormManager(f => ({ ...f, managerNom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom</label>
                <input
                  placeholder="Pierre"
                  value={formManager.managerPrenom}
                  onChange={e => setFormManager(f => ({ ...f, managerPrenom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
                <input
                  type="email"
                  placeholder="manager.global@agence.cm"
                  value={formManager.managerEmail}
                  onChange={e => setFormManager(f => ({ ...f, managerEmail: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telephone *</label>
                <input
                  placeholder="+237657098737"
                  value={formManager.managerTelephone}
                  onChange={e => setFormManager(f => ({ ...f, managerTelephone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                />
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
            <strong>Important :</strong> Les identifiants de connexion seront générés automatiquement et envoyés
            par email au Manager Global.
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
