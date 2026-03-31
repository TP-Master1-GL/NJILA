import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, Funnel, FunnelChart, LabelList
} from "recharts";
import {
  TrendingUp, Users, Bus, Ticket, Calendar,
  Download, Filter, ArrowUp, ArrowDown,
  Star, Award, Target, Zap
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { formatMontant } from "../../utils/formatters";

const RECETTES_PAR_ROUTE = [
  { route: "DLA→YDE", recettes: 4260000, voyageurs: 1420, taux: 87, evolution: 12 },
  { route: "YDE→DLA", recettes: 3840000, voyageurs: 1280, taux: 82, evolution: 8 },
  { route: "DLA→BAF", recettes: 1920000, voyageurs: 640, taux: 71, evolution: -3 },
  { route: "YDE→GAR", recettes: 2240000, voyageurs: 280, taux: 94, evolution: 22 },
  { route: "DLA→KRI", recettes: 990000, voyageurs: 550, taux: 76, evolution: 5 },
  { route: "YDE→BAM", recettes: 1050000, voyageurs: 420, taux: 68, evolution: -7 },
];

const SATISFACTION = [
  { note: "5 ⭐", nb: 1820, pct: 48 },
  { note: "4 ⭐", nb: 1140, pct: 30 },
  { note: "3 ⭐", nb: 570, pct: 15 },
  { note: "2 ⭐", nb: 228, pct: 6 },
  { note: "1 ⭐", nb: 38, pct: 1 },
];

const HEBDO = [
  { sem: "S38", recettes: 980000, billets: 285 },
  { sem: "S39", recettes: 1120000, billets: 320 },
  { sem: "S40", recettes: 1050000, billets: 298 },
  { sem: "S41", recettes: 1380000, billets: 412 },
  { sem: "S42", recettes: 1590000, billets: 468 },
  { sem: "S43", recettes: 1420000, billets: 390 },
  { sem: "S44", recettes: 1750000, billets: 520 },
];

const HEATMAP_HEURES = [
  { heure: "06h", lun: 45, mar: 42, mer: 55, jeu: 47, ven: 68, sam: 95, dim: 78 },
  { heure: "08h", lun: 82, mar: 78, mer: 89, jeu: 85, ven: 112, sam: 145, dim: 132 },
  { heure: "10h", lun: 55, mar: 52, mer: 61, jeu: 58, ven: 75, sam: 98, dim: 88 },
  { heure: "12h", lun: 38, mar: 35, mer: 42, jeu: 40, ven: 55, sam: 72, dim: 65 },
  { heure: "14h", lun: 62, mar: 58, mer: 68, jeu: 64, ven: 85, sam: 110, dim: 98 },
  { heure: "16h", lun: 75, mar: 70, mer: 82, jeu: 78, ven: 102, sam: 130, dim: 118 },
];

const COULEURS_ROUTES = ["#135bec", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

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

function StatBadge({ value, label, icon: Icon, color, bgColor }) {
  return (
    <div className={`${bgColor} rounded-2xl p-5 border border-${color}-100`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-5 h-5 text-${color}-600`} />
        <span className={`text-xs font-bold text-${color}-600 bg-${color}-100 px-2 py-0.5 rounded-full`}>Ce mois</span>
      </div>
      <p className={`text-2xl font-extrabold text-${color}-900`}>{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function Statistiques() {
  const [mois, setMois] = useState("Octobre 2026");

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center">
            <img src="https://ui-avatars.com/api/?name=GV&background=135bec&color=fff&size=40" alt="Agency" className="w-10 h-10 rounded-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Statistiques & Business Intelligence</h1>
            <p className="text-slate-400 text-sm">General Voyages — Analyse des performances</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={mois}
            onChange={e => setMois(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700"
          >
            {["Octobre 2026", "Septembre 2026", "Août 2026", "3e Trimestre", "Cette année"].map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Exporter
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-gradient-to-br from-[#135bec] to-blue-700 rounded-2xl p-5 text-white">
          <TrendingUp className="w-5 h-5 mb-3 opacity-80" />
          <p className="text-2xl font-extrabold">{formatMontant(12280500)}</p>
          <p className="text-blue-200 text-sm mt-1">Recettes totales</p>
          <div className="flex items-center gap-1 mt-2">
            <ArrowUp className="w-3 h-3 text-emerald-300" />
            <span className="text-xs text-emerald-300 font-bold">+18.5%</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <Users className="w-5 h-5 mb-3 text-violet-500" />
          <p className="text-2xl font-extrabold text-slate-900">3 842</p>
          <p className="text-slate-400 text-sm mt-1">Voyageurs ce mois</p>
          <div className="flex items-center gap-1 mt-2">
            <ArrowUp className="w-3 h-3 text-emerald-500" />
            <span className="text-xs text-emerald-600 font-bold">+11%</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <Bus className="w-5 h-5 mb-3 text-amber-500" />
          <p className="text-2xl font-extrabold text-slate-900">84.2%</p>
          <p className="text-slate-400 text-sm mt-1">Taux d'occupation</p>
          <div className="flex items-center gap-1 mt-2">
            <ArrowDown className="w-3 h-3 text-red-400" />
            <span className="text-xs text-red-500 font-bold">-2%</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <Ticket className="w-5 h-5 mb-3 text-emerald-500" />
          <p className="text-2xl font-extrabold text-slate-900">4 218</p>
          <p className="text-slate-400 text-sm mt-1">Billets émis</p>
          <div className="flex items-center gap-1 mt-2">
            <ArrowUp className="w-3 h-3 text-emerald-500" />
            <span className="text-xs text-emerald-600 font-bold">+9%</span>
          </div>
        </div>
      </div>

      {/* Row 1 : Recettes par route + Satisfaction */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-slate-900">Performances par route</h3>
            <button className="text-xs text-[#135bec] font-semibold">Détails →</button>
          </div>
          <div className="space-y-3">
            {RECETTES_PAR_ROUTE.map(({ route, recettes, voyageurs, taux, evolution }, i) => (
              <div key={route} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black"
                  style={{ backgroundColor: COULEURS_ROUTES[i] }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-800">{route}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{voyageurs.toLocaleString()} pax</span>
                      <span className="text-sm font-extrabold text-slate-900">
                        {new Intl.NumberFormat("fr").format(recettes)} F
                      </span>
                      <span className={`text-xs font-bold flex items-center gap-0.5 ${evolution > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {evolution > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {Math.abs(evolution)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${taux}%`, backgroundColor: COULEURS_ROUTES[i] }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 w-9 text-right">{taux}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Satisfaction */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-extrabold text-slate-900">Satisfaction client</h3>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-lg font-extrabold text-slate-900">4.6</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-5">Basé sur 3 796 avis ce mois</p>
          <div className="space-y-2.5">
            {SATISFACTION.map(({ note, nb, pct }) => (
              <div key={note} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-12 text-right font-medium">{note}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-600 w-8 text-right">{pct}%</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-emerald-50 rounded-xl">
                <Award className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-xl font-extrabold text-emerald-700">78%</p>
                <p className="text-xs text-emerald-600">Recommandent</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <Target className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <p className="text-xl font-extrabold text-blue-700">92%</p>
                <p className="text-xs text-blue-600">Reviendraient</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 : Tendance hebdo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-extrabold text-slate-900">Tendance hebdomadaire</h3>
              <p className="text-xs text-slate-400 mt-0.5">Recettes et billets — 7 dernières semaines</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={HEBDO} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="sem" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="recettes" name="Recettes" fill="#135bec" radius={[4, 4, 0, 0]} opacity={0.9} />
              <Line yAxisId="right" type="monotone" dataKey="billets" name="Billets" stroke="#f59e0b" strokeWidth={2.5}
                dot={{ fill: "#f59e0b", r: 3 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distribution des recettes */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-slate-900">Répartition des recettes</h3>
            <span className="text-xs text-slate-400">Par route</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={RECETTES_PAR_ROUTE}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="recettes"
                nameKey="route"
                paddingAngle={2}
                label={({ route, pct }) => `${route}`}
                labelLine={false}
              >
                {RECETTES_PAR_ROUTE.map((_, i) => (
                  <Cell key={i} fill={COULEURS_ROUTES[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => new Intl.NumberFormat("fr").format(v) + " F"} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alertes */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-extrabold text-slate-900 mb-4">Insights & Recommandations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
            <Zap className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Opportunité détectée</p>
              <p className="text-xs text-emerald-700 mt-0.5">La route YDE→GAR affiche 94% d'occupation. Envisagez d'ajouter un départ quotidien supplémentaire.</p>
            </div>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
            <ArrowDown className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Attention requise</p>
              <p className="text-xs text-amber-700 mt-0.5">La route YDE→BAM a perdu 7% ce mois. Une action tarifaire ou marketing pourrait relancer la demande.</p>
            </div>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">Croissance confirmée</p>
              <p className="text-xs text-blue-700 mt-0.5">Le canal WEB représente maintenant 36% des ventes (+8pts vs S38). La digitalisation porte ses fruits.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}