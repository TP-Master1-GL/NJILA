/**
 * ManagerDashboard.jsx
 *
 * CORRECTION : trajets et voyages sont désormais récupérés via le profil
 * public de l'agence (/api/agences/{agenceId}/profil/) et non via les
 * endpoints /api/trajets/ et /api/voyages/ qui retournaient toutes les agences.
 *
 * Manager Global  → tous les trajets et voyages de son agence
 * Manager Local   → trajets où sa filiale est départ ou arrivée
 *                   voyages dont la filiale de départ = sa filiale
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Building2, Users, Bus, MapPin, TrendingUp, Settings,
  Search, Plus, Edit2, Eye, DollarSign, Activity,
  Navigation, ArrowUpRight, ArrowDownRight,
  Smartphone, Banknote, ChevronDown, ChevronUp,
  RefreshCw, ChevronRight,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Spinner from "../../components/ui/Spinner";
import { useAuthStore } from "../../store/authStore";
import { agenceService } from "../../services/agenceService";
import { filialeService } from "../../services/filialeService";
import { bookingService } from "../../services/bookingService";
import { fleetService } from "../../services/fleetService";
import { userService } from "../../services/userService";
import { formatMontant, formatCompact } from "../../utils/formatters";
import FilialeDetailModal from "./FilialeDetailModal";
import AgenceSettingsModal from "./AgenceSettingsModal";

// ─── Palette canaux ───────────────────────────────────────────────────────────
const CANAL_COLORS = {
  enligne: { bg: "#EFF6FF", text: "#1D4ED8", bar: "#3B82F6", icon: Smartphone },
  guichet: { bg: "#F0FDF4", text: "#15803D", bar: "#22C55E", icon: Banknote },
  total:   { bg: "#F8FAFC", text: "#0F172A", bar: "#0F172A", icon: DollarSign },
};

const ROLE_LABELS = {
  MANAGER_GLOBAL: "Manager Global",
  MANAGER_LOCAL:  "Manager Local",
  GUICHETIER:     "Guichetier",
  CHAUFFEUR:      "Chauffeur",
  ADMIN:          "Administrateur",
  VOYAGEUR:       "Voyageur",
};

const ROLE_STYLES = {
  MANAGER_LOCAL:  "bg-purple-100 text-purple-700",
  GUICHETIER:     "bg-blue-100 text-blue-700",
  CHAUFFEUR:      "bg-amber-100 text-amber-700",
  MANAGER_GLOBAL: "bg-red-100 text-red-700",
  ADMIN:          "bg-slate-100 text-slate-600",
};

const STATUT_CONFIG = {
  programme: { label: "Planifié",  color: "text-emerald-600", bg: "bg-emerald-50" },
  confirme:  { label: "Confirmé",  color: "text-blue-600",    bg: "bg-blue-50"    },
  en_cours:  { label: "En cours",  color: "text-indigo-600",  bg: "bg-indigo-50"  },
  termine:   { label: "Terminé",   color: "text-slate-500",   bg: "bg-slate-50"   },
  annule:    { label: "Annulé",    color: "text-red-600",     bg: "bg-red-50"     },
  retarde:   { label: "Retardé",   color: "text-amber-600",   bg: "bg-amber-50"   },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl text-xs border border-slate-700">
      <p className="font-bold mb-2 text-slate-300">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.color }} className="font-semibold">
          {p.name} : {formatMontant(p.value)}
        </p>
      ))}
    </div>
  );
};

function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, badge, badgePositive }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {badge != null && (
          <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${
            badgePositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}>
            {badgePositive
              ? <ArrowUpRight className="w-3 h-3" />
              : <ArrowDownRight className="w-3 h-3" />}
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900 leading-none">{value ?? "—"}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CanalPill({ icon: Icon, label, montant, pct, color }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl"
      style={{ backgroundColor: color.bg }}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: color.text }} />
        <span className="text-xs font-semibold" style={{ color: color.text }}>{label}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-extrabold" style={{ color: color.text }}>
          {formatMontant(montant)}
        </p>
        {pct != null && (
          <p className="text-[10px] opacity-70" style={{ color: color.text }}>{pct}%</p>
        )}
      </div>
    </div>
  );
}

function RecettesCard({ data, isLoading, titre = "Recettes" }) {
  const recetteTotale  = Number(data?.recetteTotale)  || 0;
  const recetteEnLigne = Number(data?.recetteEnLigne) || 0;
  const recetteGuichet = Number(data?.recetteGuichet) || 0;
  const nbEnLigne      = Number(data?.nbReservationsEnLigne)  || 0;
  const nbGuichet      = Number(data?.nbReservationsGuichet) || 0;
  const pctEnLigne     = Number(data?.partEnLignePct) || 0;
  const pctGuichet     = Number(data?.partGuichetPct) || 0;

  const pieData = [
    { name: "En ligne", value: recetteEnLigne, fill: CANAL_COLORS.enligne.bar },
    { name: "Guichet",  value: recetteGuichet, fill: CANAL_COLORS.guichet.bar },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-extrabold text-slate-900">{titre}</h3>
        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">XAF</span>
      </div>
      {isLoading ? (
        <Spinner size="md" className="py-10" />
      ) : (
        <>
          <div className="text-center mb-6">
            <p className="text-4xl font-black text-slate-900">{formatMontant(recetteTotale)}</p>
            <p className="text-xs text-slate-400 mt-1">
              {(nbEnLigne + nbGuichet).toLocaleString("fr")} réservations payées
            </p>
          </div>
          {recetteTotale > 0 && (
            <div className="mb-5">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%"
                    innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatMontant(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="space-y-2">
            <CanalPill
              icon={CANAL_COLORS.enligne.icon}
              label={`Mobile money — ${nbEnLigne} rés.`}
              montant={recetteEnLigne}
              pct={pctEnLigne}
              color={CANAL_COLORS.enligne}
            />
            <CanalPill
              icon={CANAL_COLORS.guichet.icon}
              label={`Espèces guichet — ${nbGuichet} rés.`}
              montant={recetteGuichet}
              pct={pctGuichet}
              color={CANAL_COLORS.guichet}
            />
          </div>
        </>
      )}
    </div>
  );
}

function FilialeCard({ filiale, recettes, onViewDetail, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const recetteTotale  = Number(recettes?.recetteTotale)  || 0;
  const recetteEnLigne = Number(recettes?.recetteEnLigne) || 0;
  const recetteGuichet = Number(recettes?.recetteGuichet) || 0;
  const pctEnLigne     = Number(recettes?.partEnLignePct) || 0;
  const pctGuichet     = Number(recettes?.partGuichetPct) || 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900">{filiale.nom}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-xs text-slate-500">{filiale.ville}</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
          filiale.est_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        }`}>
          {filiale.est_active ? "Actif" : "Inactif"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 pb-4 border-b border-slate-100 mb-4">
        {[
          { label: "Bus",      value: filiale.nb_bus },
          { label: "Employés", value: filiale.nb_employes },
          { label: "Voyages",  value: filiale.nb_voyages },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-lg font-bold text-slate-900">{value ?? "—"}</p>
            <p className="text-[10px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      {recettes && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-700 mb-2"
          >
            <span>Recettes — {formatCompact(recetteTotale)}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {expanded && (
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-blue-50">
                <span className="text-xs text-blue-700 flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3" /> En ligne
                </span>
                <span className="text-xs font-bold text-blue-700">
                  {formatMontant(recetteEnLigne)}
                  <span className="font-normal opacity-60 ml-1">({pctEnLigne}%)</span>
                </span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50">
                <span className="text-xs text-emerald-700 flex items-center gap-1.5">
                  <Banknote className="w-3 h-3" /> Guichet
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {formatMontant(recetteGuichet)}
                  <span className="font-normal opacity-60 ml-1">({pctGuichet}%)</span>
                </span>
              </div>
            </div>
          )}
        </>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onViewDetail(filiale)}
          className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 font-bold text-sm rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <Eye className="w-4 h-4" /> Détails
        </button>
        <button
          onClick={() => onEdit(filiale)}
          className="flex-1 px-3 py-2 bg-slate-100 text-slate-600 font-bold text-sm rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
        >
          <Edit2 className="w-4 h-4" /> Éditer
        </button>
      </div>
    </div>
  );
}

function EmployeCard({ employe, onEdit }) {
  const role = employe.role || "GUICHETIER";
  const roleLabel = ROLE_LABELS[role] || role;
  const roleStyle = ROLE_STYLES[role] || "bg-slate-100 text-slate-600";
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
        {employe.photo_profil ? (
          <img src={employe.photo_profil} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <span className="text-blue-600 font-bold text-sm">
            {(employe.name || employe.nom || "?")[0].toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm truncate">
          {employe.name || employe.nom} {employe.surname || employe.prenom || ""}
        </p>
        <p className="text-xs text-slate-500 truncate">{employe.email}</p>
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${roleStyle}`}>
          {roleLabel}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
          (employe.est_actif !== false && employe.est_disponible !== false)
            ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700"
        }`}>
          {(employe.est_actif !== false && employe.est_disponible !== false) ? "Actif" : "Inactif"}
        </span>
        <button
          onClick={() => onEdit(employe, role)}
          className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
        >
          <Edit2 className="w-3 h-3" /> Éditer
        </button>
      </div>
    </div>
  );
}

function FilialePersonnelBlock({ filiale, searchEmploye, onEdit }) {
  const [collapsed, setCollapsed] = useState(false);
  const filialeId = filiale.id || filiale.id_filiale;

  const { data: guichetiers = [] } = useQuery({
    queryKey: ["guichetiers-filiale", filialeId],
    queryFn: () => userService.listGuichetiersByFiliale(filialeId).catch(() => []),
    enabled: !!filialeId,
    staleTime: 3 * 60 * 1000,
  });
  const { data: chauffeurs = [] } = useQuery({
    queryKey: ["chauffeurs-filiale", filialeId],
    queryFn: () => userService.listChauffeursByFiliale(filialeId).catch(() => []),
    enabled: !!filialeId,
    staleTime: 3 * 60 * 1000,
  });

  const allEmployes = [
    ...guichetiers.map(e => ({ ...e, role: "GUICHETIER" })),
    ...chauffeurs.map(e => ({ ...e, role: "CHAUFFEUR" })),
  ];

  const filtered = allEmployes.filter(e =>
    `${e.name || e.nom || ""} ${e.surname || e.prenom || ""} ${e.email || ""}`
      .toLowerCase().includes(searchEmploye.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-bold text-slate-900 text-sm">{filiale.nom}</p>
            <p className="text-xs text-slate-500">
              {filiale.ville} — {allEmployes.length} employé{allEmployes.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {guichetiers.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {guichetiers.length} Guich.
              </span>
            )}
            {chauffeurs.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {chauffeurs.length} Chauf.
              </span>
            )}
          </div>
          {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </div>
      </button>
      {!collapsed && (
        <div className="p-4">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-6">
              {searchEmploye ? "Aucun résultat." : "Aucun employé dans cette filiale."}
            </p>
          ) : (
            <div className="space-y-4">
              {filtered.filter(e => e.role === "GUICHETIER").length > 0 && (
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">Guichetiers</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filtered.filter(e => e.role === "GUICHETIER").map((e, i) => (
                      <EmployeCard key={e.Id_guichetier || i} employe={e} onEdit={onEdit} />
                    ))}
                  </div>
                </div>
              )}
              {filtered.filter(e => e.role === "CHAUFFEUR").length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">Chauffeurs</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filtered.filter(e => e.role === "CHAUFFEUR").map((e, i) => (
                      <EmployeCard key={e.id_chauffeur || i} employe={e} onEdit={onEdit} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TrajetCard ───────────────────────────────────────────────────────────────
// Adapté au format du profil agence (id_trajet, filiale_depart, filiale_arrivee,
// ville_depart, ville_arrivee, distance_km)
function TrajetCard({ trajet, onDelete, isManagerGlobal }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Navigation className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-slate-900 text-sm">
            {trajet.filiale_depart} → {trajet.filiale_arrivee}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {trajet.ville_depart} → {trajet.ville_arrivee}
            {trajet.distance_km ? ` · ${trajet.distance_km} km` : ""}
          </p>
        </div>
      </div>
      {isManagerGlobal && (
        <button
          onClick={() => onDelete(trajet.id_trajet)}
          className="w-full px-2 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
        >
          Supprimer
        </button>
      )}
    </div>
  );
}

// ─── VoyageCard (pour le dashboard) ──────────────────────────────────────────
function VoyageCard({ voyage }) {
  const statut = voyage.status || "programme";
  const cfg    = STATUT_CONFIG[statut] || { label: statut, color: "text-slate-500", bg: "bg-slate-50" };
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="font-bold text-slate-900 text-sm">
          {voyage.filiale_depart} <ChevronRight className="inline w-3 h-3 text-slate-400" /> {voyage.filiale_arrivee}
        </p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          {voyage.date_heure_depart
            ? new Date(voyage.date_heure_depart).toLocaleDateString("fr-FR", {
                day: "2-digit", month: "short",
              })
            : "—"}
        </span>
        <span className="text-slate-300">·</span>
        <span>{voyage.prix ? `${Number(voyage.prix).toLocaleString("fr-FR")} FCFA` : "—"}</span>
        <span className="text-slate-300">·</span>
        <span>{voyage.places_disponibles ?? "—"} places</span>
      </div>
      {voyage.bus_immatriculation && (
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <Bus className="w-3 h-3" /> {voyage.bus_immatriculation}
        </p>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function ManagerDashboard() {
  const { user } = useAuthStore();
  const navigate  = useNavigate();

  const isManagerLocal  = user?.role === "MANAGER_LOCAL";
  const isManagerGlobal = user?.role === "MANAGER_GLOBAL";

  const agenceId  = user?.agenceId || user?.agence?.id;
  const filialeId = user?.filialeId || user?.filiale?.id;

  const [activeTab, setActiveTab]               = useState("apercu");
  const [searchFiliale, setSearchFiliale]       = useState("");
  const [showFilialeDetail, setShowFilialeDetail] = useState(false);
  const [selectedFiliale, setSelectedFiliale]   = useState(null);
  const [showAgenceSettings, setShowAgenceSettings] = useState(false);
  const [searchTrajet, setSearchTrajet]         = useState("");
  const [searchEmploye, setSearchEmploye]       = useState("");
  const [searchVoyage, setSearchVoyage]         = useState("");
  const [filtreStatutVoyage, setFiltreStatutVoyage] = useState("");

  // ── Agence ────────────────────────────────────────────────────────────────
  const { data: agenceDetail } = useQuery({
    queryKey: ["agence-detail", agenceId],
    queryFn: () => agenceService.getAgenceDetail(agenceId),
    enabled: !!agenceId,
    staleTime: 5 * 60 * 1000,
  });

  // ── PROFIL AGENCE — source unique de vérité pour trajets et voyages ───────
  const {
    data: profilAgence,
    isLoading: isLoadingProfil,
    refetch: refetchProfil,
  } = useQuery({
    queryKey: ["agence-profil-dashboard", agenceId],
    queryFn: () => fleetService.getAgenceProfilNormalise(agenceId),
    enabled: !!agenceId,
    staleTime: 2 * 60 * 1000,
  });

  // ── Extraction des trajets depuis le profil ───────────────────────────────
  const tousTrajets = profilAgence?.trajets ?? [];

  // Manager Local → trajets où sa filiale est départ ou arrivée
  const trajetsFiltresRole = isManagerLocal && (filialeId || user?.filialeNom)
    ? tousTrajets.filter(
        (t) =>
          t.filiale_depart === user?.filialeNom ||
          t.filiale_arrivee === user?.filialeNom
      )
    : tousTrajets;

  // ── Extraction des voyages depuis le profil ───────────────────────────────
  const tousVoyagesBruts = profilAgence?.voyages ?? [];

  // Manager Local → voyages dont la filiale de départ = sa filiale
  const voyagesFiltresRole = isManagerLocal && user?.filialeNom
    ? tousVoyagesBruts.filter((v) => v.filiale_depart === user?.filialeNom)
    : tousVoyagesBruts;

  // ── Filiales ──────────────────────────────────────────────────────────────
  const { data: filiales = [], isLoading: isLoadingFiliales } = useQuery({
    queryKey: ["filiales-dashboard", agenceId, isManagerLocal, filialeId],
    queryFn: async () => {
      if (isManagerLocal) {
        if (filialeId) {
          const f = await filialeService.getFilialeById(filialeId);
          return f ? [f] : [];
        }
        const all = await filialeService.getFiliales({ agence: agenceId });
        return all.filter(f => f.id_filiale === filialeId);
      }
      return filialeService.getFiliales({ agence: agenceId });
    },
    enabled: !!agenceId,
    staleTime: 2 * 60 * 1000,
  });

  // ── Personnel Manager Local ───────────────────────────────────────────────
  const { data: guichetiers = [] } = useQuery({
    queryKey: ["guichetiers-local", filialeId],
    queryFn: () => userService.listGuichetiersByFiliale(filialeId).catch(() => []),
    enabled: !!filialeId && isManagerLocal,
    staleTime: 3 * 60 * 1000,
  });

  const { data: chauffeurs = [] } = useQuery({
    queryKey: ["chauffeurs-local", filialeId],
    queryFn: () => userService.listChauffeursByFiliale(filialeId).catch(() => []),
    enabled: !!filialeId && isManagerLocal,
    staleTime: 3 * 60 * 1000,
  });

  const employesLocal = [
    ...guichetiers.map(g => ({ ...g, role: "GUICHETIER" })),
    ...chauffeurs.map(c => ({ ...c, role: "CHAUFFEUR" })),
  ];

  // ── Recettes ──────────────────────────────────────────────────────────────
  const {
    data: recettesAgence,
    isLoading: isLoadingRecettesAgence,
    refetch: refetchRecettesAgence,
  } = useQuery({
    queryKey: ["recettes-agence-dashboard", agenceId],
    queryFn: () => bookingService.getRecettesAgence(agenceId, "XAF"),
    enabled: !!agenceId && isManagerGlobal,
    staleTime: 3 * 60 * 1000,
  });

  const {
    data: recettesFiliale,
    isLoading: isLoadingRecettesFiliale,
    refetch: refetchRecettesFiliale,
  } = useQuery({
    queryKey: ["recettes-filiale-dashboard", filialeId],
    queryFn: () => bookingService.getRecettesFiliale(filialeId, "XAF"),
    enabled: !!filialeId && isManagerLocal,
    staleTime: 3 * 60 * 1000,
  });

  const recettes           = isManagerLocal ? recettesFiliale        : recettesAgence;
  const isLoadingRecettes  = isManagerLocal ? isLoadingRecettesFiliale : isLoadingRecettesAgence;
  const refetchRecettes    = isManagerLocal ? refetchRecettesFiliale  : refetchRecettesAgence;

  const { data: recettesFiliales = [] } = useQuery({
    queryKey: ["recettes-filiales-dashboard", filiales.map(f => f.id || f.id_filiale).join(",")],
    queryFn: async () => {
      const results = await Promise.allSettled(
        filiales.map(async (f) => {
          const idFiliale = f.id || f.id_filiale;
          if (!idFiliale) return null;
          try {
            const data = await bookingService.getRecettesFiliale(idFiliale, "XAF");
            return { idFiliale, data };
          } catch {
            return null;
          }
        })
      );
      return results.map((result, index) => {
        const filiale = filiales[index];
        const idFiliale = filiale?.id || filiale?.id_filiale;
        return {
          idFiliale,
          data: result.status === "fulfilled" && result.value?.data
            ? result.value.data
            : { recetteTotale: 0, recetteEnLigne: 0, recetteGuichet: 0,
                nbReservationsEnLigne: 0, nbReservationsGuichet: 0,
                partEnLignePct: 0, partGuichetPct: 0 },
        };
      });
    },
    enabled: filiales.length > 0 && isManagerGlobal,
    staleTime: 3 * 60 * 1000,
  });

  const getRecettesFiliale = (f) => {
    const idFiliale = f.id || f.id_filiale;
    if (!idFiliale) return null;
    return recettesFiliales.find(r => r.idFiliale === idFiliale)?.data || null;
  };

  // ── Filtres locaux ────────────────────────────────────────────────────────
  const filialesActives = filiales.filter(f => f.est_active).length;

  const filiaLesFiltrees = filiales.filter(f =>
    (f.nom?.toLowerCase() || "").includes(searchFiliale.toLowerCase()) ||
    (f.ville?.toLowerCase() || "").includes(searchFiliale.toLowerCase())
  );

  const trajetsFiltres = trajetsFiltresRole.filter(t =>
    `${t.filiale_depart || ""} ${t.filiale_arrivee || ""} ${t.ville_depart || ""} ${t.ville_arrivee || ""}`
      .toLowerCase().includes(searchTrajet.toLowerCase())
  );

  const voyagesFiltres = voyagesFiltresRole.filter(v => {
    const matchSearch = !searchVoyage ||
      `${v.filiale_depart || ""} ${v.filiale_arrivee || ""} ${v.bus_immatriculation || ""}`
        .toLowerCase().includes(searchVoyage.toLowerCase());
    const matchStatut = !filtreStatutVoyage || v.status === filtreStatutVoyage;
    return matchSearch && matchStatut;
  });

  const employesLocalFiltres = employesLocal.filter(e =>
    `${e.name || e.nom || ""} ${e.surname || e.prenom || ""} ${e.email || ""}`
      .toLowerCase().includes(searchEmploye.toLowerCase())
  );

  const graphDataFiliales = filiales.map(f => {
    const rec = getRecettesFiliale(f);
    return {
      nom: f.nom,
      enLigne: Number(rec?.recetteEnLigne) || 0,
      guichet: Number(rec?.recetteGuichet) || 0,
    };
  });

  const handleEditFiliale  = (f) => navigate(`/manager/filiales/${f.id_filiale}/editer`);
  const handleEditEmploye  = (employe, role) => {
    if (role === "GUICHETIER") navigate(`/manager/personnel/guichetiers/${employe.Id_guichetier || employe.id}/editer`);
    else if (role === "CHAUFFEUR") navigate(`/manager/chauffeurs/${employe.id_chauffeur || employe.id}/editer`);
    else navigate(`/manager/personnel/${employe.id}/editer`);
  };

  const kpiTotal       = Number(recettes?.recetteTotale)  || 0;
  const kpiEnLigne     = Number(recettes?.recetteEnLigne) || 0;
  const kpiGuichet     = Number(recettes?.recetteGuichet) || 0;
  const kpiNbEnLigne   = Number(recettes?.nbReservationsEnLigne)  || 0;
  const kpiNbGuichet   = Number(recettes?.nbReservationsGuichet) || 0;
  const kpiPctEnLigne  = Number(recettes?.partEnLignePct) || 0;
  const kpiPctGuichet  = Number(recettes?.partGuichetPct) || 0;

  const isLoading = isLoadingFiliales || isLoadingProfil;

  const tabs = [
    { id: "apercu",    label: "Aperçu",    icon: Activity   },
    ...(isManagerGlobal ? [{ id: "filiales", label: "Filiales", icon: Building2 }] : []),
    { id: "recettes",  label: "Recettes",  icon: TrendingUp },
    { id: "trajets",   label: "Trajets",   icon: Navigation },
    { id: "voyages",   label: "Voyages",   icon: Bus        },
    { id: "personnel", label: "Personnel", icon: Users      },
  ];

  return (
    <DashboardLayout>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {isManagerLocal
              ? `Filiale ${filiales[0]?.nom || ""}`
              : agenceDetail?.name || "Tableau de Bord Global"}
          </h1>
          <p className="text-slate-500 mt-1">
            {isManagerLocal
              ? `Gestion de votre filiale — ${filiales[0]?.ville || ""}`
              : "Gestion complète de l'agence et des filiales"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { refetchRecettes?.(); refetchProfil(); }}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          {isManagerGlobal && (
            <button
              onClick={() => setShowAgenceSettings(true)}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> Paramètres Agence
            </button>
          )}
          {isManagerLocal && (
            <button
              onClick={() => handleEditFiliale(filiales[0])}
              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              disabled={!filiales[0]}
            >
              <Edit2 className="w-4 h-4" /> Modifier ma filiale
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label={isManagerLocal ? "Recettes filiale" : "Recettes totales agence"}
          value={isLoadingRecettes ? "…" : formatMontant(kpiTotal)}
          sub={isLoadingRecettes ? null : `${kpiNbEnLigne + kpiNbGuichet} rés. payées`}
          icon={DollarSign}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <KpiCard
          label="En ligne (mobile money)"
          value={isLoadingRecettes ? "…" : formatMontant(kpiEnLigne)}
          sub={isLoadingRecettes ? null : `${kpiNbEnLigne} rés. — ${kpiPctEnLigne}%`}
          icon={Smartphone}
          iconBg="bg-sky-100"
          iconColor="text-sky-600"
        />
        <KpiCard
          label="Espèces guichet"
          value={isLoadingRecettes ? "…" : formatMontant(kpiGuichet)}
          sub={isLoadingRecettes ? null : `${kpiNbGuichet} rés. — ${kpiPctGuichet}%`}
          icon={Banknote}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <KpiCard
          label={isManagerLocal ? "Voyages / Trajets" : "Filiales actives / Trajets"}
          value={isManagerLocal
            ? `${voyagesFiltresRole.length} / ${trajetsFiltresRole.length}`
            : `${filialesActives} / ${trajetsFiltresRole.length}`}
          icon={isManagerLocal ? Bus : Building2}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-8 w-fit flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
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

      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : (
        <>
          {/* ══════════ APERÇU ══════════ */}
          {activeTab === "apercu" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {isManagerGlobal && (
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <h3 className="font-bold text-slate-900 mb-1">Recettes par filiale</h3>
                  <p className="text-xs text-slate-400 mb-5">Canal en ligne / guichet</p>
                  {graphDataFiliales.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-12">Aucune donnée</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={graphDataFiliales} barCategoryGap="28%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="nom" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="enLigne" name="En ligne" stackId="a" fill={CANAL_COLORS.enligne.bar} />
                        <Bar dataKey="guichet" name="Guichet"  stackId="a" fill={CANAL_COLORS.guichet.bar} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              <div className={isManagerLocal ? "lg:col-span-3" : ""}>
                <RecettesCard
                  data={recettes}
                  isLoading={isLoadingRecettes}
                  titre={isManagerLocal ? "Recettes de ma filiale" : "Recettes Agence"}
                />
              </div>

              {/* Voyages récents (aperçu) */}
              {voyagesFiltresRole.length > 0 && (
                <div className="lg:col-span-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900 text-sm">
                      Voyages récents
                      {isManagerLocal && (
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          — Filiale {user?.filialeNom}
                        </span>
                      )}
                    </h3>
                    <button
                      onClick={() => setActiveTab("voyages")}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Voir tout ({voyagesFiltresRole.length})
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {voyagesFiltresRole.slice(0, 6).map((v) => (
                      <VoyageCard key={v.id_voyage} voyage={v} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ FILIALES ══════════ */}
          {activeTab === "filiales" && isManagerGlobal && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Rechercher une filiale…"
                    value={searchFiliale} onChange={e => setSearchFiliale(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={() => navigate("/manager/filiales/nouvelle")}
                  className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nouvelle
                </button>
              </div>
              {filiaLesFiltrees.length === 0 ? (
                <p className="text-center py-12 text-slate-400">Aucune filiale trouvée.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filiaLesFiltrees.map(f => (
                    <FilialeCard
                      key={f.id_filiale}
                      filiale={f}
                      recettes={getRecettesFiliale(f)}
                      onViewDetail={fil => { setSelectedFiliale(fil); setShowFilialeDetail(true); }}
                      onEdit={handleEditFiliale}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════ RECETTES ══════════ */}
          {activeTab === "recettes" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl text-white p-6">
                  <DollarSign className="w-5 h-5 mb-3 opacity-80" />
                  <p className="text-3xl font-black">{formatMontant(kpiTotal)}</p>
                  <p className="text-blue-200 text-sm mt-1">
                    {isManagerLocal ? "Recettes filiale" : "Recettes totales agence"}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl text-white p-6">
                  <Smartphone className="w-5 h-5 mb-3 opacity-80" />
                  <p className="text-3xl font-black">{formatMontant(kpiEnLigne)}</p>
                  <p className="text-sky-100 text-sm mt-1">En ligne — mobile money</p>
                  <p className="text-sky-200 text-xs mt-1">{kpiPctEnLigne}% du total</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl text-white p-6">
                  <Banknote className="w-5 h-5 mb-3 opacity-80" />
                  <p className="text-3xl font-black">{formatMontant(kpiGuichet)}</p>
                  <p className="text-emerald-100 text-sm mt-1">Espèces guichet</p>
                  <p className="text-emerald-200 text-xs mt-1">{kpiPctGuichet}% du total</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">
                    {isManagerLocal ? "Détail recettes — ma filiale" : "Détail recettes par filiale"}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        {["Filiale", "Ville", "Recette totale", "En ligne", "Guichet", "Part WEB", "Rés. totales"].map(h => (
                          <th key={h} className={`px-5 py-3 text-xs font-bold text-slate-500 ${
                            ["Filiale", "Ville"].includes(h) ? "text-left" : "text-right"
                          }`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filiales.map(f => {
                        const rec = isManagerLocal ? recettesFiliale : getRecettesFiliale(f);
                        const tot     = Number(rec?.recetteTotale)  || 0;
                        const enLigne = Number(rec?.recetteEnLigne) || 0;
                        const guichet = Number(rec?.recetteGuichet) || 0;
                        const pct     = Number(rec?.partEnLignePct) || 0;
                        const nbTotal = (Number(rec?.nbReservationsEnLigne) || 0) + (Number(rec?.nbReservationsGuichet) || 0);
                        return (
                          <tr key={f.id_filiale}
                            className="border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => { setSelectedFiliale(f); setShowFilialeDetail(true); }}>
                            <td className="px-5 py-3 font-medium text-slate-900">{f.nom}</td>
                            <td className="px-5 py-3 text-slate-500 text-sm">{f.ville}</td>
                            <td className="px-5 py-3 text-right font-extrabold text-slate-900">{formatMontant(tot)}</td>
                            <td className="px-5 py-3 text-right"><span className="text-blue-700 font-bold text-sm">{formatMontant(enLigne)}</span></td>
                            <td className="px-5 py-3 text-right"><span className="text-emerald-700 font-bold text-sm">{formatMontant(guichet)}</span></td>
                            <td className="px-5 py-3 text-right">
                              <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                <Smartphone className="w-3 h-3" /> {pct}%
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right text-slate-500 text-sm">{nbTotal.toLocaleString("fr")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TRAJETS — depuis le profil agence ══════════ */}
          {activeTab === "trajets" && (
            <div className="space-y-6">
              {/* Bandeau info périmètre */}
              {isManagerLocal && (
                <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  Trajets impliquant la filiale <strong>{user?.filialeNom}</strong> uniquement.
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Rechercher un trajet…"
                    value={searchTrajet} onChange={e => setSearchTrajet(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {isManagerGlobal && (
                  <button onClick={() => navigate("/manager/trajets")}
                    className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Gérer les trajets
                  </button>
                )}
              </div>

              <div className="mb-2 text-xs text-slate-400">
                {trajetsFiltres.length} trajet(s) — source : profil agence
              </div>

              {trajetsFiltres.length === 0 ? (
                <p className="text-center py-12 text-slate-400">Aucun trajet trouvé.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trajetsFiltres.map(t => (
                    <TrajetCard
                      key={t.id_trajet}
                      trajet={t}
                      isManagerGlobal={isManagerGlobal}
                      onDelete={(id) => {
                        if (confirm("Supprimer ce trajet ?")) {
                          fleetService.supprimerTrajet(id)
                            .then(() => refetchProfil())
                            .catch(console.error);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════ VOYAGES — depuis le profil agence ══════════ */}
          {activeTab === "voyages" && (
            <div className="space-y-6">
              {/* Bandeau info périmètre */}
              {isManagerLocal && (
                <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                  <Bus className="w-3.5 h-3.5 flex-shrink-0" />
                  Voyages au départ de la filiale <strong>{user?.filialeNom}</strong> uniquement.
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Filiale, bus…"
                    value={searchVoyage} onChange={e => setSearchVoyage(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <select value={filtreStatutVoyage} onChange={e => setFiltreStatutVoyage(e.target.value)}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Tous les statuts</option>
                  {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button onClick={() => navigate("/manager/voyages")}
                  className="px-4 py-2.5 bg-[#135bec] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Gérer les voyages
                </button>
              </div>

              <div className="mb-2 text-xs text-slate-400">
                {voyagesFiltres.length} voyage(s) affiché(s) sur {voyagesFiltresRole.length}
              </div>

              {/* KPIs voyages */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total",     value: voyagesFiltresRole.length,                                          bg: "bg-slate-50",   color: "text-slate-900"   },
                  { label: "Planifiés", value: voyagesFiltresRole.filter(v => v.status === "programme").length,   bg: "bg-emerald-50", color: "text-emerald-600" },
                  { label: "En cours",  value: voyagesFiltresRole.filter(v => v.status === "en_cours").length,    bg: "bg-blue-50",    color: "text-blue-600"    },
                  { label: "Terminés",  value: voyagesFiltresRole.filter(v => v.status === "termine").length,     bg: "bg-slate-50",   color: "text-slate-500"   },
                ].map(({ label, value, bg, color }) => (
                  <div key={label} className={`${bg} rounded-xl p-3`}>
                    <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {voyagesFiltres.length === 0 ? (
                <p className="text-center py-12 text-slate-400">Aucun voyage trouvé.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {voyagesFiltres.map(v => (
                    <VoyageCard key={v.id_voyage} voyage={v} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════ PERSONNEL ══════════ */}
          {activeTab === "personnel" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Rechercher un employé…"
                    value={searchEmploye} onChange={e => setSearchEmploye(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={() => navigate("/manager/personnel/nouveau")}
                  className="px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nouveau
                </button>
              </div>

              {isManagerGlobal && (
                <div className="space-y-4">
                  {filiales.length === 0 ? (
                    <p className="text-center py-12 text-slate-400">Aucune filiale.</p>
                  ) : (
                    filiales.map(f => (
                      <FilialePersonnelBlock
                        key={f.id_filiale || f.id}
                        filiale={f}
                        searchEmploye={searchEmploye}
                        onEdit={handleEditEmploye}
                      />
                    ))
                  )}
                </div>
              )}

              {isManagerLocal && (
                <div className="space-y-4">
                  {employesLocalFiltres.filter(e => e.role === "GUICHETIER").length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        Guichetiers ({employesLocalFiltres.filter(e => e.role === "GUICHETIER").length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {employesLocalFiltres.filter(e => e.role === "GUICHETIER").map((e, i) => (
                          <EmployeCard key={e.Id_guichetier || i} employe={e} onEdit={handleEditEmploye} />
                        ))}
                      </div>
                    </div>
                  )}
                  {employesLocalFiltres.filter(e => e.role === "CHAUFFEUR").length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        Chauffeurs ({employesLocalFiltres.filter(e => e.role === "CHAUFFEUR").length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {employesLocalFiltres.filter(e => e.role === "CHAUFFEUR").map((e, i) => (
                          <EmployeCard key={e.id_chauffeur || i} employe={e} onEdit={handleEditEmploye} />
                        ))}
                      </div>
                    </div>
                  )}
                  {employesLocalFiltres.length === 0 && (
                    <p className="text-center py-12 text-slate-400">
                      {searchEmploye ? "Aucun résultat." : "Aucun employé dans votre filiale."}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showFilialeDetail && selectedFiliale && (
        <FilialeDetailModal
          filiale={selectedFiliale}
          readOnly={isManagerLocal}
          onClose={() => { setShowFilialeDetail(false); setSelectedFiliale(null); }}
        />
      )}
      {showAgenceSettings && isManagerGlobal && (
        <AgenceSettingsModal
          agenceId={agenceId}
          agence={agenceDetail}
          onClose={() => setShowAgenceSettings(false)}
        />
      )}
    </DashboardLayout>
  );
}