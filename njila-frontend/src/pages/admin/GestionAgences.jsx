/**
 * GestionAgences.jsx – Admin NJILA
 * Liste des agences + création agence + attribution Manager Global
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, MoreVertical, Download, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Spinner from "../../components/ui/Spinner";
import { subscribeService } from "../../services/subscribeService";
import { formatMontant } from "../../utils/formatters";

const statutConfig = {
  ACTIVE:    { label: "Actif",    variant: "success" },
  SUSPENDED: { label: "Suspendu", variant: "danger"  },
  TRIAL:     { label: "Essai",    variant: "primary" },
  EXPIRED:   { label: "Expiré",   variant: "warning" },
};

const PLANS = ["ESSAI", "MENSUEL", "TRIMESTRIEL", "ANNUEL"];
const PLANS_PRIX = { ESSAI: 0, MENSUEL: 50000, TRIMESTRIEL: 130000, ANNUEL: 450000 };

const MOCK_AGENCES = [
  { id: "1", nom: "Général Voyages",     agence_id: "GV-001", email_officiel: "contact@general.cm",  statut_global: "ACTIVE",    date_inscription: "2024-01-15", plan: "ANNUEL",      managerGlobal: "Pierre Ndombo" },
  { id: "2", nom: "Binam Express",        agence_id: "BE-002", email_officiel: "info@binam.cm",       statut_global: "ACTIVE",    date_inscription: "2024-03-20", plan: "MENSUEL",     managerGlobal: "Sylvie Ateba" },
  { id: "3", nom: "Touristique Express",  agence_id: "TE-003", email_officiel: "admin@touristique.cm",statut_global: "TRIAL",     date_inscription: "2024-11-01", plan: "ESSAI",       managerGlobal: "Martin Ewondo" },
  { id: "4", nom: "Buca Voyages",         agence_id: "BV-004", email_officiel: "buca@buca.cm",       statut_global: "SUSPENDED", date_inscription: "2023-07-08", plan: "TRIMESTRIEL", managerGlobal: "Cécile Manga" },
];

export default function GestionAgences() {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [form, setForm] = useState({
    nom: "", emailOfficiel: "", telephone: "",
    managerNom: "", managerPrenom: "", managerEmail: "",
  });

  const { data: agences, isLoading } = useQuery({
    queryKey: ["agences"],
    queryFn: subscribeService.getAgences,
    retry: 1,
    placeholderData: MOCK_AGENCES,
  });

  const agenceListe = agences?.length ? agences : MOCK_AGENCES;

  const { mutate: creerAgence, isPending } = useMutation({
    mutationFn: subscribeService.creerAgence,
    onSuccess: () => {
      toast.success("Agence créée et Manager Global notifié !");
      qc.invalidateQueries({ queryKey: ["agences"] });
      setIsModalOpen(false);
    },
    onError: () => toast.error("Erreur lors de la création."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nom || !form.managerEmail) return toast.error("Nom et email manager requis.");
    creerAgence(form);
  };

  const handleAction = async (agenceId, action) => {
    setActionMenuId(null);
    try {
      if (action === "suspendre") {
        await subscribeService.suspendre(agenceId, {});
        toast.success("Agence suspendue.");
      } else if (action === "reactiver") {
        await subscribeService.reactiver(agenceId, {});
        toast.success("Agence réactivée.");
      } else if (action === "souscrire_essai") {
        await subscribeService.souscrire(agenceId, { plan: "ESSAI" });
        toast.success("Abonnement Essai actif.");
      } else if (action === "souscrire_mensuel") {
        await subscribeService.souscrire(agenceId, { plan: "MENSUEL" });
        toast.success("Abonnement Mensuel actif.");
      } else if (action === "souscrire_annuel") {
        await subscribeService.souscrire(agenceId, { plan: "ANNUEL" });
        toast.success("Abonnement Annuel actif.");
      }
      qc.invalidateQueries({ queryKey: ["agences"] });
    } catch {
      toast.error("Action échouée.");
    }
  };

  const handlePDF = () => {
    const content = `
      <html><head><title>Rapport Agences NJILA</title>
      <style>body{font-family:Arial;padding:20px;font-size:12px}h1{color:#135bec}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:8px}
      th{background:#135bec;color:white}</style></head><body>
      <h1>Rapport des Agences — NJILA Admin</h1>
      <p>Date : ${new Date().toLocaleDateString("fr-FR")} | Total : ${agenceListe.length} agences</p>
      <table><tr><th>Agence</th><th>Plan</th><th>Statut</th><th>Manager Global</th><th>Inscription</th></tr>
      ${agenceListe.map(a=>`<tr><td>${a.nom}</td><td>${a.plan||"—"}</td><td>${a.statut_global}</td><td>${a.managerGlobal||"—"}</td><td>${a.date_inscription?.slice(0,10)||"—"}</td></tr>`).join("")}
      </table></body></html>
    `;
    const win = window.open("", "_blank");
    win.document.write(content);
    win.document.close();
    win.print();
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Gestion des Agences</h1>
          <p className="text-slate-400 mt-1 text-sm">{agenceListe.length} agences enregistrées</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePDF} className="flex items-center gap-2 border border-slate-200 bg-white text-slate-600 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-50">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-[#135bec]/20"
          >
            <Plus className="w-4 h-4" /> Nouvelle agence
          </button>
        </div>
      </div>

      {/* KPI rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total",    value: agenceListe.length, color: "text-slate-900",   bg: "bg-slate-50"   },
          { label: "Actives",  value: agenceListe.filter(a=>a.statut_global==="ACTIVE").length,    color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Suspendues",value:agenceListe.filter(a=>a.statut_global==="SUSPENDED").length, color: "text-red-600",     bg: "bg-red-50"     },
          { label: "En essai", value: agenceListe.filter(a=>a.statut_global==="TRIAL").length,     color: "text-blue-600",    bg: "bg-blue-50"    },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {isLoading ? <Spinner size="lg" className="py-20" /> : (
        <Card padding={false}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["Agence", "Plan", "Manager Global", "Statut", "Inscription", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agenceListe.map(a => {
                const cfg = statutConfig[a.statut_global] || { label: a.statut_global, variant: "gray" };
                return (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(a.nom)}&background=135bec&color=fff&size=36&bold=true`}
                          className="w-9 h-9 rounded-xl"
                          alt={a.nom}
                        />
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{a.nom}</p>
                          <p className="text-xs font-mono text-slate-400">{a.agence_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                        {a.plan || "—"} {PLANS_PRIX[a.plan] ? `· ${formatMontant(PLANS_PRIX[a.plan])}` : "· Gratuit"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#135bec]/10 rounded-full flex items-center justify-center text-xs font-bold text-[#135bec]">
                          {a.managerGlobal?.[0] || "M"}
                        </div>
                        <span className="text-sm text-slate-700">{a.managerGlobal || a.email_officiel}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4"><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                    <td className="px-5 py-4 text-sm text-slate-400">{a.date_inscription?.slice(0, 10)}</td>
                    <td className="px-5 py-4 relative">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === a.id ? null : a.id)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                      {actionMenuId === a.id && (
                        <div className="absolute right-5 top-full mt-1 w-44 bg-white border border-slate-100 rounded-xl shadow-xl z-10 py-1">
                          {a.statut_global === "ACTIVE" ? (
                            <button onClick={() => handleAction(a.id, "suspendre")} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Suspendre</button>
                          ) : (
                            <>
                              <button onClick={() => handleAction(a.id, "reactiver")} className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50">Réactiver</button>
                              <button onClick={() => handleAction(a.id, "souscrire_essai")} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50">Souscrire (Essai)</button>
                              <button onClick={() => handleAction(a.id, "souscrire_mensuel")} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50">Souscrire (Mensuel)</button>
                              <button onClick={() => handleAction(a.id, "souscrire_annuel")} className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50">Souscrire (Annuel)</button>
                            </>
                          )}
                          <button onClick={() => handleAction(a.id, "souscrire_annuel")} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Renouveler</button>
                          <button className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Voir détails</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal Création Agence */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Créer une Nouvelle Agence"
        size="lg"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">Annuler</button>
            <button onClick={handleSubmit} disabled={isPending} className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl">
              {isPending ? "Création…" : "Créer l'agence"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="pb-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Informations de l'agence</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom de l'agence *</label>
                <input placeholder="Ex: Général Voyages" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email officiel *</label>
                <input type="email" placeholder="contact@agence.cm" value={form.emailOfficiel} onChange={e=>setForm(f=>({...f,emailOfficiel:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Téléphone</label>
                <input placeholder="+237 6XX XXX XXX" value={form.telephone} onChange={e=>setForm(f=>({...f,telephone:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
            </div>

          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Assigner un Manager Global</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nom *</label>
                <input placeholder="Ndombo" value={form.managerNom} onChange={e=>setForm(f=>({...f,managerNom:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Prénom</label>
                <input placeholder="Pierre" value={form.managerPrenom} onChange={e=>setForm(f=>({...f,managerPrenom:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email du Manager Global *</label>
                <input type="email" placeholder="manager.global@agence.cm" value={form.managerEmail} onChange={e=>setForm(f=>({...f,managerEmail:e.target.value}))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#135bec]" />
              </div>
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              <strong>Important :</strong> Les identifiants de connexion seront générés automatiquement et envoyés par email au Manager Global. Les clés RSA d'abonnement seront générées selon le plan sélectionné.
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
