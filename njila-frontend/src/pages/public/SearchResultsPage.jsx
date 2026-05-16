import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  MapPin, Clock, Filter, ArrowRight,
  AlertCircle, ArrowLeft, SlidersHorizontal, Bus
} from "lucide-react";
import PublicLayout from "../../components/layout/PublicLayout";
import Badge from "../../components/ui/Badge";
import Spinner from "../../components/ui/Spinner";
import { useBookingStore } from "../../store/bookingStore";
import { fleetService } from "../../services/fleetService";
import { bookingService } from "../../services/bookingService";
import { formatMontant } from "../../utils/formatters";

export default function SearchResultsPage() {
  const navigate = useNavigate();
  const { recherche, setVoyageSelectionne } = useBookingStore();

  const [filtres, setFiltres] = useState({
    classe: "all",
    heure: "all",
    agence: "all"
  });

  // ── Récupération des voyages ─────────────────────────────────────
  const { data: voyagesRaw = [], isLoading, error } = useQuery({
    queryKey: ["voyages", recherche],
    queryFn: () => fleetService.rechercherVoyages({
      filiale_depart: recherche.origine,
      filiale_arrive: recherche.destination,
      date: recherche.date,
    }),
    enabled: !!recherche.origine && !!recherche.destination,
  });

  // Normalisation des voyages
  const voyages = (Array.isArray(voyagesRaw) ? voyagesRaw : voyagesRaw?.results || []).map(v => ({
    ...v,
    id: v.id || v.Id_voyage,
    dateHeureDepart: v.dateHeureDepart || v.date_heure_depart,
    dateHeureArrivee: v.dateHeureArrivee || v.date_heure_arrivee,
  }));

  // ── Récupération des places disponibles pour chaque voyage (en parallèle) ──
  const availabilityQueries = useQueries({
    queries: voyages.map((voyage) => ({
      queryKey: ["sieges", voyage.id],
      queryFn: () => bookingService.getSiegesVoyage(voyage.id),
      enabled: !!voyage.id,
      staleTime: 1000 * 60 * 2, // 2 minutes
    })),
  });

  // Associer les disponibilités aux voyages
  const voyagesAvecPlaces = voyages.map((voyage, index) => {
    const avail = availabilityQueries[index]?.data;
    const capacite = avail?.capacite || voyage.capaciteBus || 50;
    const placesLibres = avail?.libres ?? avail?.disponibles?.length ?? voyage.placesRestantes ?? 0;

    return {
      ...voyage,
      capacite,
      placesLibres,
      placesOccupees: capacite - placesLibres,
    };
  });

  // ── Filtrage ─────────────────────────────────────────────────────
  const filtered = voyagesAvecPlaces.filter(v => {
    if (filtres.classe !== "all" && v.typeVoyage !== filtres.classe && v.type_voyage !== filtres.classe) return false;
    
    if (filtres.heure !== "all") {
      const hour = new Date(v.dateHeureDepart).getHours();
      if (filtres.heure === "morning" && (hour < 6 || hour >= 12)) return false;
      if (filtres.heure === "afternoon" && (hour < 12 || hour >= 18)) return false;
      if (filtres.heure === "evening" && (hour < 18 || hour >= 22)) return false;
    }
    
    if (filtres.agence !== "all" && v.codeAgence !== filtres.agence) return false;
    
    return true;
  });

  const agencesDisponibles = [...new Set(voyages.map(v => v.codeAgence))];

  const handleBook = (voyage) => {
    setVoyageSelectionne(voyage);
    navigate(`/selection-places/${voyage.id}`);
  };

  // ── Helpers ─────────────────────────────────────────────────────
  const formatHeure = (dateStr) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuree = (depart, arrivee) => {
    if (!depart || !arrivee) return null;
    const diff = new Date(arrivee) - new Date(depart);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h${m > 0 ? m + "min" : ""}`;
  };

  return (
    <PublicLayout>
      {/* Barre supérieure */}
      <div className="bg-white border-b border-gray-200 py-4 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <span>{recherche.origine}</span>
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <span>{recherche.destination}</span>
              </div>
              <p className="text-xs text-gray-500">{recherche.date}</p>
            </div>
          </div>
          <Badge variant="primary" className="hidden md:block">
            {filtered.length} voyage{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Filtres */}
        <aside className="w-full lg:w-64 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <SlidersHorizontal className="w-4 h-4 text-[#135bec]" />
              <h3 className="font-bold text-gray-900">Filtres</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-3 block">Classe</label>
                <select
                  value={filtres.classe}
                  onChange={e => setFiltres({ ...filtres, classe: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="all">Toutes les classes</option>
                  <option value="VIP">VIP</option>
                  <option value="STANDARD">Classique</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-3 block">Agence</label>
                <select
                  value={filtres.agence}
                  onChange={e => setFiltres({ ...filtres, agence: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="all">Toutes les agences</option>
                  {agencesDisponibles.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-3 block">Horaire</label>
                <select
                  value={filtres.heure}
                  onChange={e => setFiltres({ ...filtres, heure: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="all">Tous les horaires</option>
                  <option value="morning">Matin (6h–12h)</option>
                  <option value="afternoon">Après-midi (12h–18h)</option>
                  <option value="evening">Soir (18h–22h)</option>
                </select>
              </div>
            </div>
          </div>
        </aside>

        {/* Résultats */}
        <div className="flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl">
              <Spinner size="lg" />
              <p className="mt-4 text-gray-500">Recherche de trajets...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-red-50 rounded-3xl">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-red-900">Erreur de connexion</h3>
              <p className="text-sm text-red-500 mt-2">{error.message}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed">
              <Bus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-bold">Aucun voyage disponible</p>
              <p className="text-sm text-gray-400 mt-1">Essayez d'autres dates ou destinations</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((voyage) => {
                const duree = formatDuree(voyage.dateHeureDepart, voyage.dateHeureArrivee);

                return (
                  <div
                    key={voyage.id}
                    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-[#135bec]/5 rounded-2xl flex items-center justify-center text-[#135bec] font-black text-sm">
                          {voyage.codeAgence?.substring(0, 3).toUpperCase() || "NJL"}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-extrabold text-gray-900 capitalize">
                              {voyage.codeAgence}
                            </h3>
                            <Badge variant={voyage.typeVoyage === "VIP" || voyage.type_voyage === "VIP" ? "primary" : "gray"}>
                              {voyage.typeVoyage || voyage.type_voyage || "STANDARD"}
                            </Badge>
                          </div>

                          <p className="text-xs text-gray-400 mb-2 capitalize">
                            {voyage.trajetInfo}
                          </p>

                          <div className="flex items-center gap-4 mt-1">
                            <div>
                              <p className="text-2xl font-black text-gray-900">
                                {formatHeure(voyage.dateHeureDepart)}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400">DÉPART</p>
                            </div>
                            <div className="flex flex-col items-center text-gray-300">
                              <span className="text-xs">→</span>
                              {duree && <span className="text-[10px] text-gray-400 font-medium">{duree}</span>}
                            </div>
                            <div>
                              <p className="text-2xl font-black text-gray-900">
                                {formatHeure(voyage.dateHeureArrivee)}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400">ARRIVÉE</p>
                            </div>
                          </div>

                          {/* Places disponibles - VERSION CORRIGÉE */}
                          <p className="text-xs mt-3">
                            <span className={`font-bold ${voyage.placesLibres < 10 ? "text-red-600" : "text-emerald-600"}`}>
                              {voyage.placesLibres} place{voyage.placesLibres > 1 ? "s" : ""} disponible{voyage.placesLibres > 1 ? "s" : ""}
                            </span>
                            <span className="text-gray-400 ml-2">
                              (sur {voyage.capacite} sièges)
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Prix + Bouton */}
                      <div className="flex md:flex-col items-center md:items-end justify-between gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Prix</p>
                          <p className="text-2xl font-black text-[#135bec]">
                            {formatMontant(voyage.prix || voyage.prixBase)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleBook(voyage)}
                          disabled={voyage.placesLibres < 1}
                          className={`font-bold px-6 py-3 rounded-xl transition-all ${
                            voyage.placesLibres > 0
                              ? "bg-[#135bec] text-white hover:bg-blue-700 active:scale-95"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          {voyage.placesLibres > 0 ? "Réserver" : "Complet"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
