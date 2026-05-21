/**
 * GestionAgences.jsx – Admin NJILA
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

const statutConfig = {
  active:     { label: "Active",     variant: "success" },
  suspendue:  { label: "Suspendue",  variant: "danger"  },
  expiree:    { label: "Expirée",    variant: "warning" },
  en_attente: { label: "En attente", variant: "primary" },
};

const FORM_AGENCE_INIT  = { name: "", adresse: "", telephone: "", email_officiel: "" };
// agenceId peut être pré-rempli (clic depuis la ligne) ou vide (bouton global)
const FORM_MANAGER_INIT = { agenceId: "", managerNom: "", managerPrenom: "", managerEmail: "", managerTelephone: "" };

export default function GestionAgences() {
  const qc = useQueryClient();

  const [isAgenceModalOpen,  setIsAgenceModalOpen]  = useState(false);
  const [formAgence,         setFormAgence]          = useState(FORM_AGENCE_INIT);

  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [formManager,        setFormManager]         = useState(FORM_MANAGER_INIT);
  // true  = modal ouverte depuis la ligne d'une agence → sélecteur masqué
  // false = modal ouverte depuis le bouton global      → sélecteur affiché (sans option vide en valeur)
  const [managerModalFromRow, setManagerModalFromRow] = useState(false);

  /* ── Queries ─────────────────────────────────────────────────── */
  const { data: agences, isLoading } = useQuery({
    queryKey: ["agences"],
    queryFn: () => agenceService.getAgences(),
    retry: 1,
  });

  const agenceListe = agences?.length ? agences : [];

  /* ── Mutation : créer agence ──────────────────────────────────── */
  const { mutate: creerAgence, isPending: isPendingAgence } = useMutation({
    mutationFn: agenceService.creerAgence,
    onSuccess: () => {
      toast.success("Agence créée avec succès !");
      qc.invalidateQueries({ queryKey: ["agences"] });
      setIsAgenceModalOpen(false);
      setFormAgence(FORM_AGENCE_INIT);
    },
    onError: () => toast.error("Erreur lors de la création de l'agence."),
  });

  /* ── Mutation : affilier Manager Global ──────────────────────── */
  const { mutate: affilierManager, isPending: isPendingManager } = useMutation({
    mutationFn: agenceService.affilierManagerGlobal,
    onSuccess: () => {
      toast.success("Manager Global affilié et notifié par email !");
      qc.invalidateQueries({ queryKey: ["agences"] });
      setIsManagerModalOpen(false);
      setFormManager(FORM_MANAGER_INIT);
    },
    onError: (err) => {
      const msg = err?.response?.data?.message || "Erreur lors de l'affiliation.";
      toast.error(msg);
    },
  });

  /* ── Handlers ────────────────────────────────────────────────── */
  const handleSubmitAgence = (e) => {
    e?.preventDefault();
    if (!formAgence.name)           return toast.error("Le nom de l'agence est requis.");
    if (!formAgence.email_officiel) return toast.error("L'email officiel est requis.");
    if (!formAgence.adresse)        return toast.error("L'adresse est requise.");
    creerAgence(formAgence);
  };

  const handleSubmitManager = (e) => {
    e?.preventDefault();
    if (!formManager.agenceId)      return toast.error("Veuillez sélectionner une agence.");
    if (!formManager.managerNom)    return toast.error("Le nom du manager est requis.");
    if (!formManager.managerEmail)  return toast.error("L'email du Manager Global est requis.");
    if (!formManager.managerTelephone) return toast.error("Le téléphone est requis.");
    affilierManager(formManager);
  };

  // Ouvrir la modal "Affilier" depuis le bouton global (sélecteur visible)
  const openManagerModalGlobal = () => {
    setFormManager(FORM_MANAGER_INIT);
    setManagerModalFromRow(false);
    setIsManagerModalOpen(true);
  };

  // Ouvrir la modal "Affilier" depuis la ligne d'une agence (sélecteur masqué)
  const openManagerModalFromRow = (agence) => {
    setFormManager({ ...FORM_MANAGER_INIT, agenceId: agence.id_agence ?? agence.agence_id ?? agence.id });
    setManagerModalFromRow(true);
    setIsManagerModalOpen(true);
  };

  // Agence sélectionnée (pour affichage dans la modal)
  const agenceSelectionnee = agenceListe.find(
    a => (a.id_agence ?? a.agence_id ?? a.id) === formManager.agenceId
  );

  /* ── Export PDF ──────────────────────────────────────────────── */
  const handlePDF = () => {
    const now   = new Date().toLocaleDateString("fr-FR");
    const rows  = agenceListe.map(a => `
      <tr>
        <td>${a.name || "—"}</td>
        <td style="font-size:9px;color:#64748b">${a.id_agence?.slice(0,8) ?? "—"}…</td>
        <td>${a.statut_global || "—"}</td>
        <td>${a.managerGlobal || "—"}</td>
        <td>${a.date_inscription?.slice(0, 10) || "—"}</td>
      </tr>`).join("");
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Rapport Agences NJILA – ${now}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:28px}
        h1{font-size:18px;color:#135bec;margin-bottom:4px;font-weight:800}
        .sub{color:#64748b;font-size:10px;margin-bottom:18px}
        table{width:100%;border-collapse:collapse}
        th{background:#135bec;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase}
        td{padding:6px 10px;border-bottom:1px solid #f1f5f9}
        tr:nth-child(even) td{background:#f8fafc}
        .footer{margin-top:20px;text-align:center;color:#94a3b8;font-size:9px;padding-top:10px;border-top:1px solid #f1f5f9}
        @media print{body{padding:0}}
      </style>
    </head><body>
      <h1>Rapport des Agences — NJILA Admin</h1>
      <p class="sub">Généré le ${now} · ${agenceListe.length} agence${agenceListe.length > 1 ? "s" : ""}</p>
      <table>
        <thead><tr><th>Agence</th><th>ID</th><th>Statut</th><th>Manager Global</th><th>Inscription</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">NJILA Platform · Rapport confidentiel · ${now}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
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
          <button onClick={handlePDF}
            className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={openManagerModalGlobal}
            className="flex items-center gap-2 border border-[#135bec] text-[#135bec] bg-white hover:bg-blue-50 text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            <UserPlus className="w-4 h-4" /> Affilier Manager
          </button>
          <button onClick={() => setIsAgenceModalOpen(true)}
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-[#135bec]/20 transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle agence
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total",      value: agenceListe.length,                                              color: "text-slate-900",   bg: "bg-slate-50"   },
          { label: "Actives",    value: agenceListe.filter(a => a.statut_global === "active").length,    color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Suspendues", value: agenceListe.filter(a => a.statut_global === "suspendue").length, color: "text-red-600",     bg: "bg-red-50"     },
          { label: "En attente", value: agenceListe.filter(a => a.statut_global === "en_attente").length,color: "text-blue-600",    bg: "bg-blue-50"    },
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
          {agenceListe.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">Aucune agence enregistrée.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {["Agence", "Email", "Manager Global", "Statut", "Inscription"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agenceListe.map(a => {
                  const id  = a.id_agence ?? a.agence_id ?? a.id;
                  const cfg = statutConfig[a.statut_global] || { label: a.statut_global, variant: "gray" };
                  return (
                    <tr key={id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {a.logo_image ? (
                            <img src={a.logo_image} className="w-9 h-9 rounded-xl object-cover" alt={a.name} />
                          ) : (
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(a.name || "AG")}&background=135bec&color=fff&size=36&bold=true`}
                              className="w-9 h-9 rounded-xl"
                              alt={a.name}
                            />
                          )}
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{a.name}</p>
                            <p className="text-xs font-mono text-slate-400">{id?.slice(0, 8)}…</p>
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
                            onClick={() => openManagerModalFromRow(a)}
                            className="text-xs text-[#135bec] font-semibold hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <UserPlus className="w-3 h-3" /> Affilier
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {a.date_inscription?.slice(0, 10) || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Modal 1 : Créer une agence
      ═══════════════════════════════════════════════════════════ */}
      <Modal
        open={isAgenceModalOpen}
        onClose={() => setIsAgenceModalOpen(false)}
        title="Créer une Nouvelle Agence"
        size="md"
        footer={
          <>
            <button onClick={() => setIsAgenceModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">
              Annuler
            </button>
            <button onClick={handleSubmitAgence} disabled={isPendingAgence}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
              {isPendingAgence ? "Création…" : "Créer l'agence"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informations de l'agence</p>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom de l'agence *</label>
            <input placeholder="Ex: Général Voyages" value={formAgence.name}
              onChange={e => setFormAgence(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email officiel *</label>
              <input type="email" placeholder="contact@agence.cm" value={formAgence.email_officiel}
                onChange={e => setFormAgence(f => ({ ...f, email_officiel: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone</label>
              <input placeholder="+237 6XX XXX XXX" value={formAgence.telephone}
                onChange={e => setFormAgence(f => ({ ...f, telephone: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Adresse *</label>
            <textarea rows={2} placeholder="Ex: Rue de la Paix, Douala" value={formAgence.adresse}
              onChange={e => setFormAgence(f => ({ ...f, adresse: e.target.value }))}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] resize-none" />
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Le statut sera automatiquement défini à <strong>En attente</strong>. Vous pourrez affilier un Manager Global séparément.
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          Modal 2 : Affilier un Manager Global
          — Si managerModalFromRow : sélecteur d'agence masqué, agence affichée en lecture
          — Si bouton global       : sélecteur visible mais sans option vide sélectionnable
      ═══════════════════════════════════════════════════════════ */}
      <Modal
        open={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        title="Affilier un Manager Global"
        size="md"
        footer={
          <>
            <button onClick={() => setIsManagerModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">
              Annuler
            </button>
            <button onClick={handleSubmitManager} disabled={isPendingManager}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
              {isPendingManager ? "Affiliation…" : "Affilier le Manager"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* ── Sélection agence ── */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Agence cible</p>

            {managerModalFromRow ? (
              /* Clic depuis la ligne → agence fixée, affichage en lecture seule */
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent((agenceSelectionnee?.name || "AG").slice(0,2))}&background=135bec&color=fff&size=32&bold=true`}
                  className="w-8 h-8 rounded-lg"
                  alt={agenceSelectionnee?.name}
                />
                <div>
                  <p className="text-sm font-bold text-slate-900">{agenceSelectionnee?.name || "—"}</p>
                  <p className="text-xs text-slate-400">{agenceSelectionnee?.email_officiel || "—"}</p>
                </div>
                <span className="ml-auto text-xs font-mono text-slate-300">{formManager.agenceId.slice(0,8)}…</span>
              </div>
            ) : (
              /* Bouton global → sélecteur avec placeholder non sélectionnable */
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sélectionner une agence *</label>
                <select
                  value={formManager.agenceId}
                  onChange={e => setFormManager(f => ({ ...f, agenceId: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec] bg-white"
                >
                  {/* Option placeholder non sélectionnable */}
                  <option value="" disabled>— Choisir une agence —</option>
                  {agenceListe.map(a => {
                    const id = a.id_agence ?? a.agence_id ?? a.id;
                    return (
                      <option key={id} value={id}>
                        {a.name}{a.managerGlobal ? ` · ${a.managerGlobal} (actuel)` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* ── Infos manager ── */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Informations du Manager Global</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom *</label>
                <input placeholder="Ndombo" value={formManager.managerNom}
                  onChange={e => setFormManager(f => ({ ...f, managerNom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom</label>
                <input placeholder="Pierre" value={formManager.managerPrenom}
                  onChange={e => setFormManager(f => ({ ...f, managerPrenom: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
                <input type="email" placeholder="manager.global@agence.cm" value={formManager.managerEmail}
                  onChange={e => setFormManager(f => ({ ...f, managerEmail: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone *</label>
                <input placeholder="+237657098737" value={formManager.managerTelephone}
                  onChange={e => setFormManager(f => ({ ...f, managerTelephone: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
            <strong>Important :</strong> Les identifiants de connexion seront générés automatiquement et envoyés par email au Manager Global.
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}