import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Clock, Users, Filter, ArrowRight, Star, AlertCircle, ArrowLeft, SlidersHorizontal } from "lucide-react";
import PublicLayout from "../../components/layout/PublicLayout";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Spinner from "../../components/ui/Spinner";
import { useBookingStore } from "../../store/bookingStore";
import { searchService } from "../../services/searchService";
import { formatMontant } from "../../utils/formatters";

export default function SearchResultsPage() {
  const navigate = useNavigate();
  const { recherche, setVoyageSelectionne } = useBookingStore();
  const [filtres, setFiltres] = useState({ classe: "all", heure: "all" });
  const [showFilters, setShowFilters] = useState(false);

  const { data: voyages, isLoading, error } = useQuery({
    queryKey: ["voyages", recherche],
    queryFn: () => searchService.rechercherVoyages(recherche),
    enabled: !!recherche.origine && !!recherche.destination,
  });

  const handleBook = (voyage) => {
    setVoyageSelectionne(voyage);
    navigate(`/selection-places/${voyage.id}`);
  };

  const filtered = (voyages || []).filter(v => {
    if (filtres.classe !== "all" && v.type !== filtres.classe) return false;
    return true;
  });

  return (
    <PublicLayout>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .card-enter { animation: fadeUp .3s ease both; }
        .trip-card { transition: all .2s ease; }
        .trip-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.08); }
      `}</style>

      {/* Barre de recherche */}
      <div className="bg-white border-b border-gray-200 py-4 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-3 flex-wrap">
          {/* Bouton retour */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold transition-colors group"
          >
            <div className="w-8 h-8 bg-slate-100 group-hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
          </button>

          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl text-sm">
            <MapPin className="w-4 h-4 text-primary-600" />
            <span className="font-semibold">{recherche.origine}</span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span className="font-semibold">{recherche.destination}</span>
          </div>
          {recherche.date && (
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl text-sm">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>{recherche.date}</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl text-sm">
            <Users className="w-4 h-4 text-gray-400" />
            <span>{recherche.nombrePlaces || 1} passager(s)</span>
          </div>
          <button
            onClick={() => navigate("/")}
            className="ml-auto text-sm font-bold text-primary-600 hover:underline"
          >
            Modifier
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Filtres desktop */}
        <aside className="w-64 flex-shrink-0 hidden lg:block">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-36">
            <div className="flex items-center gap-2 mb-6">
              <SlidersHorizontal className="w-4 h-4 text-gray-600" />
              <h3 className="font-bold text-gray-900">Filtres</h3>
              <button className="ml-auto text-xs text-primary-600 hover:underline" onClick={() => setFiltres({ classe: "all", heure: "all" })}>Effacer</button>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-3">Classe de service</p>
                <div className="grid grid-cols-2 gap-2">
                  {["all", "VIP", "CLASSIC"].map(c => (
                    <button key={c} onClick={() => setFiltres(f => ({ ...f, classe: c }))}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                        filtres.classe === c ? "bg-primary-600 text-white border-primary-600" : "border-gray-200 text-gray-600 hover:border-primary-300"
                      }`}>
                      {c === "all" ? "Tous" : c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-3">Heure de départ</p>
                <div className="grid grid-cols-2 gap-2">
                  {[["Matin", "morning"], ["Après-midi", "afternoon"], ["Soir", "evening"], ["Nuit", "night"]].map(([l, v]) => (
                    <button key={v} onClick={() => setFiltres(f => ({ ...f, heure: v }))}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                        filtres.heure === v ? "bg-primary-600 text-white border-primary-600" : "border-gray-200 text-gray-600 hover:border-primary-300"
                      }`}>
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
              <p className="mt-4 text-gray-500 text-sm">Recherche des trajets disponibles...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 text-center card-enter">
              <AlertCircle className="w-12 h-12 text-danger-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Service temporairement indisponible</h3>
              <p className="text-gray-500">Veuillez réessayer dans quelques instants.</p>
              <button onClick={() => navigate("/")} className="mt-4 text-primary-600 font-bold hover:underline flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
              </button>
            </div>
          )}

          {!isLoading && !error && filtered && (
            <>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-500">
                  <span className="font-bold text-gray-900">{filtered.length}</span> trajet(s) trouvé(s)
                </p>
                <select className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option>Départ le plus tôt</option>
                  <option>Prix croissant</option>
                  <option>Prix décroissant</option>
                </select>
              </div>

              <div className="space-y-4">
                {filtered.map((voyage, idx) => (
                  <div
                    key={voyage.id}
                    className="trip-card card-enter bg-white rounded-2xl border border-gray-200 p-6"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-600 font-extrabold text-xs">{voyage.codeAgence || "AG"}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <p className="font-bold text-gray-900">{voyage.agenceNom || "Agence"}</p>
                            <Badge variant={voyage.type === "VIP" ? "primary" : "gray"}>{voyage.type || "CLASSIC"}</Badge>
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <span className="text-xs text-gray-500">4.5</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-2xl font-extrabold text-gray-900">{voyage.heureDepart?.slice(11,16) || "—"}</span>
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                              <div className="w-12 h-px bg-gray-300" />
                              <span>Direct</span>
                              <div className="w-12 h-px bg-gray-300" />
                            </div>
                            <span className="text-2xl font-extrabold text-gray-900">{voyage.heureArrivee?.slice(11,16) || "—"}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{voyage.origine} → {voyage.destination}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400 mb-1">À partir de</p>
                        <p className="text-2xl font-extrabold text-primary-600">{formatMontant(voyage.prix || 5000)}</p>
                        {voyage.placesDisponibles <= 5 ? (
                          <p className="text-xs text-red-500 flex items-center gap-1 justify-end mt-1">
                            <Users className="w-3 h-3" /> Plus que {voyage.placesDisponibles} places !
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-600 flex items-center gap-1 justify-end mt-1">
                            <Users className="w-3 h-3" /> {voyage.placesDisponibles} places
                          </p>
                        )}
                        <button
                          onClick={() => handleBook(voyage)}
                          className="mt-3 w-full bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1"
                        >
                          Réserver <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="card-enter text-center py-20">
                  <p className="text-gray-500 mb-4">Aucun trajet ne correspond à vos critères.</p>
                  <button onClick={() => setFiltres({ classe: "all", heure: "all" })} className="text-primary-600 font-bold hover:underline">
                    Effacer les filtres
                  </button>
                </div>
              )}
            </>
          )}

          {!isLoading && !error && !voyages && (
            <div className="card-enter text-center py-20">
              <p className="text-gray-500">Sélectionnez un trajet pour voir les résultats.</p>
              <button onClick={() => navigate("/")} className="mt-4 text-primary-600 font-bold hover:underline flex items-center gap-1 mx-auto">
                <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
              </button>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}