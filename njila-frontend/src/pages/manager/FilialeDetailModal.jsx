/**
 * FilialeDetailModal.jsx
 *
 * CORRECTIONS :
 * 1. Voyages récupérés via le profil agence (filiale.agence ou agenceId du store)
 *    plutôt que via fleetService.getVoyages({ filiale }) qui retournait toutes les agences.
 * 2. Scroll corrigé : la modal utilise overflow-y-auto sur la zone de contenu uniquement,
 *    avec une hauteur max correctement définie.
 * 3. Hauteur du modal adaptée pour mobile et desktop.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, Users, Bus, Calendar, TrendingUp,
  Briefcase, Phone, Mail, MapPin, CheckCircle, AlertCircle,
  Download, DollarSign, Smartphone, Banknote, RefreshCw,
  UserCog, UserCheck, User, ChevronRight,
} from "lucide-react";
import { userService } from "../../services/userService";
import { fleetService } from "../../services/fleetService";
import { bookingService } from "../../services/bookingService";
import { formatMontant } from "../../utils/formatters";
import { useAuthStore } from "../../store/authStore";
import Spinner from "../../components/ui/Spinner";

// ─── Couleurs par rôle ────────────────────────────────────────────────────────
const ROLE_COLORS = {
  MANAGER_GLOBAL: { bg: "bg-purple-100", text: "text-purple-700", icon: UserCog    },
  MANAGER_LOCAL:  { bg: "bg-indigo-100", text: "text-indigo-700", icon: UserCog    },
  GUICHETIER:     { bg: "bg-blue-100",   text: "text-blue-700",   icon: UserCheck  },
  CHAUFFEUR:      { bg: "bg-amber-100",  text: "text-amber-700",  icon: Bus        },
  ADMIN:          { bg: "bg-red-100",    text: "text-red-700",    icon: UserCog    },
  VOYAGEUR:       { bg: "bg-slate-100",  text: "text-slate-600",  icon: User       },
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
  confirme:  "bg-blue-100 text-blue-700 border border-blue-200",
  en_cours:  "bg-emerald-100 text-emerald-700 border border-emerald-200",
  termine:   "bg-gray-100 text-gray-700 border border-gray-200",
  annule:    "bg-red-100 text-red-700 border border-red-200",
  retarde:   "bg-orange-100 text-orange-700 border border-orange-200",
};

const STATUT_LABELS = {
  programme: "Planifié",
  confirme:  "Confirmé",
  en_cours:  "En cours",
  termine:   "Terminé",
  annule:    "Annulé",
  retarde:   "Retardé",
};

// ── Employee Card ─────────────────────────────────────────────────────────────
function EmployeeCard({ employee }) {
  const role      = employee.role || employee.type || "GUICHETIER";
  const roleLabel = ROLE_LABELS[role] || role;
  const colors    = ROLE_COLORS[role] || ROLE_COLORS.GUICHETIER;
  const Icon      = colors.icon;

  const nomComplet = `${employee.name || employee.nom || ""} ${employee.surname || employee.prenom || ""}`.trim() || "—";
  const estActif   = role === "CHAUFFEUR"
    ? employee.est_disponible !== false
    : employee.est_actif !== false;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm truncate">{nomComplet}</p>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${colors.bg} ${colors.text}`}>
            <Icon className="w-2.5 h-2.5" />
            {roleLabel}
          </span>
        </div>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${estActif ? "bg-emerald-500" : "bg-slate-300"}`} />
      </div>

      <div className="space-y-1.5 pb-3 border-b border-slate-100">
        {employee.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <a href={`mailto:${employee.email}`} className="text-xs text-blue-600 hover:underline truncate">
              {employee.email}
            </a>
          </div>
        )}
        {(employee.telephone || employee.phone) && (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <a href={`tel:${employee.telephone || employee.phone}`} className="text-xs text-slate-600 truncate">
              {employee.telephone || employee.phone}
            </a>
          </div>
        )}
        {role === "CHAUFFEUR" && employee.numero_permis && (
          <div className="flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-500">Permis: {employee.numero_permis}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <div className={`w-2 h-2 rounded-full ${estActif ? "bg-emerald-500" : "bg-slate-300"}`} />
        <span className="text-xs font-medium text-slate-500">{estActif ? "Actif" : "Inactif"}</span>
      </div>
    </div>
  );
}

// ── Groupe d'employés ─────────────────────────────────────────────────────────
function EmployeeGroup({ title, employees, icon: Icon, color }) {
  if (!employees || employees.length === 0) return null;
  return (
    <div>
      <h4 className={`font-bold mb-3 flex items-center gap-2 text-sm ${color}`}>
        <Icon className="w-4 h-4" />
        {title} ({employees.length})
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {employees.map((emp, idx) => (
          <EmployeeCard
            key={emp.id_chauffeur || emp.Id_guichetier || emp.id || idx}
            employee={emp}
          />
        ))}
      </div>
    </div>
  );
}

// ── Voyage Card ───────────────────────────────────────────────────────────────
function VoyageCard({ voyage }) {
  const statut = voyage.status || voyage.statut || "programme";
  const cfg    = STATUT_COLORS[statut] || "bg-slate-100 text-slate-700 border border-slate-200";
  const label  = STATUT_LABELS[statut] || statut;

  const dateDepart = voyage.date_heure_depart
    ? new Date(voyage.date_heure_depart).toLocaleDateString("fr-FR", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "—";
  const heureDepart = voyage.date_heure_depart
    ? new Date(voyage.date_heure_depart).toLocaleTimeString("fr-FR", {
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

  // Support des deux structures : profil agence et structure normalisée
  const trajetInfo = voyage.trajet_info
    || (voyage.filiale_depart && voyage.filiale_arrivee
        ? `${voyage.filiale_depart} → ${voyage.filiale_arrivee}`
        : voyage.origine && voyage.destination
        ? `${voyage.origine} → ${voyage.destination}`
        : "Trajet");

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{trajetInfo}</p>
          <p className="text-xs text-slate-500 mt-0.5">{dateDepart} à {heureDepart}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ml-2 ${cfg}`}>
          {label}
        </span>
      </div>
      <div className="space-y-1.5 pb-3 border-b border-slate-100 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">Bus :</span>
          <span className="font-medium text-slate-900">
            {voyage.bus_immatriculation || voyage.bus_modele || "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Places dispo :</span>
          <span className={`font-medium ${(voyage.places_disponibles || 0) < 10 ? "text-orange-600" : "text-slate-900"}`}>
            {voyage.places_disponibles ?? "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Prix :</span>
          <span className="font-bold text-emerald-600">
            {formatMontant(Number(voyage.prix) || 0)}
          </span>
        </div>
      </div>
      {voyage.chauffeur_nom && (
        <div className="flex items-center gap-2 mt-3 px-2 py-1.5 bg-slate-50 rounded-lg text-xs">
          <Bus className="w-3 h-3 text-slate-400" />
          <span className="text-slate-600">Chauffeur : {voyage.chauffeur_nom}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function FilialeDetailModal({ filiale, onClose }) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("personnel");

  // agenceId résolu depuis la filiale elle-même ou depuis le store
  const agenceId = filiale.agence || filiale.agence_id || user?.agenceId;
  const filialeId = filiale.id_filiale || filiale.id;

  // ── Personnel : guichetiers ───────────────────────────────────────────────
  const { data: guichetiers = [], isLoading: isLoadingGuich } = useQuery({
    queryKey: ["guichetiers-filiale-modal", filialeId],
    queryFn: () => userService.listGuichetiersByFiliale(filialeId).catch(() => []),
    enabled: !!filialeId,
    staleTime: 3 * 60 * 1000,
  });

  // ── Personnel : chauffeurs ────────────────────────────────────────────────
  const { data: chauffeurs = [], isLoading: isLoadingChauf } = useQuery({
    queryKey: ["chauffeurs-filiale-modal", filialeId],
    queryFn: () => userService.listChauffeursByFiliale(filialeId).catch(() => []),
    enabled: !!filialeId,
    staleTime: 3 * 60 * 1000,
  });

  // ── Voyages : via profil agence filtré sur cette filiale ──────────────────
  // On utilise le profil de l'agence et on filtre les voyages
  // dont filiale_depart = nom de cette filiale.
  // Cela garantit qu'on ne voit que les voyages de l'agence connectée.
  const {
    data: profilAgence,
    isLoading: isLoadingProfil,
    refetch: refetchProfil,
  } = useQuery({
    queryKey: ["agence-profil-filiale-modal", agenceId],
    queryFn: () => fleetService.getAgenceProfil(agenceId),
    enabled: !!agenceId,
    staleTime: 2 * 60 * 1000,
  });

  // Extraire les voyages de cette filiale depuis le profil
  const tousVoyagesProfil = profilAgence?.voyages ?? [];
  const voyages = tousVoyagesProfil.filter(
    (v) =>
      v.filiale_depart === filiale.nom ||
      v.filiale_arrivee === filiale.nom ||
      v.origine === filiale.ville ||
      v.destination === filiale.ville
  );

  // ── Recettes filiale ──────────────────────────────────────────────────────
  const {
    data: recettes,
    isLoading: isLoadingRecettes,
    refetch: refetchRecettes,
  } = useQuery({
    queryKey: ["recettes-filiale-modal", filialeId],
    queryFn: () => bookingService.getRecettesFiliale(filialeId, "XAF"),
    enabled: !!filialeId,
    staleTime: 3 * 60 * 1000,
  });

  // ── Valeurs protégées ─────────────────────────────────────────────────────
  const recetteTotale  = Number(recettes?.recetteTotale)  || 0;
  const recetteEnLigne = Number(recettes?.recetteEnLigne) || 0;
  const recetteGuichet = Number(recettes?.recetteGuichet) || 0;
  const nbEnLigne      = Number(recettes?.nbReservationsEnLigne)  || 0;
  const nbGuichet      = Number(recettes?.nbReservationsGuichet) || 0;
  const pctEnLigne     = Number(recettes?.partEnLignePct) || 0;
  const pctGuichet     = Number(recettes?.partGuichetPct) || 0;

  // ── Calculs ───────────────────────────────────────────────────────────────
  const totalPersonnel    = guichetiers.length + chauffeurs.length;
  const voyagesEnCours    = voyages.filter((v) => v.status === "en_cours");
  const voyagesTermines   = voyages.filter((v) => v.status === "termine");
  const voyagesProgrammes = voyages.filter((v) => v.status === "programme");

  const isLoadingPersonnel = isLoadingGuich || isLoadingChauf;
  const isLoadingVoyages   = isLoadingProfil;

  const tabs = [
    { id: "personnel",    label: "Personnel",    icon: Users,     count: totalPersonnel },
    { id: "voyages",      label: "Voyages",      icon: Calendar,  count: voyages.length },
    { id: "recettes",     label: "Recettes",     icon: TrendingUp },
    { id: "infos",        label: "Infos",        icon: Briefcase  },
  ];

  return (
    // Overlay — fermeture au clic en dehors
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/*
        ── La modal elle-même ──
        Sur mobile : prend toute la hauteur de l'écran en bas (rounded-t-2xl)
        Sur desktop : max 90vh centré
        CORRECTION SCROLL : flex-col + overflow-hidden sur le container,
        overflow-y-auto uniquement sur la zone de contenu
      */}
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl rounded-t-2xl overflow-hidden">

        {/* ── Header — fixe, ne scroll pas ── */}
        <div className="flex items-start justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
              {filiale.nom}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="w-3.5 h-3.5" />
                {filiale.ville}
              </div>
              {filiale.code && (
                <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                  #{filiale.code}
                </span>
              )}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                filiale.est_active !== false
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}>
                {filiale.est_active !== false ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-2 hover:bg-slate-200 rounded-xl transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* ── Stats rapides — fixe ── */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4 px-5 py-3 sm:px-6 sm:py-4 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          {[
            { label: "Bus",       value: filiale.nb_bus || 0,  icon: Bus,       highlight: false },
            { label: "Personnel", value: totalPersonnel,        icon: Users,     highlight: false },
            { label: "Voyages",   value: voyages.length,        icon: Calendar,  highlight: false },
            { label: "Recettes",  value: formatMontant(recetteTotale), icon: TrendingUp, highlight: true },
          ].map(({ label, value, icon: Icon, highlight }) => (
            <div
              key={label}
              className={`rounded-xl p-2.5 text-center ${
                highlight
                  ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm"
                  : "bg-white border border-slate-100"
              }`}
            >
              <Icon className={`w-4 h-4 mx-auto mb-1 ${highlight ? "text-blue-200" : "text-blue-600"}`} />
              <p className={`text-xs sm:text-sm font-extrabold leading-tight ${highlight ? "text-white" : "text-slate-900"}`}>
                {value}
              </p>
              <p className={`text-[10px] mt-0.5 ${highlight ? "text-blue-200" : "text-slate-400"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Tabs — fixe ── */}
        <div className="flex gap-0.5 px-4 sm:px-6 border-b border-slate-100 bg-white flex-shrink-0 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                activeTab === id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {label}
              {count !== undefined && count > 0 && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Zone scrollable — SEULE cette zone scroll ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 sm:p-6 space-y-6">

            {/* ══ PERSONNEL ══ */}
            {activeTab === "personnel" && (
              <>
                {isLoadingPersonnel ? (
                  <Spinner size="md" className="py-12" />
                ) : totalPersonnel === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun employé pour cette filiale.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <EmployeeGroup
                      title="Guichetiers"
                      employees={guichetiers.map(e => ({ ...e, role: "GUICHETIER" }))}
                      icon={UserCheck}
                      color="text-blue-600"
                    />
                    <EmployeeGroup
                      title="Chauffeurs"
                      employees={chauffeurs.map(e => ({ ...e, role: "CHAUFFEUR" }))}
                      icon={Bus}
                      color="text-amber-600"
                    />
                  </div>
                )}
              </>
            )}

            {/* ══ VOYAGES ══ */}
            {activeTab === "voyages" && (
              <>
                {isLoadingVoyages ? (
                  <Spinner size="md" className="py-12" />
                ) : voyages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucun voyage trouvé pour cette filiale.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* En cours */}
                    {voyagesEnCours.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          En cours ({voyagesEnCours.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {voyagesEnCours.map((v) => (
                            <VoyageCard key={v.id_voyage || v.Id_voyage} voyage={v} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Programmés */}
                    {voyagesProgrammes.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-blue-500" />
                          Planifiés ({voyagesProgrammes.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {voyagesProgrammes.map((v) => (
                            <VoyageCard key={v.id_voyage || v.Id_voyage} voyage={v} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Terminés */}
                    {voyagesTermines.length > 0 && (
                      <div>
                        <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          Historique ({voyagesTermines.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {voyagesTermines.slice(0, 6).map((v) => (
                            <VoyageCard key={v.id_voyage || v.Id_voyage} voyage={v} />
                          ))}
                        </div>
                        {voyagesTermines.length > 6 && (
                          <p className="text-center text-xs text-slate-400 mt-4">
                            +{voyagesTermines.length - 6} autres voyages terminés
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ══ RECETTES ══ */}
            {activeTab === "recettes" && (
              <>
                {isLoadingRecettes ? (
                  <Spinner size="md" className="py-12" />
                ) : (
                  <div className="space-y-5">
                    {/* Total */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white text-center">
                      <DollarSign className="w-6 h-6 mx-auto mb-2 opacity-80" />
                      <p className="text-4xl font-black">{formatMontant(recetteTotale)}</p>
                      <p className="text-blue-200 text-sm mt-1">
                        {nbEnLigne + nbGuichet} réservations payées
                      </p>
                    </div>

                    {/* Détail canaux */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Smartphone className="w-5 h-5 text-blue-600" />
                          <span className="font-bold text-blue-800 text-sm">En ligne — Mobile Money</span>
                        </div>
                        <p className="text-2xl font-black text-blue-700">{formatMontant(recetteEnLigne)}</p>
                        <div className="flex justify-between text-xs text-blue-600 mt-2">
                          <span>{nbEnLigne} réservations</span>
                          <span className="font-bold">{pctEnLigne}% du total</span>
                        </div>
                        {/* Barre de progression */}
                        <div className="w-full bg-blue-200 rounded-full h-1.5 mt-3">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(pctEnLigne, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-emerald-50 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Banknote className="w-5 h-5 text-emerald-600" />
                          <span className="font-bold text-emerald-800 text-sm">Guichet — Espèces</span>
                        </div>
                        <p className="text-2xl font-black text-emerald-700">{formatMontant(recetteGuichet)}</p>
                        <div className="flex justify-between text-xs text-emerald-600 mt-2">
                          <span>{nbGuichet} réservations</span>
                          <span className="font-bold">{pctGuichet}% du total</span>
                        </div>
                        <div className="w-full bg-emerald-200 rounded-full h-1.5 mt-3">
                          <div
                            className="bg-emerald-600 h-1.5 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(pctGuichet, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => refetchRecettes()}
                      className="w-full flex items-center justify-center gap-2 text-xs text-blue-600 hover:text-blue-700 py-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Actualiser les recettes
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ══ INFOS ══ */}
            {activeTab === "infos" && (
              <div className="space-y-3">
                {[
                  { label: "Nom",             value: filiale.nom },
                  { label: "Code",            value: filiale.code },
                  { label: "Ville",           value: filiale.ville },
                  { label: "Adresse",         value: filiale.adresse },
                  { label: "Téléphone",       value: filiale.telephone, href: `tel:${filiale.telephone}` },
                  { label: "Email",           value: filiale.email,     href: `mailto:${filiale.email}` },
                  { label: "Statut",          value: filiale.est_active !== false ? "Active" : "Inactive" },
                  {
                    label: "Date de création",
                    value: filiale.created_at
                      ? new Date(filiale.created_at).toLocaleDateString("fr-FR")
                      : "—",
                  },
                ].map(({ label, value, href }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-500">{label}</span>
                    {href && value ? (
                      <a href={href} className="text-sm font-bold text-blue-600 hover:underline truncate max-w-[60%] text-right">
                        {value}
                      </a>
                    ) : (
                      <span className="text-sm font-bold text-slate-900 truncate max-w-[60%] text-right">
                        {value || "—"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* ── Footer — fixe, ne scroll pas ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <button
            onClick={() => { refetchRecettes(); refetchProfil(); }}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}