import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar
} from "recharts";
import {
  Bus, Users, TrendingUp, Calendar, Clock, MoreVertical,
  ArrowRight, ArrowUp, ArrowDown, Ticket, MapPin, Star,
  Activity, DollarSign, Package, AlertTriangle, CheckCircle,
  Eye, Download, RefreshCw, Bell, Search, Filter, Network
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { formatMontant } from "../../utils/formatters";
import { useQuery, useMutation } from "@tanstack/react-query";
import { paymentService } from "../../services/paymentService";
import { fleetService } from "../../services/fleetService";
import { filialeService } from "../../services/filialeService";
import Spinner from "../../components/ui/Spinner";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";
import { useAuthStore } from "../../store/authStore";
import { ROLES } from "../../utils/constants";



// ── Data ──────────────────────────────────────────────────────────────────────
const RECETTES_MENSUEL = [
  { mois: "Jan", recettes: 3200000, voyageurs: 1820, prevision: 3000000 },
  { mois: "Fév", recettes: 2900000, voyageurs: 1620, prevision: 3100000 },
  { mois: "Mar", recettes: 3800000, voyageurs: 2100, prevision: 3500000 },
  { mois: "Avr", recettes: 4100000, voyageurs: 2380, prevision: 3900000 },
  { mois: "Mai", recettes: 3600000, voyageurs: 2050, prevision: 3700000 },
  { mois: "Jun", recettes: 4500000, voyageurs: 2620, prevision: 4200000 },
  { mois: "Jul", recettes: 5100000, voyageurs: 2900, prevision: 4800000 },
  { mois: "Aoû", recettes: 4800000, voyageurs: 2750, prevision: 4600000 },
  { mois: "Sep", recettes: 4200000, voyageurs: 2400, prevision: 4100000 },
  { mois: "Oct", recettes: 4600000, voyageurs: 2650, prevision: 4300000 },
  { mois: "Nov", recettes: 3900000, voyageurs: 2200, prevision: 3800000 },
  { mois: "Déc", recettes: 5800000, voyageurs: 3350, prevision: 5500000 },
];

const OCCUPATION_PAR_ROUTE = [
  { route: "DLA→YDE", taux: 87, voyages: 142 },
  { route: "YDE→DLA", taux: 82, voyages: 128 },
  { route: "DLA→BAF", taux: 71, voyages: 64 },
  { route: "YDE→GAR", taux: 94, voyages: 28 },
  { route: "DLA→KRI", taux: 76, voyages: 55 },
  { route: "YDE→BAM", taux: 68, voyages: 42 },
];

const REPARTITION_CLASSE = [
  { name: "VIP", value: 35, color: "#135bec" },
  { name: "Classic", value: 37, color: "#10b981" },
];

const STATUT_FLOTTE = [
  { name: "Disponibles", value: 14, fill: "#10b981" },
  { name: "En voyage", value: 8, fill: "#135bec" },
  { name: "Maintenance", value: 3, fill: "#f59e0b" },
  { name: "Hors service", value: 2, fill: "#ef4444" },
];

const VENTES_HEBDO = [
  { jour: "Lun", web: 42, guichet: 85 },
  { jour: "Mar", web: 38, guichet: 72 },
  { jour: "Mer", web: 55, guichet: 90 },
  { jour: "Jeu", web: 47, guichet: 78 },
  { jour: "Ven", web: 68, guichet: 112 },
  { jour: "Sam", web: 95, guichet: 145 },
  { jour: "Dim", web: 78, guichet: 130 },
];

const DEPARTURES = [
  { id: 1, heure: "08:30", route: "Douala → Yaoundé", bus: "NJ-VIP-042", chauffeur: "Amadou K.", places: "38/45", statut: "BOARDING", remplissage: 84 },
  { id: 2, heure: "07:15", route: "Douala → Limbe", bus: "NJ-STD-109", chauffeur: "John Ngwa", places: "52/70", statut: "DEPARTED", remplissage: 74 },
  { id: 3, heure: "09:45", route: "Douala → Bafoussam", bus: "NJ-VIP-005", chauffeur: "Fabrice T.", places: "44/45", statut: "ON_TIME", remplissage: 98 },
  { id: 4, heure: "10:30", route: "Douala → Kribi", bus: "NJ-STD-221", chauffeur: "Jean-Pierre", places: "28/70", statut: "ON_TIME", remplissage: 40 },
  { id: 5, heure: "12:00", route: "Douala → Yaoundé", bus: "NJ-VIP-031", chauffeur: "Paul B.", places: "12/45", statut: "SCHEDULED", remplissage: 27 },
];

const STATUT_CFG = {
  BOARDING:  { label: "Embarquement", color: "bg-blue-100 text-blue-700 border border-blue-200" },
  DEPARTED:  { label: "Parti",        color: "bg-gray-100 text-gray-500 border border-gray-200" },
  ON_TIME:   { label: "À l'heure",    color: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  SCHEDULED: { label: "Planifié",     color: "bg-amber-100 text-amber-700 border border-amber-200" },
  DELAYED:   { label: "Retard",       color: "bg-red-100 text-red-700 border border-red-200" },
};

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs">
      <p className="font-bold mb-1 text-slate-300">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === "number" && p.value > 100000
            ? new Intl.NumberFormat("fr").format(p.value) + " F"
            : p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ title, value, sub, trend, trendVal, icon: Icon, gradient, sparkData }) {
  const isUp = trend === "up";
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white ${gradient}`}>
      {/* Déco */}
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
      <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-extrabold mt-1 leading-none">{value}</p>
            {sub && <p className="text-white/60 text-xs mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {sparkData && (
          <div className="h-10 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line type="monotone" dataKey="v" stroke="rgba(255,255,255,0.8)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {trendVal && (
          <div className="flex items-center gap-1.5">
            <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
              isUp ? "bg-white/20 text-white" : "bg-black/20 text-white/80"
            }`}>
              {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {trendVal}
            </div>
            <span className="text-white/60 text-xs">vs mois dernier</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const isGlobal = user?.role === ROLES.MANAGER_GLOBAL;
  const [activeTab, setActiveTab] = useState("apercu");
  const [isRetraitOpen, setIsRetraitOpen] = useState(false);
  const [retraitForm, setRetraitForm] = useState({ montant: "", motif: "Retrait mensuel recettes" });

  const handlePDF = () => {
    const content = `<html><head><title>Rapport Manager</title>
    <style>body{font-family:Arial;padding:20px;font-size:12px}h1{color:#135bec}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:8px}
    th{background:#135bec;color:white}</style></head><body>
    <h1>Rapport de Performance — ${user?.agenceNom || "Mon Agence"}</h1>
    <p>Généré le : ${new Date().toLocaleDateString("fr-FR")} | Rôle : ${isGlobal ? "Manager Global" : "Manager Local"}</p>
    <h2>Statistiques mensuelles</h2>
    <table><tr><th>Mois</th><th>Recettes (FCFA)</th><th>Voyageurs</th><th>Prévision</th></tr>
    ${RECETTES_MENSUEL.slice(-6).map(d=>`<tr><td>${d.mois}</td><td>${d.recettes.toLocaleString()}</td><td>${d.voyageurs}</td><td>${d.prevision?.toLocaleString()||"—"}</td></tr>`).join("")}
    </table></body></html>`;
    const win = window.open("", "_blank");
    win.document.write(content);
    win.document.close();
    win.print();
  };

  const { mutate: effectuerRetrait, isPending: isRetraitPending } = useMutation({
    mutationFn: (payload) => filialeService.retraitRecettes(payload),
    onSuccess: () => { toast.success("Retrait effectué avec succès !"); setIsRetraitOpen(false); setRetraitForm({ montant: "", motif: "Retrait mensuel recettes" }); },
    onError: () => toast.error("Erreur lors du retrait."),
  });

  const filialeId = user?.filialeId || "local-filiale-id";
  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["manager-payment-summary", filialeId],
    queryFn: () => paymentService.getFilialeSummary(filialeId),
    retry: 1
  });

  const { data: filialesList, isLoading: isLoadingFiliales } = useQuery({
    queryKey: ["manager-filiales"],
    queryFn: fleetService.getFiliales,
    enabled: isGlobal,
    retry: 1
  });

  const [periode, setPeriode] = useState("12m");
  const donneesRecettes = summary?.recettesMensuelles || RECETTES_MENSUEL;
  const sparkRevenu = donneesRecettes.slice(-6).map(d => ({ v: d.recettes / 1000000 }));
  const sparkVoyageurs = donneesRecettes.slice(-6).map(d => ({ v: d.voyageurs }));
  
  const isLoading = isLoadingSummary;

  return (
    <DashboardLayout>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center">
              <img
                src="https://ui-avatars.com/api/?name=General+Voyage&background=135bec&color=fff&size=40"
                alt="Agency"
                className="w-10 h-10 rounded-xl"
              />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">General Voyages</h1>
              <p className="text-sm text-slate-400">Hub Douala — Tableau de bord opérationnel</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sélecteur période */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            {["7j", "30j", "12m"].map(p => (
              <button
                key={p}
                onClick={() => setPeriode(p)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  periode === p ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={handlePDF} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors" title="Télécharger rapport PDF">
            <Download className="w-4 h-4 text-slate-500" />
          </button>
          {isGlobal && (
            <button onClick={() => setIsRetraitOpen(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              Retrait
            </button>
          )}
          <button className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            <Calendar className="w-4 h-4" /> + Nouveau départ
          </button>
        </div>
      </div>

      {/* ── Tabs (Manager Global only) ── */}
      {isGlobal && (
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
          {[
            { id: "apercu",   label: "Aperçu général",  icon: Activity },
            { id: "filiales", label: "Mes Filiales",    icon: Network },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === id
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <KPICard
          title="Recettes du mois"
          value="4 280 500 F"
          sub="Octobre 2026"
          trend="up"
          trendVal="+12.5%"
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-[#135bec] to-blue-700"
          sparkData={sparkRevenu}
        />
        <KPICard
          title="Voyageurs"
          value="3 842"
          sub="Ce mois"
          trend="up"
          trendVal="+11%"
          icon={Users}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          sparkData={sparkVoyageurs}
        />
        <KPICard
          title="Taux d'occupation"
          value="84.2%"
          sub="Moyenne flotte"
          trend="down"
          trendVal="-2%"
          icon={Activity}
          gradient="bg-gradient-to-br from-violet-500 to-purple-700"
        />
        <KPICard
          title="Bus actifs"
          value="24 / 32"
          sub="3 en maintenance"
          icon={Bus}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
        />
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Recettes annuelles */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-extrabold text-slate-900">Évolution des recettes</h3>
              <p className="text-xs text-slate-400 mt-0.5">Réel vs Prévision (FCFA)</p>
            </div>
            <select className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600">
              <option>2026</option><option>2025</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={RECETTES_MENSUEL}>
              <defs>
                <linearGradient id="gradRecettes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#135bec" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#135bec" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${(v/1000000).toFixed(1)}M`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="recettes" name="Réel" stroke="#135bec" strokeWidth={2.5} fill="url(#gradRecettes)" />
              <Area type="monotone" dataKey="prevision" name="Prévision" stroke="#10b981" strokeWidth={2} fill="url(#gradPrev)" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition classe */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-900">Classes de service</h3>
            <span className="text-xs text-slate-400">Ce mois</span>
          </div>
          <div className="flex justify-center mb-4">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={REPARTITION_CLASSE}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {REPARTITION_CLASSE.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5">
            {REPARTITION_CLASSE.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-slate-600 font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-8 text-right">{item.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Ventes WEB vs Guichet */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-extrabold text-slate-900">Canaux de vente</h3>
              <p className="text-xs text-slate-400 mt-0.5">Billets cette semaine</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#135bec] inline-block" />WEB</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Guichet</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={VENTES_HEBDO} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="jour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="web" name="WEB" fill="#135bec" radius={[4, 4, 0, 0]} />
              <Bar dataKey="guichet" name="Guichet" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Occupation par route */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-slate-900">Taux par route</h3>
            <button className="text-xs text-[#135bec] font-semibold hover:underline">Voir tout</button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={OCCUPATION_PAR_ROUTE} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis dataKey="route" type="category" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={60} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="taux" name="Taux" radius={[0, 4, 4, 0]}>
                {OCCUPATION_PAR_ROUTE.map((entry, i) => (
                  <Cell key={i} fill={entry.taux >= 90 ? "#10b981" : entry.taux >= 70 ? "#135bec" : "#f59e0b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Statut flotte */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-900">Statut de la flotte</h3>
            <span className="text-xs font-bold text-slate-400">27 bus total</span>
          </div>
          <div className="flex justify-center mb-3">
            <ResponsiveContainer width="100%" height={150}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={65}
                data={STATUT_FLOTTE}
                startAngle={180}
                endAngle={-180}
              >
                <RadialBar dataKey="value" cornerRadius={4} />
                <Tooltip formatter={(v) => `${v} bus`} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {STATUT_FLOTTE.map(item => (
              <div key={item.name} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.fill }} />
                <div>
                  <p className="text-[10px] text-slate-400 leading-none">{item.name}</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Voyageurs mensuels ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-extrabold text-slate-900">Fréquentation mensuelle</h3>
            <p className="text-xs text-slate-400 mt-0.5">Nombre de voyageurs 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <span className="w-3 h-0.5 bg-[#135bec] inline-block rounded-full" />
              Voyageurs
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={RECETTES_MENSUEL}>
            <defs>
              <linearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#135bec" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#135bec" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="voyageurs"
              name="Voyageurs"
              stroke="#135bec"
              strokeWidth={3}
              dot={{ fill: "#135bec", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Départs du jour ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900">Départs d'aujourd'hui</h3>
            <p className="text-xs text-slate-400 mt-0.5">Suivi temps réel — {DEPARTURES.length} départs planifiés</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-semibold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
              En direct
            </div>
            <button className="flex items-center gap-1.5 text-xs text-[#135bec] font-semibold hover:underline">
              Voir tout <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80">
                {["Heure", "Trajet", "Bus", "Chauffeur", "Remplissage", "Statut", "Action"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEPARTURES.map(dep => {
                const cfg = STATUT_CFG[dep.statut] || {};
                const fillColor = dep.remplissage >= 90 ? "#ef4444" : dep.remplissage >= 70 ? "#135bec" : "#f59e0b";
                return (
                  <tr key={dep.id} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${dep.statut === "DEPARTED" ? "opacity-50" : ""}`}>
                    <td className="px-5 py-4">
                      <span className="text-sm font-extrabold text-slate-900 tabular-nums">{dep.heure}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-sm font-medium text-slate-700">{dep.route}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{dep.bus}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{dep.chauffeur}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${dep.remplissage}%`, backgroundColor: fillColor }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 tabular-nums">{dep.remplissage}%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{dep.places}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
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

        <div className="px-6 py-3 border-t border-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-400">Affichage de {DEPARTURES.length} sur 24 départs aujourd'hui</span>
          <button className="text-xs text-[#135bec] font-semibold hover:underline flex items-center gap-1">
            Voir tous les départs <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── ONGLET FILIALES (Manager Global seulement) ── */}
      {isGlobal && activeTab === "filiales" && (
        <div className="animate-fade-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Mes Filiales</h2>
              <p className="text-sm text-slate-400 mt-0.5">Vue consolidée de toutes vos filiales et leurs performances</p>
            </div>
            <button className="flex items-center gap-2 bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              + Ajouter une filiale
            </button>
          </div>

          {isLoadingFiliales ? (
            <Spinner size="lg" className="py-16" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Filiales depuis l'API ou fallback */}
              {(filialesList?.length ? filialesList : [
                { id: "1", nom: "General Mvan",  ville: "Douala – Mvan",   manager: "Jean Mbarga",   bus: 8,  voyages: 142, taux: 87, recettes: 2800000 },
                { id: "2", nom: "General Akwa",  ville: "Douala – Akwa",   manager: "Marie Ekotto",  bus: 6,  voyages: 108, taux: 79, recettes: 1950000 },
                { id: "3", nom: "General Bassa", ville: "Douala – Bassa",  manager: "Paul Ndjock",   bus: 4,  voyages: 76,  taux: 72, recettes: 1320000 },
                { id: "4", nom: "General Bonaberi", ville: "Douala – Bonaberi", manager: "Alice Fon", bus: 5, voyages: 95, taux: 83, recettes: 1640000 },
              ]).map((f, i) => {
                const tauxColor = f.taux >= 85 ? "text-emerald-600 bg-emerald-50" : f.taux >= 70 ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50";
                return (
                  <div key={f.id || i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(f.nom)}&background=135bec&color=fff&size=40&bold=true`}
                        alt={f.nom}
                        className="w-10 h-10 rounded-xl"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-slate-900 text-sm truncate">{f.nom}</p>
                        <p className="text-xs text-slate-400 truncate">{f.ville}</p>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded-lg ${tauxColor}`}>
                        {f.taux}%
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                        <Bus className="w-4 h-4 text-[#135bec] mx-auto mb-1" />
                        <p className="text-lg font-extrabold text-slate-900">{f.bus}</p>
                        <p className="text-[10px] text-slate-400">Bus</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                        <Calendar className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                        <p className="text-lg font-extrabold text-slate-900">{f.voyages}</p>
                        <p className="text-[10px] text-slate-400">Voyages</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                        <TrendingUp className="w-4 h-4 text-violet-500 mx-auto mb-1" />
                        <p className="text-xs font-extrabold text-slate-900 leading-tight mt-0.5">{formatMontant(f.recettes)}</p>
                        <p className="text-[10px] text-slate-400">Recettes</p>
                      </div>
                    </div>

                    {/* Taux d'occupation bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Taux d'occupation</span>
                        <span className="font-bold">{f.taux}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${f.taux}%`, backgroundColor: f.taux >= 85 ? '#10b981' : f.taux >= 70 ? '#135bec' : '#f59e0b' }}
                        />
                      </div>
                    </div>

                    {/* Manager */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {f.manager?.[0] || "M"}
                        </div>
                        <span className="text-xs text-slate-500">{f.manager || "Manager local"}</span>
                      </div>
                      <button className="text-xs text-[#135bec] font-bold hover:underline flex items-center gap-1">
                        Détails <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}