import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Bus, MapPin, Phone, Building2, ArrowRight } from "lucide-react";
import PublicLayout from "../../components/layout/PublicLayout";
import { agenceService } from "../../services/agenceService";
import { IMAGES } from "../../assets/images";

const AGENCY_FALLBACKS = [IMAGES.AGENCY_1, IMAGES.AGENCY_2, IMAGES.AGENCY_3];

const getBadge = (index) => {
  const badges = [
    { type: "PREMIUM", bg: "bg-emerald-500" },
    { type: "EXPRESS", bg: "bg-blue-500"    },
    { type: "ECONOMY", bg: "bg-amber-500"   },
  ];
  return badges[index % badges.length];
};

export default function AgencesListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: agencesData = [], isLoading } = useQuery({
    queryKey: ["agences-liste"],
    queryFn: () => agenceService.getAgences({ statut_global: "active" }),
    staleTime: 5 * 60 * 1000,
  });

  const agences = agencesData.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.adresse?.toLowerCase().includes(q)
    );
  });

  return (
    <PublicLayout>
      {/* Header */}
      <div className="bg-gradient-to-br from-[#135bec] to-blue-800 text-white py-14 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Nos Agences Partenaires
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto mb-8">
            Découvrez toutes les compagnies de transport qui font confiance à NJILA pour digitaliser leurs réservations.
          </p>

          {/* Barre de recherche */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une agence..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white text-slate-800 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Compteur */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500 font-medium">
            {isLoading ? "Chargement..." : `${agences.length} agence${agences.length > 1 ? "s" : ""} trouvée${agences.length > 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Skeleton loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white border border-slate-100 animate-pulse">
                <div className="aspect-video bg-slate-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                  <div className="h-3 bg-slate-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Liste agences */}
        {!isLoading && agences.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-semibold text-lg">Aucune agence trouvée</p>
            <p className="text-sm mt-1">Essayez un autre terme de recherche</p>
          </div>
        )}

        {!isLoading && agences.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agences.map((agence, index) => {
              const badge       = getBadge(index);
              const fallbackImg = AGENCY_FALLBACKS[index % AGENCY_FALLBACKS.length];

              return (
                <div
                  key={agence.id_agence}
                  onClick={() => navigate(`/agences/${agence.id_agence}`)}
                  className="group cursor-pointer rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:-translate-y-1"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/agences/${agence.id_agence}`)}
                  aria-label={`Voir le profil de ${agence.name}`}
                >
                  {/* Image */}
                  <div className="relative overflow-hidden aspect-video bg-gradient-to-br from-slate-100 to-blue-50">
                    {agence.logo_image ? (
                      <img
                        src={agence.logo_image}
                        alt={agence.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "block";
                        }}
                      />
                    ) : null}
                    <img
                      src={fallbackImg}
                      alt={agence.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      style={{ display: agence.logo_image ? "none" : "block" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    <div className="absolute top-3 left-3">
                      <span className={`${badge.bg} text-white text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest`}>
                        {badge.type}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="bg-white/90 backdrop-blur text-[#135bec] text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        Voir le profil
                      </span>
                    </div>

                    <div className="absolute bottom-4 left-4">
                      <h4 className="text-white font-extrabold text-xl drop-shadow">{agence.name}</h4>
                    </div>
                  </div>

                  {/* Détails */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        {agence.adresse && (
                          <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
                            <MapPin className="w-4 h-4 text-slate-300 flex-shrink-0" />
                            {agence.adresse}
                          </p>
                        )}
                        {agence.telephone && (
                          <p className="text-sm text-slate-500 flex items-center gap-1">
                            <Phone className="w-4 h-4 text-slate-300 flex-shrink-0" />
                            {agence.telephone}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {agence.nb_filiales != null && (
                          <span className="text-[10px] font-bold text-[#135bec] bg-blue-50 px-2 py-0.5 rounded-full">
                            {agence.nb_filiales} filiale{agence.nb_filiales > 1 ? "s" : ""}
                          </span>
                        )}
                        {agence.nb_bus != null && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {agence.nb_bus} bus
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/recherche");
                        }}
                        className="flex-1 text-sm font-bold text-[#135bec] border border-[#135bec]/20 hover:bg-[#135bec] hover:text-white py-2 rounded-xl transition-all"
                      >
                        Voir les voyages →
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/agences/${agence.id_agence}`);
                        }}
                        className="flex-1 text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-700 hover:text-white hover:border-slate-700 py-2 rounded-xl transition-all"
                      >
                        Voir le profil
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}