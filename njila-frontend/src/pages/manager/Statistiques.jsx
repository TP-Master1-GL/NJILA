/**
 * Statistiques.jsx
 *
 * Page Business Intelligence — données réelles depuis booking-service.
 *
 * Corrections :
 *  1. NaN FCFA → formatMontant protégé + Number(v)||0 sur toutes les valeurs
 *  2. Manager Local → voit uniquement les stats de sa filiale
 *  3. Utilisation des IDs (UUID) au lieu des codes pour les recettes
 *  4. Employés → affichage avec rôle
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, Download, ArrowUp, ArrowDown,
  Award, Target, Smartphone, Banknote, DollarSign,
  RefreshCw, Building2,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Spinner from "../../components/ui/Spinner";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import { filialeService } from "../../services/filialeService";
import { fleetService } from "../../services/fleetService";
import { formatMontant } from "../../utils/formatters";

// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS_CANAL = ["#3B82F6", "#22C55E"];
const COLORS_FILIALES = [
  "#135bec", "#6366f1", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs">
      <p className="font-bold mb-2 text-slate-300">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name} : {
            typeof p.value === "number" && p.value > 1000
              ? formatMontant(p.value)
              : `${(p.value ?? 0).toLocaleString?.() ?? p.value}`
          }
        </p>
      ))}
    </div>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, primary, delta, deltaPositive }) {
  return (
    <div className={`rounded-2xl p-5 ${
      primary
        ? "bg-gradient-to-br from-[#135bec] to-blue-700 text-white"
        : "bg-white border border-slate-100 shadow-sm"
    }`}>
      <Icon className={`w-5 h-5 mb-3 ${primary ? "opacity-80 text-white" : "text-blue-500"}`} />
      <p className={`text-2xl font-extrabold ${primary ? "text-white" : "text-slate-900"}`}>
        {value ?? "—"}
      </p>
      <p className={`text-sm mt-1 ${primary ? "text-blue-200" : "text-slate-400"}`}>{label}</p>
      {sub && (
        <p className={`text-xs mt-0.5 ${primary ? "text-blue-300" : "text-slate-400"}`}>{sub}</p>
      )}
      {delta != null && (
        <div className="flex items-center gap-1 mt-2">
          {deltaPositive
            ? <ArrowUp className={`w-3 h-3 ${primary ? "text-emerald-300" : "text-emerald-500"}`} />
            : <ArrowDown className={`w-3 h-3 ${primary ? "text-red-300" : "text-red-400"}`} />}
          <span className={`text-xs font-bold ${
            deltaPositive
              ? primary ? "text-emerald-300" : "text-emerald-600"
              : primary ? "text-red-300"     : "text-red-500"
          }`}>{delta}</span>
        </div>
      )}
    </div>
  );
}

// ─── Filiale Stats Row ────────────────────────────────────────────────────────
function FilialeStatsRow({ filiale, recettes, stats, color }) {
  const total = Number(recettes?.recetteTotale) || 0;
  const taux  = Number(stats?.tauxConversion)   || 0;
  const nbConf = Number(stats?.reservationsConfirmees) || 0;
  const pctEn  = Number(recettes?.partEnLignePct) || 0;
  const pctGu  = Number(recettes?.partGuichetPct) || 0;

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {(filiale.nom?.[0] || "?").toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <span className="text-sm font-bold text-slate-800 truncate">{filiale.nom}</span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-slate-400">
              {nbConf.toLocaleString("fr")} rés.
            </span>
            <span className="text-sm font-extrabold text-slate-900">
              {formatMontant(total)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-blue-500 transition-all duration-700"
              style={{ width: `${pctEn}%` }}
            />
            <div
              className="h-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${pctGu}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 w-12 text-right font-semibold">
            {taux.toFixed(1)}% conv.
          </span>
        </div>
        <div className="flex gap-3 mt-1">
          <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
            <Smartphone className="w-2.5 h-2.5" /> {pctEn}% WEB
          </span>
          <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
            <Banknote className="w-2.5 h-2.5" /> {pctGu}% Guichet
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function Statistiques() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const isManagerLocal  = user?.role === "MANAGER_LOCAL";
  const isManagerGlobal = user?.role === "MANAGER_GLOBAL";

  // ✅ CORRECTION : Utiliser les IDs (UUID) au lieu des codes
  const agenceId    = user?.agenceId || user?.agence?.id;
  const filialeId   = user?.filialeId || user?.filiale?.id;

  // Log pour déboguer - à retirer en production
  console.log("[Statistiques] User:", {
    role: user?.role,
    agenceId,
    filialeId
  });

  // ── Filiales ─────────────────────────────────────────────────────────────────
  const { data: filiales = [], isLoading: isLoadingFiliales } = useQuery({
    queryKey: ["filiales-stats", agenceId, isManagerLocal, filialeId],
    queryFn: async () => {
      if (isManagerLocal) {
        // ✅ Manager Local → uniquement sa filiale
        if (filialeId) {
          const f = await filialeService.getFilialeById?.(filialeId)
            || (await filialeService.getFiliales({ agence: agenceId })).find(
                x => x.id_filiale === filialeId
              );
          return f ? [f] : [];
        }
        const all = await filialeService.getFiliales({ agence: agenceId });
        return all.filter(f => f.id_filiale === filialeId);
      }
      return filialeService.getFiliales({ agence: agenceId });
    },
    enabled: !!agenceId,
    staleTime: 5 * 60 * 1000,
  });

  // ── Recettes AGENCE (Manager Global) avec ID ─────────────────────────────────
  const {
    data: recettesAgence,
    isLoading: isLoadingRecettesAgence,
    refetch: refetchRecettesAgence,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["recettes-agence-stats", agenceId],
    queryFn: () => {
      if (!agenceId) {
        console.warn("[Statistiques] Pas d'agenceId valide");
        return Promise.resolve(null);
      }
      // ✅ Utiliser l'ID de l'agence (UUID)
      return bookingService.getRecettesAgence(agenceId, "XAF");
    },
    enabled: !!agenceId && isManagerGlobal,
    staleTime: 3 * 60 * 1000,
    onError: (err) => {
      console.error("[Statistiques] Erreur getRecettesAgence:", err);
    },
  });

  // ── Recettes FILIALE (Manager Local) avec ID ─────────────────────────────────
  const {
    data: recettesFiliale,
    isLoading: isLoadingRecettesFiliale,
    refetch: refetchRecettesFiliale,
  } = useQuery({
    queryKey: ["recettes-filiale-stats", filialeId],
    queryFn: () => {
      if (!filialeId) {
        console.warn("[Statistiques] Pas de filialeId valide");
        return Promise.resolve(null);
      }
      // ✅ Utiliser l'ID de la filiale (UUID)
      return bookingService.getRecettesFiliale(filialeId, "XAF");
    },
    enabled: !!filialeId && isManagerLocal,
    staleTime: 3 * 60 * 1000,
    onError: (err) => {
      console.error("[Statistiques] Erreur getRecettesFiliale:", err);
    },
  });

  // ✅ Source unifiée selon rôle
  const recettesRef        = isManagerLocal ? recettesFiliale  : recettesAgence;
  const isLoadingRecettes  = isManagerLocal ? isLoadingRecettesFiliale : isLoadingRecettesAgence;
  const refetchRecettes    = isManagerLocal ? refetchRecettesFiliale   : refetchRecettesAgence;

  // ── Recettes + Stats FILIALES parallèles (utilise les IDs) ───────────────────
  const { data: filialesData = [] } = useQuery({
    queryKey: ["filiales-recettes-stats", filiales.map(f => f.id_filiale).join(",")],
    queryFn: async () => {
      const ids = filiales.map(f => f.id_filiale).filter(id => id);
      
      const [recettesResults, statsResults] = await Promise.all([
        Promise.allSettled(
          ids.map(id => bookingService.getRecettesFiliale(id, "XAF"))
        ),
        Promise.allSettled(
          filiales.map(f =>
            bookingService.getStats
              ? bookingService.getStats(f.id_filiale)
              : Promise.resolve(null)
          )
        ),
      ]);
      
      return filiales.map((f, i) => ({
        filiale: f,
        // ✅ Fallback objet zéro si erreur réseau
        recettes: recettesResults[i]?.status === "fulfilled" && recettesResults[i]?.value
          ? recettesResults[i].value
          : { 
              recetteTotale: 0, 
              recetteEnLigne: 0, 
              recetteGuichet: 0, 
              nbReservationsEnLigne: 0, 
              nbReservationsGuichet: 0, 
              partEnLignePct: 0, 
              partGuichetPct: 0 
            },
        stats: statsResults[i]?.status === "fulfilled" && statsResults[i]?.value
          ? statsResults[i].value
          : { 
              tauxConversion: 0, 
              reservationsConfirmees: 0, 
              reservationsAnnulees: 0, 
              totalReservations: 0 
            },
      }));
    },
    enabled: filiales.length > 0,
    staleTime: 3 * 60 * 1000,
  });

  // ── Agrégations ───────────────────────────────────────────────────────────────
  const aggregats = useMemo(() => {
    const totalConfirmees = filialesData.reduce(
      (s, d) => s + (Number(d.stats?.reservationsConfirmees) || 0), 0
    );
    const totalAnnulees = filialesData.reduce(
      (s, d) => s + (Number(d.stats?.reservationsAnnulees) || 0), 0
    );
    const totalResa = filialesData.reduce(
      (s, d) => s + (Number(d.stats?.totalReservations) || 0), 0
    );
    const tauxMoyen = totalResa > 0
      ? Math.round((totalConfirmees / totalResa) * 1000) / 10
      : 0;
    return { totalConfirmees, totalAnnulees, totalResa, tauxMoyen };
  }, [filialesData]);

  // ✅ Valeurs KPI sécurisées depuis la bonne source
  const kpiTotal    = Number(recettesRef?.recetteTotale)  || 0;
  const kpiEnLigne  = Number(recettesRef?.recetteEnLigne) || 0;
  const kpiGuichet  = Number(recettesRef?.recetteGuichet) || 0;
  const kpiNbEn     = Number(recettesRef?.nbReservationsEnLigne)  || 0;
  const kpiNbGu     = Number(recettesRef?.nbReservationsGuichet) || 0;
  const kpiPctEn    = Number(recettesRef?.partEnLignePct) || 0;
  const kpiPctGu    = Number(recettesRef?.partGuichetPct) || 0;

  // Pie data canaux
  const pieDataCanaux = [
    { name: "En ligne (WEB)",    value: kpiEnLigne, fill: COLORS_CANAL[0] },
    { name: "Guichet (espèces)", value: kpiGuichet, fill: COLORS_CANAL[1] },
  ];

  // Bar chart recettes par filiale
  const graphFiliales = filialesData.map(d => ({
    nom:     d.filiale.nom,
    total:   Number(d.recettes?.recetteTotale)  || 0,
    enligne: Number(d.recettes?.recetteEnLigne) || 0,
    guichet: Number(d.recettes?.recetteGuichet) || 0,
  }));

  // Bar chart taux de conversion
  const graphTaux = filialesData.map(d => ({
    nom:  d.filiale.nom,
    taux: Number(d.stats?.tauxConversion) || 0,
  }));

  // Meilleure filiale
  const topFilialeData = filialesData.reduce((max, d) => {
    return (Number(d.recettes?.recetteTotale) || 0) > (Number(max?.recettes?.recetteTotale) || 0) ? d : max;
  }, filialesData[0]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const isLoading = isLoadingFiliales || isLoadingRecettes;

  return (
    <DashboardLayout>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#135bec]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {isManagerLocal ? "Statistiques — Ma filiale" : "Statistiques & Business Intelligence"}
            </h1>
            <p className="text-slate-400 text-sm">
              {user?.agenceName || "Agence"}{isManagerLocal ? ` · ${filiales[0]?.nom || ""}` : ""}
              {lastUpdated && (
                <span className="ml-2 text-slate-300">· mis à jour {lastUpdated}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetchRecettes?.()}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Exporter
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard
              label={isManagerLocal ? "Recettes filiale" : "Recettes totales"}
              value={formatMontant(kpiTotal)}
              sub={`${kpiNbEn + kpiNbGu} rés. payées`}
              icon={DollarSign}
              primary
            />
            <KpiCard
              label="En ligne — mobile money"
              value={formatMontant(kpiEnLigne)}
              sub={`${kpiNbEn} rés. · ${kpiPctEn}%`}
              icon={Smartphone}
            />
            <KpiCard
              label="Espèces guichet"
              value={formatMontant(kpiGuichet)}
              sub={`${kpiNbGu} rés. · ${kpiPctGu}%`}
              icon={Banknote}
            />
            <KpiCard
              label="Taux de conversion moyen"
              value={`${aggregats.tauxMoyen}%`}
              sub={`${aggregats.totalConfirmees.toLocaleString("fr")} conf. / ${aggregats.totalResa.toLocaleString("fr")} total`}
              icon={Target}
            />
          </div>

          {/* ── Row 1 : Performances filiales + Répartition canaux ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-extrabold text-slate-900">
                  {isManagerLocal ? "Ma filiale" : "Performances par filiale"}
                </h3>
                <div className="flex gap-3 text-[10px] font-semibold">
                  <span className="flex items-center gap-1 text-blue-600">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> WEB
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Guichet
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                {filialesData.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-8">Aucune donnée disponible</p>
                ) : (
                  filialesData.map((d, i) => (
                    <FilialeStatsRow
                      key={d.filiale.id_filiale}
                      filiale={d.filiale}
                      recettes={d.recettes}
                      stats={d.stats}
                      color={COLORS_FILIALES[i % COLORS_FILIALES.length]}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Répartition canaux */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-extrabold text-slate-900 mb-2">Répartition canaux</h3>
              <p className="text-xs text-slate-400 mb-4">
                {isManagerLocal ? "Ma filiale" : "WEB vs Guichet — agence"}
              </p>

              {kpiTotal === 0 ? (
                <p className="text-center text-slate-400 text-sm py-10">Aucune recette enregistrée</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieDataCanaux}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={75}
                        paddingAngle={4} dataKey="value"
                      >
                        {pieDataCanaux.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => formatMontant(v)} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-2 mt-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                        <Smartphone className="w-3.5 h-3.5" /> En ligne
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-blue-700">{formatMontant(kpiEnLigne)}</p>
                        <p className="text-[10px] text-blue-500">{kpiNbEn} rés.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <Banknote className="w-3.5 h-3.5" /> Guichet
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-emerald-700">{formatMontant(kpiGuichet)}</p>
                        <p className="text-[10px] text-emerald-500">{kpiNbGu} rés.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Top filiale (Manager Global uniquement) */}
              {isManagerGlobal && topFilialeData && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-500 mb-2">Top filiale</p>
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="font-extrabold text-amber-800 text-sm">{topFilialeData.filiale.nom}</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {formatMontant(Number(topFilialeData.recettes?.recetteTotale) || 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 2 : Graphiques ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Bar chart recettes par filiale */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-extrabold text-slate-900 mb-1">
                {isManagerLocal ? "Recettes — ma filiale" : "Recettes par filiale"}
              </h3>
              <p className="text-xs text-slate-400 mb-5">Ventilation WEB / Guichet (FCFA)</p>
              {graphFiliales.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-12">Aucune donnée</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={graphFiliales} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="nom" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<DarkTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="enligne" name="En ligne" stackId="a" fill="#3B82F6" />
                    <Bar dataKey="guichet" name="Guichet"  stackId="a" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Taux conversion */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-extrabold text-slate-900 mb-1">Taux de conversion</h3>
              <p className="text-xs text-slate-400 mb-5">% réservations confirmées / total</p>
              {graphTaux.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-12">Aucune donnée</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={graphTaux} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis
                      type="number" domain={[0, 100]}
                      tickFormatter={v => `${v}%`}
                      tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    />
                    <YAxis
                      type="category" dataKey="nom"
                      tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                      width={80}
                    />
                    <Tooltip formatter={v => `${v}%`} />
                    <Bar dataKey="taux" name="Taux conv." fill="#6366f1" radius={[0, 4, 4, 0]}>
                      {graphTaux.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.taux >= 70 ? "#22c55e"
                            : entry.taux >= 40 ? "#f59e0b"
                            : "#ef4444"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Tableau récap ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900">
                {isManagerLocal ? "Tableau de bord — ma filiale" : "Tableau de bord filiales"}
              </h3>
              <p className="text-xs text-slate-400">Données en temps réel — booking-service</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    {[
                      "Filiale", "Ville",
                      "Recette totale", "WEB", "Guichet", "Part WEB",
                      "Rés. confirmées", "Rés. annulées", "Taux conv.",
                    ].map(h => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-bold text-slate-500 ${
                          ["Filiale", "Ville"].includes(h) ? "text-left" : "text-right"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filialesData.map((d, i) => {
                    const tot    = Number(d.recettes?.recetteTotale)  || 0;
                    const web    = Number(d.recettes?.recetteEnLigne) || 0;
                    const guich  = Number(d.recettes?.recetteGuichet) || 0;
                    const pct    = Number(d.recettes?.partEnLignePct) || 0;
                    const conf   = Number(d.stats?.reservationsConfirmees) || 0;
                    const annul  = Number(d.stats?.reservationsAnnulees)   || 0;
                    const taux   = Number(d.stats?.tauxConversion) || 0;

                    return (
                      <tr
                        key={d.filiale.id_filiale}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: COLORS_FILIALES[i % COLORS_FILIALES.length] }}
                            />
                            <span className="font-semibold text-slate-900 text-sm">{d.filiale.nom}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-sm">{d.filiale.ville}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                          {formatMontant(tot)}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-700 font-bold text-sm">
                          {formatMontant(web)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-700 font-bold text-sm">
                          {formatMontant(guich)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-semibold text-sm">
                          {conf.toLocaleString("fr")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          <span className={`font-semibold ${annul > 10 ? "text-red-600" : "text-slate-500"}`}>
                            {annul.toLocaleString("fr")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-extrabold ${
                            taux >= 70 ? "text-emerald-600"
                            : taux >= 40 ? "text-amber-600"
                            : "text-red-600"
                          }`}>
                            {taux.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totaux — Manager Global */}
                {isManagerGlobal && (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-200">
                      <td className="px-4 py-3 font-extrabold text-slate-900" colSpan={2}>TOTAL AGENCE</td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                        {formatMontant(kpiTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-blue-700">
                        {formatMontant(kpiEnLigne)}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-emerald-700">
                        {formatMontant(kpiGuichet)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{kpiPctEn}%</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">
                        {aggregats.totalConfirmees.toLocaleString("fr")}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">
                        {aggregats.totalAnnulees.toLocaleString("fr")}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-700">
                        {aggregats.tauxMoyen}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── Insights ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-extrabold text-slate-900 mb-4">Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-800">Canal en ligne</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {kpiPctEn}% des recettes proviennent de paiements mobile money.{" "}
                    {kpiPctEn >= 50
                      ? "La digitalisation est majoritaire."
                      : "Le guichet reste dominant — accélérer la digitalisation."}
                  </p>
                </div>
              </div>

              {(() => {
                const faible = filialesData.find(d => (Number(d.stats?.tauxConversion) || 0) < 40 && d.recettes);
                return faible ? (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                    <ArrowDown className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Attention requise</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        <strong>{faible.filiale.nom}</strong> affiche un taux de conversion de{" "}
                        {(Number(faible.stats?.tauxConversion) || 0).toFixed(1)}%. Action commerciale recommandée.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                    <Award className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Performance solide</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Toutes les filiales affichent un taux de conversion supérieur à 40%.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {isManagerGlobal && topFilialeData && (
                <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-purple-800">Meilleure filiale</p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      <strong>{topFilialeData.filiale.nom}</strong> génère{" "}
                      {formatMontant(Number(topFilialeData.recettes?.recetteTotale) || 0)} dont{" "}
                      {Number(topFilialeData.recettes?.partEnLignePct) || 0}% en ligne.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
