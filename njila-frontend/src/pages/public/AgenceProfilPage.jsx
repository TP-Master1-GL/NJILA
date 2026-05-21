import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fleetService } from "../../services/fleetService";
import NjilaLogo from "../../components/ui/NjilaLogo";
import { useBookingStore } from "../../store/bookingStore";

// ── Couleur selon statut voyage ───────────────────────────────────────────────
const STATUS_CONFIG = {
  programme: { label: "Programmé",  bg: "bg-blue-50",    text: "text-blue-600",   dot: "bg-blue-500"   },
  confirme:  { label: "Confirmé",   bg: "bg-emerald-50", text: "text-emerald-600",dot: "bg-emerald-500"},
  en_cours:  { label: "En cours",   bg: "bg-amber-50",   text: "text-amber-600",  dot: "bg-amber-500"  },
  termine:   { label: "Terminé",    bg: "bg-slate-100",  text: "text-slate-500",  dot: "bg-slate-400"  },
  annule:    { label: "Annulé",     bg: "bg-red-50",     text: "text-red-500",    dot: "bg-red-400"    },
  retarde:   { label: "Retardé",    bg: "bg-orange-50",  text: "text-orange-600", dot: "bg-orange-400" },
};

// ── Filtre statut voyage ──────────────────────────────────────────────────────
const STATUTS = [
  { value: "",           label: "Tous"       },
  { value: "programme",  label: "Programmés" },
  { value: "en_cours",   label: "En cours"   },
  { value: "confirme",   label: "Confirmés"  },
  { value: "termine",    label: "Terminés"   },
  { value: "annule",     label: "Annulés"    },
  { value: "retarde",    label: "Retardés"   },
];

// ── Étoiles ───────────────────────────────────────────────────────────────────
function Etoiles({ note, max = 5 }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`material-icons text-base ${
            i < Math.round(note) ? "text-amber-400" : "text-slate-200"
          }`}
        >
          star
        </span>
      ))}
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 bg-slate-100 rounded ${i === 0 ? "w-2/3" : i === lines - 1 ? "w-1/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AgenceProfilPage() {
  const { id_agence } = useParams();
  const navigate      = useNavigate();
  const { setRecherche } = useBookingStore();

  // Filtres locaux
  const [statutVoyage,  setStatutVoyage]  = useState("");
  const [villeDepart,   setVilleDepart]   = useState("");
  const [villeArrivee,  setVilleArrivee]  = useState("");
  const [onglet,        setOnglet]        = useState("voyages"); // voyages | trajets | bus | filiales | avis

  // ── Fetch profil ──────────────────────────────────────────────────────────
  const { data: profil, isLoading, isError } = useQuery({
    queryKey: ["agence-profil", id_agence, statutVoyage, villeDepart, villeArrivee],
    queryFn: () =>
      fleetService.getAgenceProfil(id_agence, {
        statut_voyage:  statutVoyage  || undefined,
        ville_depart:   villeDepart   || undefined,
        ville_arrivee:  villeArrivee  || undefined,
      }),
    enabled: !!id_agence,
    staleTime: 2 * 60 * 1000,
  });

  // ── Villes disponibles depuis les filiales ────────────────────────────────
  const villes = [...new Set((profil?.filiales || []).map(f => f.ville))].sort();

  // ── Réserver depuis un voyage ─────────────────────────────────────────────
  const handleReserver = (voyage) => {
    setRecherche({
      origine:      voyage.origine,
      destination:  voyage.destination,
      date:         voyage.date_heure_depart?.slice(0, 10),
      nombrePlaces: 1,
    });
    navigate("/recherche");
  };

  // ── États de chargement / erreur ──────────────────────────────────────────
  if (isLoading) return <PageSkeleton />;

  if (isError || !profil) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-400">
        <span className="material-icons text-6xl">error_outline</span>
        <p className="font-medium text-lg">Agence introuvable</p>
        <button
          onClick={() => navigate(-1)}
          className="text-[#135bec] font-semibold hover:underline text-sm"
        >
          ← Retour
        </button>
      </div>
    );
  }

  const { agence, resume, filiales, bus, trajets, voyages, annonces, avis } = profil;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── NAVBAR SIMPLE ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <span className="material-icons">arrow_back</span>
            </button>
            <NjilaLogo size="sm" />
          </div>
          <button
            onClick={() => navigate("/recherche")}
            className="hidden md:flex items-center gap-2 bg-[#135bec] text-white text-sm font-bold px-5 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            <span className="material-icons text-base">search</span>
            Rechercher un voyage
          </button>
        </div>
      </nav>

      {/* ── HERO AGENCE ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#135bec] to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">

            {/* Logo */}
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white/30">
              {agence.logo ? (
                <img
                  src={agence.logo}
                  alt={agence.nom}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = "none"; }}
                />
              ) : (
                <span className="material-icons text-white text-4xl">directions_bus</span>
              )}
            </div>

            {/* Infos principales */}
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-3xl md:text-4xl font-extrabold">{agence.nom}</h1>
                {agence.statut === "active" && (
                  <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                    Actif
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-blue-100 text-sm">
                {agence.adresse && (
                  <span className="flex items-center gap-1">
                    <span className="material-icons text-base">location_on</span>
                    {agence.adresse}
                  </span>
                )}
                {agence.telephone && (
                  <a href={`tel:${agence.telephone}`} className="flex items-center gap-1 hover:text-white transition-colors">
                    <span className="material-icons text-base">phone</span>
                    {agence.telephone}
                  </a>
                )}
                {agence.email && (
                  <a href={`mailto:${agence.email}`} className="flex items-center gap-1 hover:text-white transition-colors">
                    <span className="material-icons text-base">email</span>
                    {agence.email}
                  </a>
                )}
              </div>
            </div>

            {/* Note moyenne */}
            {resume.note_moyenne > 0 && (
              <div className="bg-white/15 backdrop-blur rounded-2xl px-5 py-4 text-center flex-shrink-0 border border-white/20">
                <p className="text-4xl font-extrabold">{resume.note_moyenne}</p>
                <Etoiles note={resume.note_moyenne} />
                <p className="text-xs text-blue-200 mt-1">{resume.nb_avis} avis</p>
              </div>
            )}
          </div>

          {/* ── Résumé chiffré ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { icon: "store",         label: "Filiales",       value: resume.nb_filiales        },
              { icon: "directions_bus",label: "Bus",            value: resume.nb_bus             },
              { icon: "route",         label: "Trajets actifs", value: resume.nb_trajets         },
              { icon: "confirmation_number", label: "Voyages",  value: resume.nb_voyages_total   },
            ].map(({ icon, label, value }) => (
              <div key={label} className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 border border-white/10 text-center">
                <span className="material-icons text-blue-200 text-xl">{icon}</span>
                <p className="text-2xl font-extrabold mt-0.5">{value ?? "—"}</p>
                <p className="text-blue-200 text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ONGLETS ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-none py-1">
            {[
              { key: "voyages",  label: "Voyages",  icon: "confirmation_number", count: voyages?.length  },
              { key: "trajets",  label: "Trajets",  icon: "route",               count: trajets?.length  },
              { key: "bus",      label: "Bus",       icon: "directions_bus",      count: bus?.length      },
              { key: "filiales", label: "Filiales",  icon: "store",               count: filiales?.length },
              { key: "annonces", label: "Annonces",  icon: "campaign",            count: annonces?.length },
              { key: "avis",     label: "Avis",      icon: "star",                count: avis?.liste?.length },
            ].map(({ key, label, icon, count }) => (
              <button
                key={key}
                onClick={() => setOnglet(key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                  onglet === key
                    ? "border-[#135bec] text-[#135bec]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="material-icons text-base">{icon}</span>
                {label}
                {count > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    onglet === key ? "bg-[#135bec] text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENU PRINCIPAL ──────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ══════════════════ VOYAGES ══════════════════ */}
        {onglet === "voyages" && (
          <div>
            {/* Filtres */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6 flex flex-col md:flex-row gap-3">
              {/* Statut */}
              <div className="flex gap-2 flex-wrap flex-1">
                {STATUTS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setStatutVoyage(value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      statutVoyage === value
                        ? "bg-[#135bec] text-white border-[#135bec]"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:border-[#135bec] hover:text-[#135bec]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Villes */}
              <div className="flex gap-2 flex-shrink-0">
                <select
                  value={villeDepart}
                  onChange={e => setVilleDepart(e.target.value)}
                  className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                >
                  <option value="">Départ — Toutes</option>
                  {villes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select
                  value={villeArrivee}
                  onChange={e => setVilleArrivee(e.target.value)}
                  className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#135bec]"
                >
                  <option value="">Arrivée — Toutes</option>
                  {villes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Liste voyages */}
            {voyages?.length === 0 ? (
              <EmptyState icon="confirmation_number" message="Aucun voyage pour ces critères" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {voyages?.map((v) => {
                  const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.programme;
                  const dateDepart = new Date(v.date_heure_depart);
                  return (
                    <div
                      key={v.id_voyage}
                      className="bg-white rounded-2xl border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                    >
                      {/* Header statut */}
                      <div className={`${cfg.bg} px-4 py-2 flex items-center justify-between`}>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</span>
                        </div>
                        <span className={`text-xs font-bold ${cfg.text}`}>
                          {v.type_voyage === "vip" ? "⭐ VIP" : "Standard"}
                        </span>
                      </div>

                      <div className="p-4">
                        {/* Trajet */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="text-center">
                            <p className="text-lg font-extrabold text-slate-900">{v.origine}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[80px]">{v.filiale_depart}</p>
                          </div>
                          <div className="flex-1 flex flex-col items-center gap-0.5">
                            <span className="material-icons text-[#135bec] text-xl">arrow_forward</span>
                            <p className="text-[10px] text-slate-400">
                              {v.bus_immatriculation}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-extrabold text-slate-900">{v.destination}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[80px]">{v.filiale_arrivee}</p>
                          </div>
                        </div>

                        {/* Date & heure */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                          <span className="material-icons text-base text-slate-300">schedule</span>
                          <span>
                            {dateDepart.toLocaleDateString("fr-FR", {
                              weekday: "short", day: "numeric", month: "short",
                            })}
                            {" à "}
                            {dateDepart.toLocaleTimeString("fr-FR", {
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Prix & places */}
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-2xl font-extrabold text-[#135bec]">
                              {parseInt(v.prix).toLocaleString("fr-FR")}
                              <span className="text-sm font-bold text-slate-400 ml-1">FCFA</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-400">Places dispo.</p>
                            <p className={`text-lg font-extrabold ${
                              v.places_disponibles === 0 ? "text-red-500" :
                              v.places_disponibles <= 5 ? "text-amber-500" : "text-emerald-600"
                            }`}>
                              {v.places_disponibles}
                            </p>
                          </div>
                        </div>

                        {/* Bouton réservation */}
                        {v.status === "programme" && v.places_disponibles > 0 ? (
                          <button
                            onClick={() => handleReserver(v)}
                            className="w-full bg-[#135bec] hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                          >
                            Réserver ce voyage
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full bg-slate-100 text-slate-400 text-sm font-bold py-2.5 rounded-xl cursor-not-allowed"
                          >
                            {v.places_disponibles === 0 ? "Complet" : cfg.label}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ TRAJETS ══════════════════ */}
        {onglet === "trajets" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trajets?.length === 0
              ? <EmptyState icon="route" message="Aucun trajet disponible" />
              : trajets?.map((t) => (
                <div key={t.id_trajet} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="material-icons text-[#135bec] text-xl">route</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {t.ville_depart} → {t.ville_arrivee}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {t.filiale_depart} → {t.filiale_arrivee}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="material-icons text-base text-slate-300">straighten</span>
                      {t.distance_km} km
                    </span>
                    <button
                      onClick={() => {
                        setRecherche({ origine: t.ville_depart, destination: t.ville_arrivee, date: "", nombrePlaces: 1 });
                        navigate("/recherche");
                      }}
                      className="text-xs font-bold text-[#135bec] hover:underline"
                    >
                      Rechercher →
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ══════════════════ BUS ══════════════════ */}
        {onglet === "bus" && (
          <div>
            {/* Résumé par état */}
            {resume.bus_par_etat && Object.keys(resume.bus_par_etat).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {Object.entries(resume.bus_par_etat).map(([etat, count]) => {
                  const cfg = {
                    disponible:  { label: "Disponibles",  color: "text-emerald-600", bg: "bg-emerald-50" },
                    en_voyage:   { label: "En voyage",    color: "text-blue-600",    bg: "bg-blue-50"    },
                    en_panne:    { label: "En panne",     color: "text-red-500",     bg: "bg-red-50"     },
                    maintenance: { label: "Maintenance",  color: "text-amber-600",   bg: "bg-amber-50"   },
                  }[etat] || { label: etat, color: "text-slate-500", bg: "bg-slate-50" };
                  return (
                    <div key={etat} className={`${cfg.bg} rounded-xl px-4 py-3 text-center`}>
                      <p className={`text-2xl font-extrabold ${cfg.color}`}>{count}</p>
                      <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bus?.length === 0
                ? <EmptyState icon="directions_bus" message="Aucun bus disponible" />
                : bus?.map((b) => {
                  const etatCfg = {
                    disponible:  { label: "Disponible",  dot: "bg-emerald-500", text: "text-emerald-600" },
                    en_voyage:   { label: "En voyage",   dot: "bg-blue-500",    text: "text-blue-600"    },
                    en_panne:    { label: "En panne",    dot: "bg-red-400",     text: "text-red-500"     },
                    maintenance: { label: "Maintenance", dot: "bg-amber-400",   text: "text-amber-600"   },
                  }[b.etat] || { label: b.etat, dot: "bg-slate-400", text: "text-slate-500" };
                  return (
                    <div key={b.id} className="bg-white rounded-2xl border border-slate-100 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-slate-900">{b.immatriculation}</p>
                          <p className="text-sm text-slate-400">{b.modele}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${etatCfg.dot}`} />
                          <span className={`text-xs font-bold ${etatCfg.text}`}>{etatCfg.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="material-icons text-slate-300 text-base">airline_seat_recline_extra</span>
                        <span>{b.capacite} places</span>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        )}

        {/* ══════════════════ FILIALES ══════════════════ */}
        {onglet === "filiales" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filiales?.length === 0
              ? <EmptyState icon="store" message="Aucune filiale" />
              : filiales?.map((f) => (
                <div key={f.id_filiale} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#135bec]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="material-icons text-[#135bec] text-xl">store</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{f.nom}</p>
                      <span className="text-[10px] font-black text-[#135bec] bg-blue-50 px-2 py-0.5 rounded-full">
                        {f.code}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <span className="material-icons text-base text-slate-300">location_on</span>
                      {f.ville} — {f.adresse}
                    </p>
                    {f.telephone && (
                      <a href={`tel:${f.telephone}`} className="flex items-center gap-1.5 hover:text-[#135bec] transition-colors">
                        <span className="material-icons text-base text-slate-300">phone</span>
                        {f.telephone}
                      </a>
                    )}
                    {f.email && (
                      <a href={`mailto:${f.email}`} className="flex items-center gap-1.5 hover:text-[#135bec] transition-colors">
                        <span className="material-icons text-base text-slate-300">email</span>
                        {f.email}
                      </a>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ══════════════════ ANNONCES ══════════════════ */}
        {onglet === "annonces" && (
          <div className="space-y-4">
            {annonces?.length === 0
              ? <EmptyState icon="campaign" message="Aucune annonce" />
              : annonces?.map((a) => {
                const typeCfg = {
                  retard:      { icon: "schedule",      color: "text-amber-600",  bg: "bg-amber-50",   label: "Retard"       },
                  annulation:  { icon: "cancel",        color: "text-red-500",    bg: "bg-red-50",     label: "Annulation"   },
                  promotion:   { icon: "local_offer",   color: "text-emerald-600",bg: "bg-emerald-50", label: "Promotion"    },
                  information: { icon: "info",          color: "text-blue-600",   bg: "bg-blue-50",    label: "Information"  },
                }[a.type] || { icon: "campaign", color: "text-slate-500", bg: "bg-slate-50", label: a.type };
                return (
                  <div key={a.id_annonce} className={`${typeCfg.bg} rounded-2xl p-5 border border-slate-100`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <span className={`material-icons ${typeCfg.color}`}>{typeCfg.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-black uppercase tracking-widest ${typeCfg.color}`}>
                            {typeCfg.label}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-400">
                            {new Date(a.date_publication).toLocaleDateString("fr-FR", {
                              day: "numeric", month: "long", year: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-slate-700 text-sm leading-relaxed">{a.message}</p>
                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                          <span className="material-icons text-base">directions_bus</span>
                          {a.voyage.origine} → {a.voyage.destination}
                          {" · "}
                          {new Date(a.voyage.depart).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        )}

        {/* ══════════════════ AVIS ══════════════════ */}
        {onglet === "avis" && (
          <div>
            {/* Résumé avis */}
            {avis?.note_moyenne > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6 flex flex-col md:flex-row gap-8 items-center">
                <div className="text-center flex-shrink-0">
                  <p className="text-6xl font-extrabold text-slate-900">{avis.note_moyenne}</p>
                  <Etoiles note={avis.note_moyenne} />
                  <p className="text-sm text-slate-400 mt-1">{avis.liste?.length} avis</p>
                </div>
                <div className="flex-1 w-full space-y-2">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const key = `${n}_etoile${n > 1 ? "s" : ""}`;
                    const count  = avis.repartition_notes?.[key] || 0;
                    const total  = avis.liste?.length || 1;
                    const pct    = Math.round((count / total) * 100);
                    return (
                      <div key={n} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 w-4">{n}</span>
                        <span className="material-icons text-amber-400 text-base">star</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Liste avis */}
            {avis?.liste?.length === 0
              ? <EmptyState icon="star" message="Aucun avis pour le moment" />
              : (
                <div className="space-y-4">
                  {avis?.liste?.map((a) => (
                    <div key={a.id_avis} className="bg-white rounded-2xl border border-slate-100 p-5">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#135bec]/10 flex items-center justify-center flex-shrink-0">
                            <span className="material-icons text-[#135bec] text-lg">person</span>
                          </div>
                          <div>
                            <Etoiles note={a.note} />
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(a.date_avis).toLocaleDateString("fr-FR", {
                                day: "numeric", month: "long", year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                          <span className="material-icons text-base text-slate-300">directions_bus</span>
                          {a.voyage.origine} → {a.voyage.destination}
                        </span>
                      </div>
                      <p className="text-slate-700 text-sm leading-relaxed">{a.commentaire}</p>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

      </div>

      {/* ── CTA FLOTTANT MOBILE ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-50 p-4 bg-white border-t border-slate-100 shadow-xl">
        <button
          onClick={() => navigate("/recherche")}
          className="w-full bg-[#135bec] text-white font-extrabold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#135bec]/30"
        >
          <span className="material-icons">search</span>
          Rechercher un voyage depuis {agence.nom}
        </button>
      </div>
      <div className="h-24 md:hidden" />
    </div>
  );
}

// ── Composants utilitaires ────────────────────────────────────────────────────

function EmptyState({ icon, message }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-300">
      <span className="material-icons text-6xl mb-3">{icon}</span>
      <p className="font-medium text-slate-400">{message}</p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      <div className="h-16 bg-white border-b border-slate-100" />
      <div className="bg-gradient-to-br from-[#135bec] to-blue-800 py-12 px-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white/20" />
            <div className="flex-1 space-y-2 py-2">
              <div className="h-6 bg-white/20 rounded w-48" />
              <div className="h-4 bg-white/10 rounded w-72" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-white/10 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}