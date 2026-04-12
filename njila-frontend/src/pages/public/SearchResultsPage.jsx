import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Clock, Users, Filter, ArrowRight, Star, AlertCircle } from "lucide-react";
import PublicLayout from "../../components/layout/PublicLayout";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Spinner from "../../components/ui/Spinner";
import { useBookingStore } from "../../store/bookingStore";
import { searchService } from "../../services/searchService";
import { formatMontant, formatHeure } from "../../utils/formatters";

export default function SearchResultsPage() {
  const navigate = useNavigate();
  const { recherche, setVoyageSelectionne } = useBookingStore();
  const [filtres, setFiltres] = useState({ classe: "all", heure: "all" });

  const { data: voyages, isLoading, error } = useQuery({
    queryKey: ["voyages", recherche],
    queryFn: () => searchService.rechercherVoyages(recherche),
    enabled: !!recherche.origine && !!recherche.destination,
  });

  const handleBook = (voyage) => {
    setVoyageSelectionne(voyage);
    navigate(`/selection-places/${voyage.id}`);
  };

  return (
    <PublicLayout>
      {/* Barre de recherche rapide */}
      <div className="bg-white border-b border-gray-200 py-4 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg text-sm">
            <MapPin className="w-4 h-4 text-primary-600" />
            <span className="font-medium">{recherche.origine}</span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{recherche.destination}</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>{recherche.date}</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg text-sm">
            <Users className="w-4 h-4 text-gray-400" />
            <span>{recherche.nombrePlaces} passager(s)</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate("/")}>
            Modifier
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Filtres */}
        <aside className="w-64 flex-shrink-0 hidden lg:block">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-36">
            <div className="flex items-center gap-2 mb-6">
              <Filter className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Filtres</h3>
              <button className="ml-auto text-xs text-primary-600 hover:underline">Effacer</button>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Classe de service</p>
                <div className="grid grid-cols-2 gap-2">
                  {["all", "VIP", "CLASSIC"].map(c => (
                    <button
                      key={c}
                      onClick={() => setFiltres(f => ({ ...f, classe: c }))}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        filtres.classe === c
                          ? "bg-primary-600 text-white border-primary-600"
                          : "border-gray-200 text-gray-600 hover:border-primary-300"
                      }`}
                    >
                      {c === "all" ? "Tous" : c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Heure de départ</p>
                <div className="grid grid-cols-2 gap-2">
                  {[["Matin", "morning"], ["Après-midi", "afternoon"], ["Soir", "evening"], ["Nuit", "night"]].map(([l, v]) => (
                    <button
                      key={v}
                      onClick={() => setFiltres(f => ({ ...f, heure: v }))}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        filtres.heure === v
                          ? "bg-primary-600 text-white border-primary-600"
                          : "border-gray-200 text-gray-600 hover:border-primary-300"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Résultats */}
        <div className="flex-1">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Spinner size="lg" />
              <p className="mt-4 text-gray-500">Recherche des trajets disponibles...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="w-12 h-12 text-danger-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Service temporairement indisponible</h3>
              <p className="text-gray-500">Veuillez réessayer dans quelques instants.</p>
            </div>
          )}

          {voyages && (
            <>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-500">
                  <span className="font-bold text-gray-900">{voyages.length}</span> trajets trouvés
                </p>
                <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Départ le plus tôt</option>
                  <option>Prix croissant</option>
                  <option>Prix décroissant</option>
                </select>
              </div>

              <div className="space-y-4">
                {voyages.map((voyage) => (
                  <div key={voyage.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                          <span className="text-primary-600 font-bold text-xs">{voyage.agence?.codeAgence || "AG"}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{voyage.agenceNom || "Agence"}</p>
                            <Badge variant={voyage.type === "VIP" ? "primary" : "gray"}>
                              {voyage.type || "CLASSIC"}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <span className="text-xs text-gray-500">4.5</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xl font-bold text-gray-900">
                              {voyage.heureDepart?.slice(11, 16) || "—"}
                            </span>
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                              <div className="w-16 h-px bg-gray-300" />
                              <span>Direct</span>
                              <div className="w-16 h-px bg-gray-300" />
                            </div>
                            <span className="text-xl font-bold text-gray-900">
                              {voyage.heureArrivee?.slice(11, 16) || "—"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {voyage.origine} → {voyage.destination}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400 mb-1">À partir de</p>
                        <p className="text-2xl font-bold text-primary-600">
                          {formatMontant(voyage.prix || 5000)}
                        </p>
                        {voyage.placesDisponibles <= 5 && (
                          <p className="text-xs text-danger-600 flex items-center gap-1 justify-end mt-1">
                            <Users className="w-3 h-3" />
                            Plus que {voyage.placesDisponibles} places !
                          </p>
                        )}
                        <Button size="md" className="mt-3 w-full" onClick={() => handleBook(voyage)}>
                          Réserver
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* État vide si pas de recherche */}
          {!isLoading && !error && !voyages && (
            <div className="text-center py-20">
              <p className="text-gray-500">Sélectionnez une origine et une destination pour voir les trajets disponibles.</p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
