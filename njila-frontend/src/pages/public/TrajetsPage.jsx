import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Bus, Clock, MapPin, ChevronDown, ChevronUp,
  SlidersHorizontal, ArrowRight, AlertCircle
} from "lucide-react";
import PublicLayout from "../../components/layout/PublicLayout";
import { fleetService } from "../../services/fleetService";
import { useBookingStore } from "../../store/bookingStore";
import { formatMontant } from "../../utils/formatters";
import Spinner from "../../components/ui/Spinner";

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatHeure = (dateStr) => {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "short",
  });
};

const formatDuree = (depart, arrivee) => {
  if (!depart || !arrivee) return null;
  const diff = new Date(arrivee) - new Date(depart);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : "00"}`;
};

// ── Carte d'un voyage ─────────────────────────────────────────────────────────
function VoyageCard({ voyage, onBook }) {
  const duree = formatDuree(voyage.dateHeureDepart, voyage.dateHeureArrivee);
  const placesOk = (voyage.placesRestantes ?? voyage.placesDisponibles ?? 0) > 0;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Horaires + trajet */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="text-center flex-shrink-0">
            <p className="text-2xl font-extrabold text-slate-900">
              {formatHeure(voyage.dateHeureDepart)}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Départ</p>
          </div>

          <div className="flex flex-col items-center flex-1 min-w-0 px-2">
            <div className="flex items-center gap-1 w-full">
              <div className="flex-1 h-px bg-slate-200" />
              <ArrowRight className="w-4 h-4 text-[#135bec] flex-shrink-0" />
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            {duree && (
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{duree}</span>
            )}
            <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-full">
              {formatDate(voyage.dateHeureDepart)}
            </span>
          </div>

          <div className="text-center flex-shrink-0">
            <p className="text-2xl font-extrabold text-slate-900">
              {formatHeure(voyage.dateHeureArrivee)}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Arrivée</p>
          </div>
        </div>

        {/* Séparateur vertical */}
        <div className="hidden sm:block w-px h-12 bg-slate-100 flex-shrink-0" />

        {/* Infos + prix + bouton */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 flex-shrink-0">
          <div className="sm:text-right">
            <p className="text-xs text-slate-400 font-semibold uppercase">{voyage.typeVoyage}</p>
            <p className="text-2xl font-extrabold text-[#135bec]">
              {formatMontant(voyage.prix)}
            </p>
            <p className={`text-xs font-bold mt-0.5 ${
              !placesOk ? "text-red-500" :
              (voyage.placesRestantes ?? voyage.placesDisponibles ?? 0) <= 5 ? "text-amber-500" :
              "text-emerald-600"
            }`}>
              {placesOk
                ? `${voyage.placesRestantes ?? voyage.placesDisponibles} place(s)`
                : "Complet"}
            </p>
          </div>
          <button
            onClick={() => onBook(voyage)}
            disabled={!placesOk}
            className={`px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
              placesOk
                ? "bg-[#135bec] text-white hover:bg-blue-700 active:scale-95"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {placesOk ? "Réserver" : "Complet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bloc agence avec accordéon ────────────────────────────────────────────────
function AgenceSection({ agence, voyages, onBook }) {
  const [ouvert, setOuvert] = useState(true);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-6">
      {/* En-tête agence */}
      <button
        onClick={() => setOuvert(!ouvert)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#135bec]/10 rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-[#135bec] font-extrabold text-sm">
              {agence.substring(0, 3).toUpperCase()}
            </span>
          </div>
          <div className="text-left">
            <h3 className="font-extrabold text-slate-900 text-lg capitalize">{agence}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {voyages.length} voyage{voyages.length > 1 ? "s" : ""} disponible{voyages.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-xs font-bold text-[#135bec] bg-blue-50 px-3 py-1 rounded-full">
            {voyages.length} voyage{voyages.length > 1 ? "s" : ""}
          </span>
          {ouvert
            ? <ChevronUp className="w-5 h-5 text-slate-400" />
            : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </button>

      {/* Liste voyages */}
      {ouvert && (
        <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
          {voyages.map((v) => (
            <VoyageCard key={v.id} voyage={v} onBook={onBook} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function TrajetsPage() {
  const navigate = useNavigate();
  const { setVoyageSelectionne } = useBookingStore();

  const [search,    setSearch]    = useState("");
  const [filtreType, setFiltreType] = useState("all"); // all | VIP | STANDARD
  const [filtreDate, setFiltreDate] = useState("");

  // Chargement de tous les voyages disponibles
  const { data: voyagesRaw = [], isLoading, error, refetch } = useQuery({
    queryKey: ["tous-voyages"],
    queryFn: () => fleetService.getVoyages({ status: "confirme" }),
    staleTime: 2 * 60 * 1000,
  });

  // Normalisation
  const voyages = useMemo(() => {
    const list = Array.isArray(voyagesRaw) ? voyagesRaw : voyagesRaw?.results || [];
    return list.map((v) => fleetService._normaliserVoyage(v));
  }, [voyagesRaw]);

  // Filtrage
  const voyagesFiltres = useMemo(() => {
    return voyages.filter((v) => {
      // Filtre recherche texte (origine, destination, agence)
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          v.origine?.toLowerCase().includes(q) ||
          v.destination?.toLowerCase().includes(q) ||
          v.codeAgence?.toLowerCase().includes(q) ||
          v.trajetInfo?.toLowerCase().includes(q);
        if (!match) return false;
      }
      // Filtre type voyage
      if (filtreType !== "all" && v.typeVoyage !== filtreType) return false;
      // Filtre date
      if (filtreDate && v.dateHeureDepart) {
        const dateVoyage = v.dateHeureDepart.slice(0, 10);
        if (dateVoyage !== filtreDate) return false;
      }
      return true;
    });
  }, [voyages, search, filtreType, filtreDate]);

  // Groupement par agence
  const parAgence = useMemo(() => {
    const groupes = {};
    voyagesFiltres.forEach((v) => {
      const agence = v.codeAgence || "Agence inconnue";
      if (!groupes[agence]) groupes[agence] = [];
      groupes[agence].push(v);
    });
    // Trier les agences alphabétiquement
    return Object.fromEntries(
      Object.entries(groupes).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [voyagesFiltres]);

  const handleBook = (voyage) => {
    setVoyageSelectionne(voyage);
    navigate(`/selection-places/${voyage.id}`);
  };

  const totalVoyages = voyagesFiltres.length;
  const totalAgences = Object.keys(parAgence).length;

  return (
    <PublicLayout>
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#135bec] to-blue-800 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
            Tous les trajets disponibles
          </h1>
          <p className="text-blue-100 text-lg mb-8">
            Parcourez l'ensemble des voyages proposés par nos agences partenaires, triés par compagnie.
          </p>

          {/* Barre de recherche */}
          <div className="max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une ville, une agence..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white text-slate-800 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filtres */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <SlidersHorizontal className="w-4 h-4 text-[#135bec] flex-shrink-0 mt-0.5 sm:mt-0" />

          {/* Type */}
          <div className="flex gap-2">
            {[
              { val: "all",      label: "Tous" },
              { val: "VIP",      label: "VIP" },
              { val: "STANDARD", label: "Standard" },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setFiltreType(val)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  filtreType === val
                    ? "bg-[#135bec] text-white border-[#135bec]"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:border-[#135bec] hover:text-[#135bec]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Date */}
          <input
            type="date"
            value={filtreDate}
            onChange={(e) => setFiltreDate(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#135bec]"
          />

          {(filtreType !== "all" || filtreDate || search) && (
            <button
              onClick={() => { setFiltreType("all"); setFiltreDate(""); setSearch(""); }}
              className="text-xs font-bold text-red-500 hover:text-red-700 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors"
            >
              Réinitialiser
            </button>
          )}

          {/* Compteur */}
          <div className="ml-auto text-sm text-slate-400 font-medium flex-shrink-0">
            {isLoading ? "Chargement..." : (
              <>
                <span className="font-bold text-slate-700">{totalVoyages}</span> voyage{totalVoyages > 1 ? "s" : ""}
                {" · "}
                <span className="font-bold text-slate-700">{totalAgences}</span> agence{totalAgences > 1 ? "s" : ""}
              </>
            )}
          </div>
        </div>

        {/* États */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl">
            <Spinner size="lg" />
            <p className="mt-4 text-slate-500">Chargement des trajets...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20 bg-red-50 rounded-3xl border border-red-100">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-red-900">Erreur de connexion</h3>
            <p className="text-sm text-red-500 mt-2 mb-4">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="text-sm font-bold text-[#135bec] hover:underline"
            >
              Réessayer
            </button>
          </div>
        )}

        {!isLoading && !error && totalVoyages === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <Bus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-lg">Aucun voyage disponible</p>
            <p className="text-sm text-slate-400 mt-1">
              {search || filtreType !== "all" || filtreDate
                ? "Essayez d'autres critères de recherche"
                : "Revenez bientôt pour découvrir nos prochains trajets"}
            </p>
          </div>
        )}

        {/* Voyages groupés par agence */}
        {!isLoading && !error && totalVoyages > 0 && (
          <div>
            {Object.entries(parAgence).map(([agence, voyagesAgence]) => (
              <AgenceSection
                key={agence}
                agence={agence}
                voyages={voyagesAgence}
                onBook={handleBook}
              />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}