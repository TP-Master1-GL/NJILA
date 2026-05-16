/**
 * FilialeDetailModal.jsx
 * 
 * Affiche les détails complets d'une filiale :
 * - Personnel (Manager Local, chauffeurs, guichetiers) avec rôle précisé
 * - Voyages en cours et historique
 * - Statistiques détaillées avec recettes (utilisant les IDs UUID)
 * 
 * ✅ Utilisation des IDs (UUID) pour les recettes
 * ✅ Affichage du Manager Local en premier
 * ✅ Rôles précis pour chaque employé
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, Users, Bus, Calendar, TrendingUp, 
  Briefcase, Phone, Mail, MapPin, CheckCircle, AlertCircle,
  Download, DollarSign, Smartphone, Banknote, RefreshCw,
  UserCog, UserCheck, User,
} from "lucide-react";
import { userService } from "../../services/userService";
import { fleetService } from "../../services/fleetService";
import { bookingService } from "../../services/bookingService";
import { formatMontant } from "../../utils/formatters";
import Spinner from "../../components/ui/Spinner";

// ─── Couleurs par rôle ──────────────────────────────────────────────────────
const ROLE_COLORS = {
  MANAGER_GLOBAL: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", icon: UserCog },
  MANAGER_LOCAL:  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200", icon: UserCog },
  GUICHETIER:     { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", icon: UserCheck },
  CHAUFFEUR:      { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", icon: Bus },
  ADMIN:          { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", icon: UserCog },
  VOYAGEUR:       { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", icon: User },
};

const ROLE_LABELS = {
  MANAGER_GLOBAL: "Manager Global",
  MANAGER_LOCAL:  "Manager Local",
  GUICHETIER:     "Guichetier",
  CHAUFFEUR:      "Chauffeur",
  ADMIN:          "Administrateur",
  VOYAGEUR:       "Voyageur",
};

const STATUT_COLORS = {
  programme: "bg-amber-100 text-amber-700 border border-amber-200",
  confirme: "bg-blue-100 text-blue-700 border border-blue-200",
  en_cours: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  termine: "bg-gray-100 text-gray-700 border border-gray-200",
  annule: "bg-red-100 text-red-700 border border-red-200",
  retarde: "bg-orange-100 text-orange-700 border border-orange-200",
};

// ── Employee Card avec rôle ─────────────────────────────────────────────────
function EmployeeCard({ employee }) {
  // Déterminer le rôle
  const role = employee.role || employee.type || "GUICHETIER";
  const roleLabel = ROLE_LABELS[role] || role;
  const colors = ROLE_COLORS[role] || ROLE_COLORS.GUICHETIER;
  const Icon = colors.icon;
  
  const nomComplet = `${employee.name || employee.nom || ""} ${employee.surname || employee.prenom || ""}`.trim() || "—";
  const initiales = nomComplet !== "—" 
    ? `${(employee.name || employee.nom || "?")[0]}${(employee.surname || employee.prenom || "?")[0]}`.toUpperCase()
    : "?";

  // Déterminer le statut actif
  const estActif = 
    role === "CHAUFFEUR" 
      ? employee.est_disponible !== false
      : employee.est_actif !== false;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar avec couleur selon rôle */}
        <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm truncate">
            {nomComplet}
          </p>
          {/* Badge rôle */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${colors.bg} ${colors.text}`}>
            <Icon className="w-2.5 h-2.5" />
            {roleLabel}
          </span>
        </div>
        
        {/* Indicateur de statut */}
        <div className={`w-2 h-2 rounded-full ${estActif ? "bg-emerald-500" : "bg-slate-300"}`} />
      </div>

      {/* Infos de contact */}
      <div className="space-y-1.5 mb-3 pb-3 border-b border-slate-100">
        {employee.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <a href={`mailto:${employee.email}`} className="text-xs text-blue-600 hover:underline truncate">
              {employee.email}
            </a>
          </div>
        )}
        {employee.telephone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <a href={`tel:${employee.telephone}`} className="text-xs text-slate-600 hover:text-blue-600 truncate">
              {employee.telephone}
            </a>
          </div>
        )}
        {role === "CHAUFFEUR" && employee.numero_permis && (
          <div className="flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-500">Permis: {employee.numero_permis}</p>
          </div>
        )}
        {role === "GUICHETIER" && employee.code_guichetier && (
          <div className="flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-500">Code: {employee.code_guichetier}</p>
          </div>
        )}
      </div>

      {/* Statut actif/inactif */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${estActif ? "bg-emerald-500" : "bg-slate-300"}`} />
        <span className="text-xs font-medium text-slate-500">
          {estActif ? "Actif" : "Inactif"}
        </span>
      </div>
    </div>
  );
}

// ── Voyage Card ──
function VoyageCard({ voyage }) {
  const statut = voyage.status || voyage.statut || "programme";
  const cfg = STATUT_COLORS[statut] || "bg-slate-100 text-slate-700 border border-slate-200";

  const heureDepart = voyage.date_heure_depart
    ? new Date(voyage.date_heure_depart).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const dateDepart = voyage.date_heure_depart
    ? new Date(voyage.date_heure_depart).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{voyage.trajet_info || "Trajet"}</p>
          <p className="text-xs text-slate-500 mt-0.5">{dateDepart} à {heureDepart}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg}`}>
          {statut === "en_cours" ? "En cours" : statut === "termine" ? "Terminé" : statut}
        </span>
      </div>

      {/* Détails */}
      <div className="space-y-1.5 mb-3 pb-3 border-b border-slate-100 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Bus:</span>
          <span className="font-medium text-slate-900">{voyage.bus_immatriculation || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Places disponibles:</span>
          <span className={`font-medium ${(voyage.places_disponibles || 0) < 10 ? "text-orange-600" : "text-slate-900"}`}>
            {voyage.places_disponibles ?? "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Prix:</span>
          <span className="font-bold text-emerald-600">{formatMontant(voyage.prix || 0)}</span>
        </div>
      </div>

      {/* Chauffeur */}
      {voyage.chauffeur_nom && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
          <Bus className="w-3 h-3 text-slate-400" />
          <span className="text-slate-600">Chauffeur: {voyage.chauffeur_nom}</span>
        </div>
      )}
    </div>
  );
}

// ── Groupe d'employés par rôle ──
function EmployeeGroup({ title, employees, icon: Icon, color }) {
  if (employees.length === 0) return null;
  
  return (
    <div>
      <h4 className={`font-bold text-slate-900 mb-3 flex items-center gap-2 ${color}`}>
        <Icon className="w-4 h-4" />
        {title} ({employees.length})
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees.map((emp, idx) => (
          <EmployeeCard key={emp.id_chauffeur || emp.Id_guichetier || emp.id || idx} employee={emp} />
        ))}
      </div>
    </div>
  );
}

export default function FilialeDetailModal({ filiale, onClose }) {
  const [activeTab, setActiveTab] = useState("personnel");

  // ✅ Récupérer le Manager Local de la filiale
  const { data: managerLocal = null, isLoading: isLoadingManager } = useQuery({
    queryKey: ["manager-local-filiale", filiale.id_filiale],
    queryFn: async () => {
      try {
        const employes = await userService.listEmployesByFiliale(filiale.id_filiale);
        // Chercher le manager local dans les employés
        const manager = (employes || []).find(e => e.role === "MANAGER_LOCAL" || e.type === "manager");
        return manager ? { ...manager, role: "MANAGER_LOCAL" } : null;
      } catch {
        return null;
      }
    },
    enabled: !!filiale.id_filiale,
    staleTime: 5 * 60 * 1000,
  });

  // ── Récupérer personnel filiale ──
  const { data: employes = [], isLoading: isLoadingEmployes } = useQuery({
    queryKey: ["employes-filiale", filiale.id_filiale],
    queryFn: () => userService.listEmployesByFiliale(filiale.id_filiale),
    staleTime: 5 * 60 * 1000,
  });

  // ── Récupérer voyages filiale ──
  const { data: voyages = [], isLoading: isLoadingVoyages } = useQuery({
    queryKey: ["voyages-filiale", filiale.id_filiale],
    queryFn: () => 
      fleetService.getVoyages({ filiale: filiale.id_filiale })
        .then(v => v || [])
        .catch(() => []),
    staleTime: 2 * 60 * 1000,
  });

  // ✅ Récupérer les recettes de la filiale AVEC ID (UUID)
  const { 
    data: recettes, 
    isLoading: isLoadingRecettes,
    refetch: refetchRecettes
  } = useQuery({
    queryKey: ["recettes-filiale-detail", filiale.id_filiale],
    queryFn: () => {
      if (!filiale.id_filiale) return Promise.resolve(null);
      // ✅ Utiliser l'ID UUID de la filiale, pas le code
      return bookingService.getRecettesFiliale(filiale.id_filiale, "XAF");
    },
    enabled: !!filiale.id_filiale,
    staleTime: 3 * 60 * 1000,
  });

  // ── Récupérer les stats de la filiale ──
  const { 
    data: stats, 
    isLoading: isLoadingStats 
  } = useQuery({
    queryKey: ["stats-filiale-detail", filiale.id_filiale],
    queryFn: () => {
      if (!filiale.id_filiale) return Promise.resolve(null);
      return bookingService.getStatsFiliale?.(filiale.id_filiale) || Promise.resolve(null);
    },
    enabled: !!filiale.id_filiale,
    staleTime: 5 * 60 * 1000,
  });

  // Valeurs protégées
  const recetteTotale = Number(recettes?.recetteTotale) || 0;
  const recetteEnLigne = Number(recettes?.recetteEnLigne) || 0;
  const recetteGuichet = Number(recettes?.recetteGuichet) || 0;
  const nbEnLigne = Number(recettes?.nbReservationsEnLigne) || 0;
  const nbGuichet = Number(recettes?.nbReservationsGuichet) || 0;
  const pctEnLigne = Number(recettes?.partEnLignePct) || 0;
  const pctGuichet = Number(recettes?.partGuichetPct) || 0;
  
  const tauxConversion = Number(stats?.tauxConversion) || 0;
  const reservationsConfirmees = Number(stats?.reservationsConfirmees) || 0;
  const reservationsTotal = Number(stats?.totalReservations) || 0;

  // ── Regroupement des employés par rôle ──
  const managers = [
    ...(managerLocal ? [managerLocal] : []),
    ...employes.filter(e => 
      e.role === "MANAGER_GLOBAL" || e.type === "manager"
    ),
  ];
  
  const chauffeurs = employes.filter(e => 
    e.role === "CHAUFFEUR" || e.type === "chauffeur"
  );
  
  const guichetiers = employes.filter(e => 
    e.role === "GUICHETIER" || e.type === "guichetier"
  );
  
  const autres = employes.filter(e => 
    e.role !== "MANAGER_GLOBAL" && e.role !== "MANAGER_LOCAL" && 
    e.role !== "CHAUFFEUR" && e.role !== "GUICHETIER" &&
    e.type !== "chauffeur" && e.type !== "guichetier" && e.type !== "manager"
  );

  const voyagesEnCours = voyages.filter(v => v.status === "en_cours");
  const voyagesTermines = voyages.filter(v => v.status === "termine");

  const isLoading = isLoadingEmployes || isLoadingVoyages || isLoadingManager;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* ── Header ── */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{filiale.nom}</h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1 text-sm text-slate-600">
                <MapPin className="w-4 h-4" />
                {filiale.ville}
              </div>
              {filiale.code && (
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                    {filiale.code}
                  </span>
                </div>
              )}
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                filiale.est_active
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}>
                {filiale.est_active ? "Actif" : "Inactif"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* ── Stats rapides ── */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          {[
            { label: "Bus", value: filiale.nb_bus || 0, icon: Bus },
            { label: "Employés", value: employes.length, icon: Users },
            { label: "Voyages", value: voyages.length, icon: Calendar },
            { label: "Recettes", value: formatMontant(recetteTotale), icon: TrendingUp, highlight: true },
          ].map(({ label, value, icon: Icon, highlight }) => (
            <div 
              key={label} 
              className={`rounded-lg p-3 text-center transition-all ${
                highlight 
                  ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md" 
                  : "bg-white"
              }`}
            >
              <div className={`flex justify-center mb-2 ${highlight ? "" : "text-blue-600"}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className={`text-sm font-bold ${highlight ? "text-white" : "text-slate-900"}`}>
                {value}
              </p>
              <p className={`text-xs ${highlight ? "text-blue-200" : "text-slate-500"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Détails recettes ── */}
        {(recetteTotale > 0 || !isLoadingRecettes) && (
          <div className="px-6 py-4 border-b border-slate-100 bg-white flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900">Recettes détaillées</h3>
              <button 
                onClick={() => refetchRecettes()}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Actualiser
              </button>
            </div>
            
            {isLoadingRecettes ? (
              <Spinner size="sm" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Smartphone className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-blue-800">En ligne (Mobile Money)</span>
                  </div>
                  <p className="text-2xl font-black text-blue-700">{formatMontant(recetteEnLigne)}</p>
                  <div className="flex justify-between text-xs text-blue-600 mt-2">
                    <span>{nbEnLigne} réservations</span>
                    <span className="font-bold">{pctEnLigne}% du total</span>
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <span className="font-bold text-emerald-800">Guichet (Espèces)</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-700">{formatMontant(recetteGuichet)}</p>
                  <div className="flex justify-between text-xs text-emerald-600 mt-2">
                    <span>{nbGuichet} réservations</span>
                    <span className="font-bold">{pctGuichet}% du total</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 px-6 pt-4 border-b border-slate-100 overflow-x-auto flex-shrink-0">
          {[
            { id: "personnel", label: "Personnel", icon: Users, count: employes.length },
            { id: "voyages", label: "Voyages", icon: Calendar, count: voyages.length },
            { id: "statistiques", label: "Statistiques", icon: TrendingUp },
            { id: "infos", label: "Infos", icon: Briefcase },
          ].map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                activeTab === id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count !== undefined && count > 0 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Contenu ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <Spinner size="md" className="py-12" />
          ) : (
            <>
              {/* PERSONNEL avec rôles */}
              {activeTab === "personnel" && (
                <div className="space-y-6">
                  {/* Manager Local en première position */}
                  {managerLocal && (
                    <EmployeeGroup 
                      title="Manager Local" 
                      employees={[managerLocal]} 
                      icon={UserCog}
                      color="text-indigo-600"
                    />
                  )}

                  {/* Autres managers */}
                  {managers.filter(e => e.role !== "MANAGER_LOCAL").length > 0 && (
                    <EmployeeGroup 
                      title="Managers" 
                      employees={managers.filter(e => e.role !== "MANAGER_LOCAL")} 
                      icon={UserCog}
                      color="text-purple-600"
                    />
                  )}

                  {/* Chauffeurs */}
                  <EmployeeGroup 
                    title="Chauffeurs" 
                    employees={chauffeurs} 
                    icon={Bus}
                    color="text-amber-600"
                  />

                  {/* Guichetiers */}
                  <EmployeeGroup 
                    title="Guichetiers" 
                    employees={guichetiers} 
                    icon={UserCheck}
                    color="text-blue-600"
                  />

                  {/* Autres employés */}
                  <EmployeeGroup 
                    title="Autres employés" 
                    employees={autres} 
                    icon={User}
                    color="text-slate-600"
                  />

                  {employes.length === 0 && !managerLocal && (
                    <div className="text-center py-8 text-slate-400">
                      Aucun employé pour cette filiale.
                    </div>
                  )}
                </div>
              )}

              {/* VOYAGES */}
              {activeTab === "voyages" && (
                <div className="space-y-6">
                  {voyagesEnCours.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        Voyages en cours ({voyagesEnCours.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {voyagesEnCours.map(v => (
                          <VoyageCard key={v.Id_voyage || v.id} voyage={v} />
                        ))}
                      </div>
                    </div>
                  )}

                  {voyagesTermines.length > 0 && (
                    <div>
                      <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        Historique ({voyagesTermines.length} voyages)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {voyagesTermines.slice(0, 4).map(v => (
                          <VoyageCard key={v.Id_voyage || v.id} voyage={v} />
                        ))}
                      </div>
                      {voyagesTermines.length > 4 && (
                        <p className="text-center text-xs text-slate-400 mt-4">
                          +{voyagesTermines.length - 4} autres voyages terminés
                        </p>
                      )}
                    </div>
                  )}

                  {voyages.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      Aucun voyage trouvé pour cette filiale.
                    </div>
                  )}
                </div>
              )}

              {/* STATISTIQUES */}
              {activeTab === "statistiques" && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6">
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      Performance commerciale
                    </h4>
                    {isLoadingStats ? (
                      <Spinner size="sm" />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-3xl font-black text-indigo-700">{tauxConversion}%</p>
                          <p className="text-xs text-slate-500 mt-1">Taux de conversion</p>
                          <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(tauxConversion, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black text-emerald-700">{reservationsConfirmees}</p>
                          <p className="text-xs text-slate-500 mt-1">Réservations confirmées</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black text-slate-700">{reservationsTotal}</p>
                          <p className="text-xs text-slate-500 mt-1">Réservations totales</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      Synthèse financière
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                        <span className="text-sm font-medium text-slate-600">Recette totale</span>
                        <span className="text-xl font-black text-slate-900">{formatMontant(recetteTotale)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl">
                        <span className="text-sm font-medium text-blue-700 flex items-center gap-2">
                          <Smartphone className="w-4 h-4" /> En ligne
                        </span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-blue-700">{formatMontant(recetteEnLigne)}</span>
                          <span className="text-xs text-blue-500 ml-2">({pctEnLigne}%)</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl">
                        <span className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                          <Banknote className="w-4 h-4" /> Guichet
                        </span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-emerald-700">{formatMontant(recetteGuichet)}</span>
                          <span className="text-xs text-emerald-500 ml-2">({pctGuichet}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* INFOS */}
              {activeTab === "infos" && (
                <div className="space-y-4">
                  {[
                    { label: "Code", value: filiale.code },
                    { label: "Adresse", value: filiale.adresse },
                    { label: "Téléphone", value: filiale.telephone, href: `tel:${filiale.telephone}` },
                    { label: "Email", value: filiale.email, href: `mailto:${filiale.email}` },
                    { label: "Ville", value: filiale.ville },
                    { label: "Statut", value: filiale.est_active ? "Active" : "Inactive" },
                    { label: "Date de création", value: filiale.created_at ? new Date(filiale.created_at).toLocaleDateString("fr-FR") : "—" },
                  ].map(({ label, value, href }) => (
                    <div key={label} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <span className="text-sm font-medium text-slate-600">{label}</span>
                      {href && value ? (
                        <a href={href} className="text-sm font-bold text-blue-600 hover:underline">
                          {value}
                        </a>
                      ) : (
                        <span className="text-sm font-bold text-slate-900">{value || "—"}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 text-slate-900 font-bold rounded-lg hover:bg-slate-300 transition-colors"
          >
            Fermer
          </button>
          <button
            onClick={() => refetchRecettes?.()}
            className="px-6 py-2 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exporter
          </button>
        </div>
      </div>
    </div>
  );
}
