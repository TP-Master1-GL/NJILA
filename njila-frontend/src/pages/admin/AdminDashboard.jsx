import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart,
} from "recharts";
import {
  Building2, TrendingUp, Users, AlertTriangle,
  Clock, ArrowUp, Download, RefreshCw,
  Bell, MoreVertical, ExternalLink, Star,
  Zap, Activity,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { subscribeService } from "../../services/subscribeService";
import { agenceService } from "../../services/agenceService";
import { paymentService } from "../../services/paymentService";
import { formatMontant } from "../../utils/formatters";
import Spinner from "../../components/ui/Spinner";
import NjilaLogo from "../../components/ui/NjilaLogo";

// ── Tooltip personnalisé ────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs">
      <p className="font-bold mb-2 text-slate-300">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === "number" && p.value > 10000
            ? new Intl.NumberFormat("fr").format(p.value) + " F"
            : p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

// ── Configuration des plans ────────────────────────────────────────────────
const PLAN_CFG = {
  "ANNUEL":      { color: "bg-blue-100 text-blue-700",       label: "Annuel",       icon: "📅" },
  "TRIMESTRIEL": { color: "bg-emerald-100 text-emerald-700", label: "Trimestriel",  icon: "📊" },
  "MENSUEL":     { color: "bg-amber-100 text-amber-700",     label: "Mensuel",      icon: "📆" },
  "ESSAI":       { color: "bg-slate-100 text-slate-600",     label: "Essai",        icon: "🎯" },
};

const STATUT_CFG = {
  "ACTIVE":    { dot: "bg-emerald-500", label: "Actif",          color: "emerald" },
  "TRIAL":     { dot: "bg-blue-500",    label: "Essai",          color: "blue"    },
  "EXPIRING":  { dot: "bg-amber-500",   label: "Expire bientôt", color: "amber"   },
  "SUSPENDED": { dot: "bg-red-500",     label: "Suspendu",       color: "red"     },
};

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // ── Requêtes principales ────────────────────────────────────────────────
  const { data: tableauData, isLoading: loadingTableau, error: errorTableau } = useQuery({
    queryKey: ["admin-tableau-de-bord"],
    queryFn: subscribeService.getTableauDeBord,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const { data: allAgences, isLoading: loadingAgences } = useQuery({
    queryKey: ["admin-all-agences"],
    queryFn: agenceService.getAgences,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: allPayments } = useQuery({
    queryKey: ["admin-all-payments"],
    queryFn: paymentService.getAllPayments || (() => Promise.resolve([])),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  // ── Données transformées ────────────────────────────────────────────────
  const resume = tableauData?.resume || {};
  const abonnementsExpirant = tableauData?.abonnements_expirant_bientot || [];

  const agencesActives    = allAgences?.filter(a => a.statut_global === "active")?.length    || 0;
  const agencesEssai      = allAgences?.filter(a => a.statut_global === "en_attente")?.length || 0;
  const agencesSuspendues = allAgences?.filter(a => a.statut_global === "suspendue")?.length  || 0;
  const agencesExpirees   = allAgences?.filter(a => a.statut_global === "expiree")?.length    || 0;
  const totalAgences      = allAgences?.length || 0;

  const recetteTotale = resume.recette_totale_fcfa || 0;

  // ── Données pour graphiques ────────────────────────────────────────────
  const chartDataAgences = useMemo(() => {
    if (!allAgences?.length) return [];
    const monthMap = {};
    const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

    allAgences.forEach(agence => {
      const dateInsc = new Date(agence.date_inscription);
      const monthLabel = months[dateInsc.getMonth()];
      if (!monthMap[monthLabel]) {
        monthMap[monthLabel] = { mois: monthLabel, agences: 0, recettes: 0 };
      }
      monthMap[monthLabel].agences += 1;
      monthMap[monthLabel].recettes += 50000 + Math.random() * 100000;
    });

    return months.map(m => monthMap[m] || { mois: m, agences: 0, recettes: 0 });
  }, [allAgences]);

  const distributionPlans = useMemo(() => {
    if (!allAgences?.length) return [];
    const planCounts = {};
    allAgences.forEach(a => {
      const plan = a.plan_actif?.plan_type || "ESSAI";
      planCounts[plan] = (planCounts[plan] || 0) + 1;
    });
    const colors = {
      ANNUEL: "#135bec", TRIMESTRIEL: "#10b981", MENSUEL: "#f59e0b", ESSAI: "#94a3b8",
    };
    return Object.entries(planCounts).map(([name, value]) => ({
      name, value, color: colors[name] || "#94a3b8",
    }));
  }, [allAgences]);

  const statutDistribution = useMemo(() => [
    { name: "Actives",    value: agencesActives,    fill: "#10b981" },
    { name: "Essai",      value: agencesEssai,      fill: "#135bec" },
    { name: "Expirant",   value: agencesExpirees,   fill: "#f59e0b" },
    { name: "Suspendues", value: agencesSuspendues, fill: "#ef4444" },
  ].filter(s => s.value > 0), [agencesActives, agencesEssai, agencesExpirees, agencesSuspendues]);

  const topAgences = useMemo(() => {
    if (!allAgences?.length) return [];
    return allAgences
      .slice()
      .sort((a, b) => (b.recettes_estimees || 0) - (a.recettes_estimees || 0))
      .slice(0, 5)
      .map(ag => ({
        nom:      ag.name,
        plan:     ag.plan_actif?.plan_type || "ESSAI",
        recettes: ag.recettes_estimees || 0,
        voyageurs: ag.nombre_utilisateurs || 0,
        note:     ag.rating || 4.5,
        statut:   ag.statut_global === "active"     ? "ACTIVE"    :
                  ag.statut_global === "en_attente" ? "TRIAL"     :
                  ag.statut_global === "expiree"    ? "EXPIRING"  : "SUSPENDED",
      }));
  }, [allAgences]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-tableau-de-bord"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-all-agences"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-all-payments"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const isLoading = loadingTableau || loadingAgences;

  return (
    <DashboardLayout>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">

        {/* Logo + sous-titre */}
        <div className="flex flex-col gap-1">
          <NjilaLogo size="md" />
          <div className="flex items-center gap-2 pl-1 mt-0.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block" />
            <p className="text-sm text-slate-400">
              Supervision globale • {totalAgences} agences
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors relative">
            <Bell className="w-4 h-4 text-slate-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
          </button>

          <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Rapport
          </button>

          <button className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <Building2 className="w-4 h-4" /> Nouvelle agence
          </button>
        </div>
      </div>

      {/* ── Erreur ── */}
      {errorTableau && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-8">
          <p className="text-sm text-red-700 font-semibold">
            ⚠️ Erreur lors du chargement du tableau de bord. Veuillez actualiser.
          </p>
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
                  <span className="text-xs text-emerald-300 font-bold">
                    +{Math.max(0, agencesActives - 5)} ce mois
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white relative overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <TrendingUp className="w-5 h-5 mb-3 opacity-80" />
                <p className="text-3xl font-extrabold">{formatMontant(recetteTotale)}</p>
                <p className="text-emerald-200 text-sm mt-0.5">Recettes</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUp className="w-3 h-3 text-white/80" />
                  <span className="text-xs text-white/80 font-bold">+8% vs N-1</span>
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
              <p className="text-3xl font-extrabold text-slate-900">{abonnementsExpirant.length}</p>
              <p className="text-slate-400 text-sm mt-0.5">Expirent dans 30j</p>
              <p className="text-xs text-red-500 font-semibold mt-2">Action requise</p>
            </div>
          </div>

          {/* ── Row 1 : Croissance + Statuts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-extrabold text-slate-900">Croissance de la plateforme</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Recettes & agences inscrites</p>
                </div>
                <select className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 font-medium">
                  <option>2026</option>
                  <option>2025</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartDataAgences}>
                  <defs>
                    <linearGradient id="gradAdmin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#135bec" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#135bec" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area  yAxisId="left"  type="monotone" dataKey="recettes" name="Recettes" stroke="#135bec" strokeWidth={2.5} fill="url(#gradAdmin)" />
                  <Line  yAxisId="right" type="monotone" dataKey="agences"  name="Agences"  stroke="#10b981" strokeWidth={2.5} dot={{ fill: "#10b981", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-extrabold text-slate-900 mb-4">Répartition statuts</h3>
              <div className="flex justify-center mb-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statutDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {statutDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5">
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
              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400">
                  Total : <span className="font-bold text-slate-700">{totalAgences} agences</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Row 2 : Distribution plans + État plateforme ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-extrabold text-slate-900 mb-5">Distribution des plans</h3>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {distributionPlans.map(plan => (
                  <div key={plan.name} className="p-4 rounded-xl border-2 border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">{plan.name}</span>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }} />
                    </div>
                    <p className="text-2xl font-extrabold text-slate-900">{plan.value}</p>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={distributionPlans}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {distributionPlans.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
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
                  99.9% uptime
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { icon: <Zap className="w-4 h-4 text-blue-500" />,     label: "Requêtes API",        value: "2.4K/min" },
                  { icon: <Activity className="w-4 h-4 text-emerald-500" />, label: "Réservations",    value: "145/jour" },
                  { icon: <Users className="w-4 h-4 text-amber-500" />,   label: "Utilisateurs actifs", value: "3.2K"     },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className="text-sm font-semibold text-slate-700">{label}</span>
                    </div>
                    <span className="text-lg font-extrabold text-slate-900">{value}</span>
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
                <p className="text-xs text-slate-400 mt-0.5">Performance et statut des abonnements</p>
              </div>
              <button className="text-xs text-[#135bec] font-semibold hover:underline flex items-center gap-1">
                Voir tout <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/60">
                  {["Agence", "Plan", "Recettes", "Utilisateurs", "Note", "Statut", "Actions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topAgences.map((ag, i) => {
                  const planCfg   = PLAN_CFG[ag.plan]     || {};
                  const statusCfg = STATUT_CFG[ag.statut] || {};
                  const initiales = ag.nom?.slice(0, 2) ?? "??";
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(initiales)}&background=135bec&color=fff&size=36`}
                            alt={ag.nom}
                            className="w-9 h-9 rounded-xl"
                          />
                          <span className="font-bold text-slate-800 text-sm">{ag.nom}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${planCfg.color}`}>
                          {planCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-700">
                        {ag.recettes > 0 ? formatMontant(ag.recettes) : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {ag.voyageurs?.toLocaleString() || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm font-bold text-slate-700">{ag.note?.toFixed(1) || "—"}</span>
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
            {topAgences.length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-slate-400 text-sm">Aucune agence disponible</p>
              </div>
            )}
          </div>

          {/* ── Alertes expirations ── */}
          {abonnementsExpirant.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-amber-900">Abonnements expirant bientôt</h3>
                  <p className="text-xs text-amber-700 mt-0.5">Action commerciale recommandée</p>
                </div>
                <span className="ml-auto text-sm font-extrabold text-amber-800 bg-amber-200 px-3 py-1 rounded-full">
                  {abonnementsExpirant.length} agences
                </span>
              </div>
              <div className="space-y-3">
                {abonnementsExpirant.slice(0, 5).map((ab, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-xl border border-amber-100">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent((ab.id_agence ?? "??").slice(0, 2))}&background=f59e0b&color=fff&size=36`}
                        className="w-9 h-9 rounded-xl"
                        alt={ab.id_agence}
                      />
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{ab.id_agence}</p>
                        <p className="text-xs text-slate-400">
                          Plan {ab.plan} • {ab.jours_restants || 7} jours restants
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                        Contacter
                      </button>
                      <button className="px-3 py-1.5 text-xs font-bold text-white bg-[#135bec] hover:bg-blue-700 rounded-lg transition-colors">
                        Renouveler
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}