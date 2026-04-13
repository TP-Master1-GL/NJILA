import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Treemap
} from "recharts";
import {
  Building2, CreditCard, TrendingUp, Users, AlertTriangle,
  CheckCircle, Clock, ArrowUp, ArrowDown, Download, RefreshCw,
  Globe, Shield, Zap, DollarSign, Activity, Bell,
  MoreVertical, ExternalLink, Star
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { subscribeService } from "../../services/subscribeService";
import { paymentService } from "../../services/paymentService";
import { formatMontant } from "../../utils/formatters";
import Spinner from "../../components/ui/Spinner";

// ── Mock data ─────────────────────────────────────────────────────────────────
const RECETTES_MENSUELLES = [
  { mois: "Jan", recettes: 850000, agences: 6 },
  { mois: "Fév", recettes: 920000, agences: 7 },
  { mois: "Mar", recettes: 1100000, agences: 7 },
  { mois: "Avr", recettes: 1050000, agences: 8 },
  { mois: "Mai", recettes: 1280000, agences: 8 },
  { mois: "Jun", recettes: 1450000, agences: 9 },
  { mois: "Jul", recettes: 1620000, agences: 10 },
  { mois: "Aoû", recettes: 1580000, agences: 10 },
  { mois: "Sep", recettes: 1720000, agences: 11 },
  { mois: "Oct", recettes: 2000000, agences: 13 },
  { mois: "Nov", recettes: 1850000, agences: 12 },
  { mois: "Déc", recettes: 2200000, agences: 14 },
];

const REPARTITION_PLANS = [
  { name: "Annuel", value: 4, color: "#135bec", prix: 450000 },
  { name: "Trimestriel", value: 3, color: "#10b981", prix: 130000 },
  { name: "Mensuel", value: 5, color: "#f59e0b", prix: 50000 },
  { name: "Essai", value: 2, color: "#94a3b8", prix: 0 },
];

const STATUT_AGENCES = [
  { name: "Actives", value: 8, fill: "#10b981" },
  { name: "Essai", value: 3, fill: "#135bec" },
  { name: "Expirant", value: 2, fill: "#f59e0b" },
  { name: "Suspendues", value: 1, fill: "#ef4444" },
];

const TOP_AGENCES = [
  { nom: "General Voyages", plan: "ANNUEL", recettes: 450000, voyageurs: 3842, note: 4.8, statut: "ACTIVE" },
  { nom: "Binam Voyage", plan: "TRIMESTRIEL", recettes: 130000, voyageurs: 2150, note: 4.5, statut: "ACTIVE" },
  { nom: "Finex Voyage", plan: "ANNUEL", recettes: 450000, voyageurs: 1980, note: 4.6, statut: "ACTIVE" },
  { nom: "Touristique Express", plan: "ESSAI", recettes: 0, voyageurs: 320, note: 3.9, statut: "TRIAL" },
  { nom: "Buca Voyages", plan: "MENSUEL", recettes: 50000, voyageurs: 890, note: 4.1, statut: "EXPIRING" },
];

const ACTIVITE_PLATEFORME = [
  { heure: "00h", api: 12, bookings: 2 },
  { heure: "03h", api: 5, bookings: 0 },
  { heure: "06h", api: 42, bookings: 8 },
  { heure: "09h", api: 185, bookings: 52 },
  { heure: "12h", api: 220, bookings: 68 },
  { heure: "15h", api: 198, bookings: 61 },
  { heure: "18h", api: 245, bookings: 78 },
  { heure: "21h", api: 156, bookings: 45 },
];

const PLAN_CFG = {
  ANNUEL:      { color: "bg-blue-100 text-blue-700", label: "Annuel" },
  TRIMESTRIEL: { color: "bg-emerald-100 text-emerald-700", label: "Trimestriel" },
  MENSUEL:     { color: "bg-amber-100 text-amber-700", label: "Mensuel" },
  ESSAI:       { color: "bg-slate-100 text-slate-600", label: "Essai" },
};

const STATUT_CFG = {
  ACTIVE:   { dot: "bg-emerald-500", label: "Actif" },
  TRIAL:    { dot: "bg-blue-500",    label: "Essai" },
  EXPIRING: { dot: "bg-amber-500",   label: "Expire bientôt" },
  SUSPENDED:{ dot: "bg-red-500",     label: "Suspendu" },
};

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

export default function AdminDashboard() {
  const { data: tableau, isLoading: isTableauLoading } = useQuery({
    queryKey: ["admin-tableau-de-bord"],
    queryFn: subscribeService.getTableauDeBord,
  });
  
  const { data: payStats, isLoading: isPayLoading } = useQuery({
    queryKey: ["admin-payment-stats"],
    queryFn: paymentService.getStats,
  });

  const isLoading = isTableauLoading || isPayLoading;
  const resume = tableau?.resume || {};
  const paymentResume = payStats?.resume || {};

  const totalRecettes = REPARTITION_PLANS.reduce((sum, p) => {
    const count = STATUT_AGENCES.find(s => s.name === "Actives")?.value || 8;
    return sum + (p.value * p.prix);
  }, 0);

  return (
    <DashboardLayout>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#135bec] to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-[#135bec]/30">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">NJILA Admin Console</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block" />
              <p className="text-sm text-slate-400">Supervision globale de la plateforme • Mis à jour en temps réel</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors relative">
            <Bell className="w-4 h-4 text-slate-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
          </button>
          <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Rapport PDF
          </button>
          <button className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <Building2 className="w-4 h-4" /> + Nouvelle agence
          </button>
        </div>
      </div>

      {isLoading ? <Spinner size="lg" className="py-20" /> : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <div className="bg-gradient-to-br from-[#135bec] to-blue-800 rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
              <Building2 className="w-5 h-5 mb-3 opacity-80" />
              <p className="text-3xl font-extrabold">{resume.actifs || 8}</p>
              <p className="text-blue-200 text-sm mt-0.5">Agences actives</p>
              <div className="flex items-center gap-1 mt-2">
                <ArrowUp className="w-3 h-3 text-emerald-300" />
                <span className="text-xs text-emerald-300 font-bold">+3 ce mois</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
              <TrendingUp className="w-5 h-5 mb-3 opacity-80" />
              <p className="text-3xl font-extrabold">{formatMontant(resume.recette_totale_fcfa || 2850000)}</p>
              <p className="text-emerald-200 text-sm mt-0.5">Recettes abonnements</p>
              <div className="flex items-center gap-1 mt-2">
                <ArrowUp className="w-3 h-3 text-white/80" />
                <span className="text-xs text-white/80 font-bold">+12% vs N-1</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <Clock className="w-5 h-5 mb-3 text-amber-500" />
              <p className="text-3xl font-extrabold text-slate-900">{resume.essais || 3}</p>
              <p className="text-slate-400 text-sm mt-0.5">En période d'essai</p>
              <p className="text-xs text-amber-600 font-semibold mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Conversion à suivre
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <AlertTriangle className="w-5 h-5 mb-3 text-red-500" />
              <p className="text-3xl font-extrabold text-slate-900">{resume.expirant_sous_30j || 2}</p>
              <p className="text-slate-400 text-sm mt-0.5">Expirent dans 30j</p>
              <p className="text-xs text-red-500 font-semibold mt-2">Action requise !</p>
            </div>
          </div>

          {/* ── Row 1 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            {/* Recettes plateforme */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-extrabold text-slate-900">Croissance de la plateforme</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Recettes abonnements & nombre d'agences</p>
                </div>
                <select className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600">
                  <option>2026</option><option>2025</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={RECETTES_MENSUELLES}>
                  <defs>
                    <linearGradient id="gradAdmin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#135bec" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#135bec" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAgences" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area yAxisId="left" type="monotone" dataKey="recettes" name="Recettes" stroke="#135bec" strokeWidth={2.5} fill="url(#gradAdmin)" />
                  <Line yAxisId="right" type="monotone" dataKey="agences" name="Agences" stroke="#10b981" strokeWidth={2.5}
                    dot={{ fill: "#10b981", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Statut agences Donut */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-extrabold text-slate-900 mb-4">Statut des agences</h3>
              <div className="flex justify-center mb-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={STATUT_AGENCES}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {STATUT_AGENCES.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5">
                {STATUT_AGENCES.map(item => (
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
                <p className="text-xs text-slate-400">Total : <span className="font-bold text-slate-700">14 agences</span></p>
              </div>
            </div>
          </div>

          {/* ── Row 2 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Plans distribution */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-extrabold text-slate-900">Distribution des abonnements</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {REPARTITION_PLANS.map(plan => (
                  <div key={plan.name}
                    className="p-4 rounded-xl border-2 border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">{plan.name}</span>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }} />
                    </div>
                    <p className="text-2xl font-extrabold text-slate-900">{plan.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {plan.prix > 0 ? formatMontant(plan.prix) + "/période" : "Gratuit"}
                    </p>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={REPARTITION_PLANS} layout="horizontal">
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {REPARTITION_PLANS.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Activité API */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-extrabold text-slate-900">Activité de la plateforme</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Appels API et réservations (aujourd'hui)</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-semibold">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
                  99.9% uptime
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={ACTIVITE_PLATEFORME}>
                  <defs>
                    <linearGradient id="gradAPI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="heure" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="api" name="Req. API" stroke="#6366f1" strokeWidth={2} fill="url(#gradAPI)" />
                  <Line type="monotone" dataKey="bookings" name="Réservations" stroke="#f59e0b" strokeWidth={2}
                    dot={{ fill: "#f59e0b", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Top agences table ── */}
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
                  {["Agence", "Plan", "Recettes", "Voyageurs", "Note", "Statut", "Actions"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOP_AGENCES.map((ag, i) => {
                  const planCfg = PLAN_CFG[ag.plan] || {};
                  const statusCfg = STATUT_CFG[ag.statut] || {};
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(ag.nom.slice(0,2))}&background=135bec&color=fff&size=36`}
                            alt={ag.nom}
                            className="w-9 h-9 rounded-xl"
                          />
                          <span className="font-bold text-slate-800 text-sm">{ag.nom}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${planCfg.color}`}>{planCfg.label}</span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-slate-700">
                        {ag.recettes > 0 ? formatMontant(ag.recettes) : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{ag.voyageurs.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm font-bold text-slate-700">{ag.note}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                          <span className="text-xs font-semibold text-slate-600">{statusCfg.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button className="w-7 h-7 hover:bg-slate-100 rounded-lg flex items-center justify-center">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Alertes expiration ── */}
          {tableau?.abonnements_expirant_bientot?.length > 0 && (
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
                  {tableau.abonnements_expirant_bientot.length} agences
                </span>
              </div>
              <div className="space-y-3">
                {tableau.abonnements_expirant_bientot.map(ab => (
                  <div key={ab.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-amber-100">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(ab.id_agence.slice(0,2))}&background=f59e0b&color=fff&size=36`}
                        className="w-9 h-9 rounded-xl"
                        alt={ab.id_agence}
                      />
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{ab.id_agence}</p>
                        <p className="text-xs text-slate-400">Plan {ab.plan} • {ab.jours_restants} jours restants</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                        Contacter
                      </button>
                      <button className="px-4 py-2 text-xs font-bold text-white bg-[#135bec] hover:bg-blue-700 rounded-xl transition-colors">
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