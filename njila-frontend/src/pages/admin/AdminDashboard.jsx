import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Building2, TrendingUp, AlertTriangle,
  Clock, ArrowUp, Download, RefreshCw,
  Bell, MoreVertical, ExternalLink, Star,
  Zap, Activity, Users, CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Modal from "../../components/ui/Modal";
import Badge from "../../components/ui/Badge";
import { subscribeService } from "../../services/subscribeService";
import { formatMontant } from "../../utils/formatters";
import Spinner from "../../components/ui/Spinner";
import NjilaLogo from "../../components/ui/NjilaLogo";

// ── Tooltip personnalisé ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs">
      <p className="font-bold mb-2 text-slate-300">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}:{" "}
          {typeof p.value === "number" && p.value > 10000
            ? new Intl.NumberFormat("fr").format(p.value) + " F"
            : p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

// ── Config plans / statuts ────────────────────────────────────────────────────
const PLAN_CFG = {
  ANNUEL:      { color: "bg-blue-100 text-blue-700",       label: "Annuel",      hex: "#135bec", prix: 450000 },
  TRIMESTRIEL: { color: "bg-emerald-100 text-emerald-700", label: "Trimestriel", hex: "#10b981", prix: 130000 },
  MENSUEL:     { color: "bg-amber-100 text-amber-700",     label: "Mensuel",     hex: "#f59e0b", prix: 50000  },
  ESSAI:       { color: "bg-slate-100 text-slate-600",     label: "Essai",       hex: "#94a3b8", prix: 0      },
};

const PLANS_INFO = {
  ESSAI:       { prix: 0,      label: "Essai",       color: "gray"    },
  MENSUEL:     { prix: 50000,  label: "Mensuel",     color: "primary" },
  TRIMESTRIEL: { prix: 130000, label: "Trimestriel", color: "success" },
  ANNUEL:      { prix: 450000, label: "Annuel",      color: "warning" },
};

const STATUT_CFG = {
  active:     { dot: "bg-emerald-500", label: "Actif"          },
  ACTIVE:     { dot: "bg-emerald-500", label: "Actif"          },
  en_attente: { dot: "bg-blue-500",    label: "Essai"          },
  TRIAL:      { dot: "bg-blue-500",    label: "Essai"          },
  expiree:    { dot: "bg-amber-500",   label: "Expiré"         },
  EXPIRING:   { dot: "bg-amber-500",   label: "Expire bientôt" },
  suspendue:  { dot: "bg-red-500",     label: "Suspendu"       },
  SUSPENDED:  { dot: "bg-red-500",     label: "Suspendu"       },
};

// ── Même fonction de fusion que GestionAbonnements ───────────────────────────
// agence vient de subscribeService.getAgences() → champs : agence_id, nom, email_officiel, statut_global, logo_image, date_inscription
// abonnements vient de tableau.abonnements_expirant_bientot → champs : id_agence, plan, statut, date_expiration, jours_restants
function mergeAgenceAbonnement(agence, abonnements = []) {
  const ab = abonnements.find(a => a.id_agence === agence.agence_id);
  return {
    // identité
    id:            agence.agence_id,
    id_agence:     agence.agence_id,
    nom_agence:    agence.nom,
    name:          agence.nom,          // alias pour compatibilité diagrammes
    email:         agence.email_officiel,
    logo:          agence.logo_image || null,
    statut_global: agence.statut_global,
    date_inscription: agence.date_inscription || agence.created_at || null,
    // abonnement
    plan:          ab?.plan             ?? "ESSAI",
    statut:        ab?.statut           ?? (agence.statut_global === "active" ? "TRIAL" : "ACTIVE"),
    date_fin:      ab?.date_expiration  ?? null,
    jours_restants: ab?.jours_restants  ?? null,
    // métriques
    _recettes:     agence.recettes_estimees   || 0,
    _nb_users:     agence.nombre_utilisateurs || 0,
    _rating:       agence.rating              || 4.5,
  };
}

// ── Export PDF ────────────────────────────────────────────────────────────────
function exportPDF(lignes, resume) {
  const now  = new Date().toLocaleDateString("fr-FR");
  const rows = lignes.map(a => `
    <tr>
      <td>${a.nom_agence || "—"}</td>
      <td>${a.email || "—"}</td>
      <td>${a.statut_global || "—"}</td>
      <td><b>${a.plan}</b></td>
      <td>${a.date_inscription ? String(a.date_inscription).slice(0,10) : "—"}</td>
      <td style="text-align:right">${a._recettes > 0 ? new Intl.NumberFormat("fr").format(a._recettes) + " F" : "—"}</td>
    </tr>`).join("");

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>Rapport NJILA – ${now}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:28px}
      h1{font-size:20px;color:#135bec;margin-bottom:4px;font-weight:800}
      .sub{color:#64748b;font-size:10px;margin-bottom:18px}
      .kpi{display:flex;gap:10px;margin-bottom:20px}
      .kpi-box{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center}
      .kpi-val{font-size:20px;font-weight:800;color:#135bec}
      .kpi-lbl{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
      table{width:100%;border-collapse:collapse}
      th{background:#135bec;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
      td{padding:6px 10px;border-bottom:1px solid #f1f5f9}
      tr:nth-child(even) td{background:#f8fafc}
      .footer{margin-top:20px;text-align:center;color:#94a3b8;font-size:9px;border-top:1px solid #f1f5f9;padding-top:10px}
      @media print{body{padding:0}}
    </style>
  </head><body>
    <h1>Rapport des Agences — NJILA Admin</h1>
    <p class="sub">Généré le ${now} · ${lignes.length} agences ·
      Recettes totales : ${resume.recette_totale_fcfa
        ? new Intl.NumberFormat("fr").format(resume.recette_totale_fcfa) + " F CFA" : "—"}</p>
    <div class="kpi">
      <div class="kpi-box"><div class="kpi-val">${lignes.filter(a=>a.statut_global==="active").length}</div><div class="kpi-lbl">Actives</div></div>
      <div class="kpi-box"><div class="kpi-val">${lignes.filter(a=>a.statut_global==="en_attente").length}</div><div class="kpi-lbl">Essai</div></div>
      <div class="kpi-box"><div class="kpi-val">${lignes.filter(a=>a.statut_global==="suspendue").length}</div><div class="kpi-lbl">Suspendues</div></div>
      <div class="kpi-box"><div class="kpi-val">${lignes.filter(a=>a.plan==="ANNUEL").length}</div><div class="kpi-lbl">Plan Annuel</div></div>
      <div class="kpi-box"><div class="kpi-val">${lignes.filter(a=>a.plan!=="ESSAI").length}</div><div class="kpi-lbl">Payants</div></div>
    </div>
    <table>
      <thead><tr>
        <th>Agence</th><th>Email</th><th>Statut</th><th>Plan</th><th>Inscription</th><th style="text-align:right">Recettes</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">NJILA Platform · Rapport confidentiel · ${now}</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // ── Modal renouvellement (même logique que GestionAbonnements) ────────────
  const [isChangePlanModal, setIsChangePlanModal] = useState(false);
  const [selectedAgence,    setSelectedAgence]    = useState(null);
  const [selectedPlan,      setSelectedPlan]      = useState("");

  // ── Requêtes — identiques à GestionAbonnements ────────────────────────────
  // 1. Tableau de bord : résumé + abonnements expirant
  const { data: tableau, isLoading: loadingTableau, error: errorTableau } = useQuery({
    queryKey: ["admin-tableau-de-bord"],
    queryFn:  subscribeService.getTableauDeBord,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // 2. Liste agences via subscribe-service — MÊME source que GestionAbonnements
  //    Retourne : { agence_id, nom, email_officiel, statut_global, logo_image, date_inscription, … }
  const { data: agencesRaw = [], isLoading: loadingAgences } = useQuery({
    queryKey: ["admin-subscribe-agences"],
    queryFn:  subscribeService.getAgences,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── Fusion identique à GestionAbonnements ─────────────────────────────────
  const abonnementsTableau = tableau?.abonnements_expirant_bientot ?? [];
  const lignes = useMemo(
    () => agencesRaw.map(ag => mergeAgenceAbonnement(ag, abonnementsTableau)),
    [agencesRaw, abonnementsTableau]
  );

  // ── Métriques ─────────────────────────────────────────────────────────────
  const resume       = tableau?.resume || {};
  const recetteTotale = resume.recette_totale_fcfa || 0;

  const agencesActives    = lignes.filter(a => a.statut_global === "active").length;
  const agencesEssai      = lignes.filter(a => a.statut_global === "en_attente").length;
  const agencesSuspendues = lignes.filter(a => a.statut_global === "suspendue").length;
  const agencesExpirees   = lignes.filter(a => a.statut_global === "expiree").length;
  const totalAgences      = lignes.length;

  // Expirant bientôt (même logique que GestionAbonnements)
  const expirantBientot = abonnementsTableau.length > 0
    ? lignes.filter(l => abonnementsTableau.some(a => a.id_agence === l.id_agence))
    : lignes.filter(l => l.jours_restants !== null && l.jours_restants <= 30);

  // ── Chart 1 : croissance mensuelle ───────────────────────────────────────
  const chartCroissance = useMemo(() => {
    const months   = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    const monthMap = {};
    lignes.forEach(a => {
      const d = new Date(a.date_inscription);
      if (isNaN(d)) return;
      const lbl = months[d.getMonth()];
      if (!monthMap[lbl]) monthMap[lbl] = { mois: lbl, agences: 0, recettes: 0 };
      monthMap[lbl].agences  += 1;
      monthMap[lbl].recettes += a._recettes || 0;
    });
    return months.map(m => monthMap[m] || { mois: m, agences: 0, recettes: 0 });
  }, [lignes]);

  // ── Chart 2 : distribution plans (depuis la fusion — source fiable) ───────
  const distributionPlans = useMemo(() => {
    const counts = {};
    lignes.forEach(a => {
      const p = a.plan || "ESSAI";
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        label: PLAN_CFG[name]?.label || name,
        color: PLAN_CFG[name]?.hex   || "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [lignes]);

  // ── Chart 3 : répartition statuts ────────────────────────────────────────
  const statutDistribution = useMemo(() => [
    { name: "Actives",    value: agencesActives,    fill: "#10b981" },
    { name: "Essai",      value: agencesEssai,      fill: "#135bec" },
    { name: "Expirant",   value: agencesExpirees,   fill: "#f59e0b" },
    { name: "Suspendues", value: agencesSuspendues, fill: "#ef4444" },
  ].filter(s => s.value > 0), [agencesActives, agencesEssai, agencesExpirees, agencesSuspendues]);

  // ── Chart 4 : recettes estimées par plan ─────────────────────────────────
  const recettesParPlan = useMemo(() =>
    distributionPlans
      .map(p => ({
        name:     p.label,
        recettes: p.value * (PLAN_CFG[p.name]?.prix || 0),
        color:    p.color,
      }))
      .filter(p => p.recettes > 0),
  [distributionPlans]);

  // ── Chart 5 : radar santé ─────────────────────────────────────────────────
  const radarData = useMemo(() => [
    { sujet: "Actives",    val: totalAgences > 0 ? Math.round((agencesActives / totalAgences) * 100) : 0 },
    { sujet: "Payants",    val: totalAgences > 0 ? Math.round((lignes.filter(a=>a.plan!=="ESSAI").length / totalAgences) * 100) : 0 },
    { sujet: "Stables",    val: totalAgences > 0 ? Math.round(((totalAgences - agencesSuspendues) / totalAgences) * 100) : 0 },
    { sujet: "Renouvelés", val: resume.taux_renouvellement ?? 78 },
    { sujet: "Satisfaits", val: resume.taux_satisfaction   ?? 85 },
  ], [agencesActives, agencesSuspendues, lignes, totalAgences, resume]);

  // ── Top agences ───────────────────────────────────────────────────────────
  const topAgences = useMemo(() =>
    [...lignes].sort((a, b) => (b._recettes||0) - (a._recettes||0)).slice(0, 5),
  [lignes]);

  // ── Mutation renouvellement — MÊME endpoint que GestionAbonnements ────────
  const { mutate: souscrire, isPending: isSouscribing } = useMutation({
    mutationFn: ({ id, plan }) => subscribeService.souscrire(id, { plan }),
    onSuccess: () => {
      toast.success("Plan mis à jour avec succès.");
      queryClient.invalidateQueries({ queryKey: ["admin-tableau-de-bord"]   });
      queryClient.invalidateQueries({ queryKey: ["admin-subscribe-agences"] });
      setIsChangePlanModal(false);
      setSelectedAgence(null);
      setSelectedPlan("");
    },
    onError: () => toast.error("Échec de la mise à jour du plan."),
  });

  const handleChangePlan = () => {
    if (!selectedPlan) return toast.error("Choisissez un plan.");
    souscrire({ id: selectedAgence.id_agence, plan: selectedPlan });
  };

  const openRenouvellerModal = (agence) => {
    setSelectedAgence(agence);
    setSelectedPlan(agence.plan);
    setIsChangePlanModal(true);
  };

  // ── Rafraîchissement ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-tableau-de-bord"]   }),
        queryClient.invalidateQueries({ queryKey: ["admin-subscribe-agences"] }),
      ]);
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }, [queryClient]);

  // ── Export PDF ────────────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    exportPDF(lignes, resume);
  }, [lignes, resume]);

  const isLoading = loadingTableau || loadingAgences;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex flex-col gap-1">
          <NjilaLogo size="md" />
          <div className="flex items-center gap-2 pl-1 mt-0.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block" />
            <p className="text-sm text-slate-400">
              Supervision globale · {totalAgences} agence{totalAgences !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleRefresh} disabled={refreshing} title="Actualiser"
            className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors relative">
            <Bell className="w-4 h-4 text-slate-500" />
            {expirantBientot.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
            )}
          </button>

          <button onClick={handleDownload} disabled={!lignes.length} title="Télécharger rapport PDF"
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Rapport PDF
          </button>

          <button className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <Building2 className="w-4 h-4" /> Nouvelle agence
          </button>
        </div>
      </div>

      {errorTableau && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-8 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-semibold">Erreur lors du chargement. Veuillez actualiser.</p>
          <button onClick={handleRefresh} className="ml-auto text-xs text-red-600 underline font-semibold">Réessayer</button>
        </div>
      )}

      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <div className="bg-gradient-to-br from-[#135bec] to-blue-800 rounded-2xl p-5 text-white relative overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <Building2 className="w-5 h-5 mb-3 opacity-80" />
                <p className="text-3xl font-extrabold">{agencesActives}</p>
                <p className="text-blue-200 text-sm mt-0.5">Agences actives</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUp className="w-3 h-3 text-emerald-300" />
                  <span className="text-xs text-emerald-300 font-bold">{resume.nouveaux_ce_mois ?? "—"} ce mois</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white relative overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <TrendingUp className="w-5 h-5 mb-3 opacity-80" />
                <p className="text-3xl font-extrabold">{formatMontant(recetteTotale)}</p>
                <p className="text-emerald-200 text-sm mt-0.5">Recettes totales</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUp className="w-3 h-3 text-white/80" />
                  <span className="text-xs text-white/80 font-bold">+8 % vs N-1</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <Clock className="w-5 h-5 mb-3 text-amber-500" />
              <p className="text-3xl font-extrabold text-slate-900">{agencesEssai}</p>
              <p className="text-slate-400 text-sm mt-0.5">En période d'essai</p>
              <p className="text-xs text-amber-600 font-semibold mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> À convertir
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <AlertTriangle className="w-5 h-5 mb-3 text-red-500" />
              <p className="text-3xl font-extrabold text-slate-900">{expirantBientot.length}</p>
              <p className="text-slate-400 text-sm mt-0.5">Expirent dans 30 j</p>
              <p className="text-xs text-red-500 font-semibold mt-2">Action requise</p>
            </div>
          </div>

          {/* ── Ligne 1 : Croissance + Statuts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="mb-5">
                <h3 className="font-extrabold text-slate-900">Croissance de la plateforme</h3>
                <p className="text-xs text-slate-400 mt-0.5">Nouvelles agences et recettes par mois</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartCroissance}>
                  <defs>
                    <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#135bec" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#135bec" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradAg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area yAxisId="left"  type="monotone" dataKey="recettes" name="Recettes (F)" stroke="#135bec" strokeWidth={2.5} fill="url(#gradRec)" />
                  <Area yAxisId="right" type="monotone" dataKey="agences"  name="Agences"      stroke="#10b981" strokeWidth={2}   fill="url(#gradAg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-extrabold text-slate-900 mb-4">Répartition statuts</h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statutDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {statutDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {statutDistribution.map(item => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-xs text-slate-600 font-medium">{item.name}</span>
                    </div>
                    <span className="text-sm font-extrabold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400">Total : <span className="font-bold text-slate-700">{totalAgences} agences</span></p>
              </div>
            </div>
          </div>

          {/* ── Ligne 2 : Plans + Recettes par plan ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="mb-4">
                <h3 className="font-extrabold text-slate-900">Distribution des plans</h3>
                <p className="text-xs text-slate-400 mt-0.5">Source : abonnements réels (même source que Gestion Abonnements)</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {distributionPlans.length > 0 ? distributionPlans.map(plan => (
                  <div key={plan.name} className="p-4 rounded-xl border-2 border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{plan.label}</span>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: plan.color }} />
                    </div>
                    <p className="text-2xl font-extrabold text-slate-900">{plan.value}</p>
                    <p className="text-xs text-slate-400">agence{plan.value > 1 ? "s" : ""}</p>
                  </div>
                )) : (
                  <div className="col-span-2 text-center py-4 text-slate-400 text-sm">Aucune donnée de plan</div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={distributionPlans} barSize={30}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [v, "Agences"]} />
                  <Bar dataKey="value" radius={[6,6,0,0]}>
                    {distributionPlans.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="mb-4">
                <h3 className="font-extrabold text-slate-900">Recettes estimées par plan</h3>
                <p className="text-xs text-slate-400 mt-0.5">Nb agences × tarif du plan</p>
              </div>
              {recettesParPlan.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={recettesParPlan} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} axisLine={false} tickLine={false} width={85} />
                    <Tooltip formatter={(v) => [new Intl.NumberFormat("fr").format(v) + " F", "Recettes"]} />
                    <Bar dataKey="recettes" radius={[0,6,6,0]}>
                      {recettesParPlan.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Aucune donnée disponible</div>
              )}
            </div>
          </div>

          {/* ── Ligne 3 : Radar santé + État plateforme ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="mb-4">
                <h3 className="font-extrabold text-slate-900">Santé de la plateforme</h3>
                <p className="text-xs text-slate-400 mt-0.5">Indicateurs clés en %</p>
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <RadarChart data={radarData} outerRadius={80}>
                  <PolarGrid stroke="#f1f5f9" />
                  <PolarAngleAxis dataKey="sujet" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
                  <Radar name="Plateforme" dataKey="val" stroke="#135bec" fill="#135bec" fillOpacity={0.15} strokeWidth={2} />
                  <Tooltip formatter={(v) => [`${v}%`, ""]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-extrabold text-slate-900">État plateforme</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Performance globale</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-semibold">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
                  99.9 % uptime
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: <Zap         className="w-4 h-4 text-blue-500"    />, label: "Requêtes API",        value: "2.4K/min" },
                  { icon: <Activity    className="w-4 h-4 text-emerald-500" />, label: "Réservations",        value: "145/jour" },
                  { icon: <Users       className="w-4 h-4 text-amber-500"   />, label: "Utilisateurs actifs", value: "3.2K" },
                  { icon: <TrendingUp  className="w-4 h-4 text-purple-500"  />, label: "Taux de conversion",
                    value: `${totalAgences > 0 ? Math.round((agencesActives / totalAgences) * 100) : 0}%` },
                  { icon: <Building2   className="w-4 h-4 text-slate-500"   />, label: "Plans payants",
                    value: `${lignes.filter(a=>a.plan!=="ESSAI").length} / ${totalAgences}` },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">{icon}<span className="text-sm font-semibold text-slate-700">{label}</span></div>
                    <span className="text-base font-extrabold text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Top agences ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900">Top Agences Partenaires</h3>
                <p className="text-xs text-slate-400 mt-0.5">Performance et abonnements</p>
              </div>
              <button className="text-xs text-[#135bec] font-semibold hover:underline flex items-center gap-1">
                Voir tout <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/60">
                  {["Agence","Plan","Recettes","Utilisateurs","Note","Statut","Actions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topAgences.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-sm">Aucune agence disponible</td></tr>
                ) : topAgences.map((ag, i) => {
                  const planCfg   = PLAN_CFG[ag.plan]           || { color: "bg-slate-100 text-slate-600", label: ag.plan };
                  const statusCfg = STATUT_CFG[ag.statut_global] || { dot: "bg-slate-400", label: ag.statut_global };
                  const nom       = ag.nom_agence || ag.name || "—";
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {ag.logo ? (
                            <img src={ag.logo} className="w-9 h-9 rounded-xl object-cover" alt={nom} />
                          ) : (
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(nom.slice(0,2))}&background=135bec&color=fff&size=36`} alt={nom} className="w-9 h-9 rounded-xl" />
                          )}
                          <span className="font-bold text-slate-800 text-sm">{nom}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${planCfg.color}`}>{planCfg.label}</span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-700">
                        {ag._recettes > 0 ? formatMontant(ag._recettes) : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{ag._nb_users?.toLocaleString() || "—"}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm font-bold text-slate-700">{(ag._rating||4.5).toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                          <span className="text-xs font-semibold text-slate-600">{statusCfg.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button className="w-7 h-7 hover:bg-slate-100 rounded-lg flex items-center justify-center transition-colors">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Alertes expirations avec bouton Renouveler fonctionnel ── */}
          {expirantBientot.length > 0 ? (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-amber-900">Abonnements expirant bientôt</h3>
                  <p className="text-xs text-amber-700 mt-0.5">Action commerciale recommandée</p>
                </div>
                <span className="ml-auto text-sm font-extrabold text-amber-800 bg-amber-200 px-3 py-1 rounded-full">
                  {expirantBientot.length} agence{expirantBientot.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-3">
                {expirantBientot.slice(0, 5).map((ab, idx) => {
                  const initiales = (ab.nom_agence || "??").slice(0, 2).toUpperCase();
                  return (
                    <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-xl border border-amber-100">
                      <div className="flex items-center gap-3">
                        {ab.logo ? (
                          <img src={ab.logo} className="w-9 h-9 rounded-xl object-cover" alt={ab.nom_agence} />
                        ) : (
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(initiales)}&background=f59e0b&color=fff&size=36&bold=true`} className="w-9 h-9 rounded-xl" alt={ab.nom_agence} />
                        )}
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{ab.nom_agence}</p>
                          <p className="text-xs text-slate-400">
                            Plan {ab.plan || "—"}
                            {ab.jours_restants != null && (
                              <> · <span className="text-amber-600 font-semibold">{ab.jours_restants} jour{ab.jours_restants !== 1 ? "s" : ""} restant{ab.jours_restants !== 1 ? "s" : ""}</span></>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                          Contacter
                        </button>
                        {/* Bouton Renouveler → ouvre la même modal que GestionAbonnements */}
                        <button
                          onClick={() => openRenouvellerModal(ab)}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-[#135bec] hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Renouveler
                        </button>
                      </div>
                    </div>
                  );
                })}
                {expirantBientot.length > 5 && (
                  <button className="w-full text-center text-xs text-amber-700 font-semibold py-2 hover:underline">
                    Voir {expirantBientot.length - 5} de plus →
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-sm text-emerald-700 font-semibold">Aucun abonnement n'expire dans les 30 prochains jours. Tout est en ordre !</p>
            </div>
          )}
        </>
      )}

      {/* ── Modal renouvellement / changement de plan ── */}
      <Modal
        open={isChangePlanModal}
        onClose={() => { setIsChangePlanModal(false); setSelectedAgence(null); }}
        title={`Renouveler / changer le plan — ${selectedAgence?.nom_agence || ""}`}
        size="sm"
        footer={
          <>
            <button onClick={() => setIsChangePlanModal(false)}
              className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50">
              Annuler
            </button>
            <button onClick={handleChangePlan} disabled={isSouscribing}
              className="px-5 py-2 bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center gap-2">
              {isSouscribing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Mise à jour…</> : "Confirmer"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500 mb-2">Sélectionnez le nouveau plan :</p>
          {Object.entries(PLANS_INFO).map(([plan, { label, prix, color }]) => (
            <label key={plan}
              className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedPlan === plan ? "border-[#135bec] bg-blue-50" : "border-slate-100 hover:border-slate-200"
              }`}>
              <div className="flex items-center gap-3">
                <input type="radio" name="plan" value={plan} checked={selectedPlan === plan}
                  onChange={() => setSelectedPlan(plan)} className="accent-[#135bec]" />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{label}</p>
                  <p className="text-xs text-slate-400">
                    {plan === "ESSAI" ? "Gratuit" : `${formatMontant(prix)} / période`}
                  </p>
                </div>
              </div>
              <Badge variant={color}>{label}</Badge>
            </label>
          ))}
        </div>
      </Modal>
    </DashboardLayout>
  );
}