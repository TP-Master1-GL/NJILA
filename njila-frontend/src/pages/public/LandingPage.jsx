import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Facebook, Twitter, Instagram } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import NjilaLogo from "../../components/ui/NjilaLogo";
import { useBookingStore } from "../../store/bookingStore";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import { agenceService } from "../../services/agenceService";
import { IMAGES } from "../../assets/images";

const VILLES = [
  "Douala", "Yaoundé", "Bafoussam", "Garoua", "Ngaoundéré",
  "Bamenda", "Kribi", "Bertoua", "Ebolowa", "Maroua",
];

const POPULAR_CITIES = [
  { nom: "Douala",     img: IMAGES.DOUALA,     desc: "Hub économique" },
  { nom: "Yaoundé",    img: IMAGES.YAOUNDE,    desc: "Capitale politique" },
  { nom: "Bafoussam",  img: IMAGES.BAFOUSSAM,  desc: "Capitale de l'Ouest" },
  { nom: "Garoua",     img: IMAGES.GAROUA,     desc: "Nord Cameroun" },
  { nom: "Ngaoundéré", img: IMAGES.NGAOUNDERE, desc: "Adamaoua" },
];

const FEATURES = [
  {
    icon: "airline_seat_recline_extra",
    title: "Sélection de siège en temps réel",
    desc: "Choisissez exactement votre place. Aucune surprise à l'embarquement.",
    color: "bg-[#135bec]/10 text-[#135bec]",
    tags: [],
  },
  {
    icon: "payments",
    title: "Mobile Money Ready",
    desc: "Payez en toute sécurité avec MTN ou Orange Money. Confirmation instantanée.",
    color: "bg-emerald-50 text-emerald-600",
    tags: ["MTN MoMo", "Orange Money"],
  },
  {
    icon: "qr_code_2",
    title: "Billets Électroniques",
    desc: "Votre billet avec numéro unique, stocké sur dashboard et envoyé par SMS.",
    color: "bg-[#135bec]/10 text-[#135bec]",
    tags: [],
  },
];

const STATS = [
  { value: "50+",  label: "Agences partenaires", icon: "business"       },
  { value: "10k+", label: "Voyages par mois",    icon: "directions_bus" },
  { value: "98%",  label: "Satisfaction client",  icon: "thumb_up"       },
  { value: "24/7", label: "Support disponible",  icon: "headset_mic"    },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Recherchez votre trajet",  desc: "Sélectionnez votre ville de départ, d'arrivée et la date souhaitée.", icon: "search" },
  { step: "02", title: "Choisissez votre place",   desc: "Visualisez le plan du bus et sélectionnez votre siège préféré en temps réel.", icon: "airline_seat_recline_extra" },
  { step: "03", title: "Payez avec Mobile Money",  desc: "Réglez en toute sécurité avec MTN MoMo ou Orange Money en quelques secondes.", icon: "payments" },
  { step: "04", title: "Recevez votre billet",     desc: "Votre billet électronique avec numéro unique vous est envoyé par email et SMS.", icon: "qr_code_2" },
];

// Badge couleur selon le nombre de filiales / bus
const getBadge = (agence, index) => {
  const badges = [
    { type: "PREMIUM", bg: "bg-emerald-500" },
    { type: "EXPRESS", bg: "bg-blue-500"    },
    { type: "ECONOMY", bg: "bg-amber-500"   },
  ];
  return badges[index % badges.length];
};

// Fallback image si logo_image absent
const AGENCY_FALLBACKS = [IMAGES.AGENCY_1, IMAGES.AGENCY_2, IMAGES.AGENCY_3];

export default function LandingPage() {
  const navigate = useNavigate();
  const { setRecherche } = useBookingStore();
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useAuth();
  const [form, setForm] = useState({
    origine: "Douala",
    destination: "Yaoundé",
    date: "",
    nombrePlaces: 1,
  });
  const [navOpen, setNavOpen] = useState(false);

  // ── Chargement des agences actives depuis le backend ──────────────
  const { data: agencesData, isLoading: agencesLoading } = useQuery({
    queryKey: ["agences-landing"],
    queryFn: () => agenceService.getAgences({ statut_global: "active" }),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  // On prend les 3 premières agences actives pour la section partenaires
  const agences = (agencesData || []).slice(0, 3);

  const handleSearch = (e) => {
    e.preventDefault();
    setRecherche(form);
    navigate("/recherche");
  };

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <NjilaLogo size="md" />

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/recherche" className="text-sm font-medium text-slate-600 hover:text-[#135bec] transition-colors">
                Trajets
              </Link>
              <a href="#agences" className="text-sm font-medium text-slate-600 hover:text-[#135bec] transition-colors">
                Agences
              </a>
              <a href="#comment" className="text-sm font-medium text-slate-600 hover:text-[#135bec] transition-colors">
                Comment ça marche
              </a>
              <a href="#aide" className="text-sm font-medium text-slate-600 hover:text-[#135bec] transition-colors">
                Aide
              </a>
            </div>

            {/* Auth desktop */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate("/voyageur")}
                    className="text-sm font-semibold text-[#135bec] hover:underline"
                  >
                    Mon espace
                  </button>
                  <button
                    onClick={logout}
                    className="text-sm font-medium text-slate-500 hover:text-red-500 transition-colors"
                  >
                    Déconnexion
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-slate-600 hover:text-[#135bec] px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Se connecter
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-bold bg-[#135bec] hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition-colors shadow-sm shadow-[#135bec]/30"
                  >
                    S'inscrire gratuitement
                  </Link>
                </>
              )}
            </div>

            {/* Mobile burger */}
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="md:hidden p-2 text-[#135bec] hover:bg-slate-50 rounded-lg transition-colors"
            >
              <span className="material-icons">{navOpen ? "close" : "menu"}</span>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-white border-t border-slate-100 ${
            navOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-4 py-6 space-y-4">
            <Link
              to="/recherche"
              onClick={() => setNavOpen(false)}
              className="flex items-center gap-3 text-sm font-semibold text-slate-700 hover:text-[#135bec] p-2 rounded-lg hover:bg-slate-50 transition-all"
            >
              <span className="material-icons text-xl text-slate-400">directions_bus</span> Trajets
            </Link>
            <a
              href="#agences"
              onClick={() => setNavOpen(false)}
              className="flex items-center gap-3 text-sm font-semibold text-slate-700 hover:text-[#135bec] p-2 rounded-lg hover:bg-slate-50 transition-all"
            >
              <span className="material-icons text-xl text-slate-400">business</span> Agences
            </a>
            <a
              href="#comment"
              onClick={() => setNavOpen(false)}
              className="flex items-center gap-3 text-sm font-semibold text-slate-700 hover:text-[#135bec] p-2 rounded-lg hover:bg-slate-50 transition-all"
            >
              <span className="material-icons text-xl text-slate-400">help_outline</span> Comment ça marche
            </a>
            <div className="pt-4 border-t border-slate-100 space-y-3">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => { navigate("/voyageur"); setNavOpen(false); }}
                    className="w-full flex items-center gap-3 text-sm font-bold text-[#135bec] p-2"
                  >
                    <span className="material-icons">dashboard</span> Mon espace
                  </button>
                  <button
                    onClick={() => { logout(); setNavOpen(false); }}
                    className="w-full flex items-center gap-3 text-sm font-bold text-red-500 p-2"
                  >
                    <span className="material-icons">logout</span> Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setNavOpen(false)}
                    className="block w-full text-center text-sm font-bold text-slate-700 py-3 rounded-xl border border-slate-200"
                  >
                    Se connecter
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setNavOpen(false)}
                    className="block w-full text-center text-sm font-bold bg-[#135bec] text-white py-4 rounded-xl shadow-lg shadow-[#135bec]/20"
                  >
                    S'inscrire gratuitement
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 pt-16 pb-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[500px] h-[500px] bg-[#135bec]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 bg-[#135bec]/10 text-[#135bec] px-4 py-1.5 rounded-full text-sm font-semibold">
              <span className="material-icons text-base">verified</span>
              La plateforme #1 du transport interurbain au Cameroun
            </div>
          </div>

          {/* Titre */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
              Voyagez à travers le{" "}
              <span className="text-[#135bec] relative">
                Cameroun
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10 C 75 3, 225 3, 298 10" stroke="#135bec" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.4" />
                </svg>
              </span>{" "}
              avec facilité
            </h1>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
              Réservation instantanée pour Douala, Yaoundé et au-delà. Évitez les queues aux agences et sécurisez votre siège en quelques secondes.
            </p>
          </div>

          {/* Formulaire recherche */}
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                {/* Origine */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Origine</label>
                  <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">location_on</span>
                    <select
                      value={form.origine}
                      onChange={e => setForm(f => ({ ...f, origine: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-[#135bec] text-sm font-medium appearance-none"
                    >
                      {VILLES.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                {/* Destination */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Destination</label>
                  <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">near_me</span>
                    <select
                      value={form.destination}
                      onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-[#135bec] text-sm font-medium appearance-none"
                    >
                      {VILLES.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                {/* Date */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Date de voyage</label>
                  <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">event</span>
                    <input
                      type="date"
                      value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-[#135bec] text-sm"
                    />
                  </div>
                </div>
                {/* Bouton */}
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full h-[52px] bg-[#135bec] hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-[#135bec]/30 flex items-center justify-center gap-2 text-sm"
                  >
                    <span className="material-icons text-xl">search</span>
                    Rechercher
                  </button>
                </div>
              </div>

              {/* Badges paiement */}
              <div className="flex items-center justify-center gap-6 pt-3 border-t border-slate-100 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-white text-[8px] font-black">M</span>
                  </div>
                  <span className="font-semibold text-yellow-600">MTN MoMo</span>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[8px] font-black">O</span>
                  </div>
                  <span className="font-semibold text-orange-600">Orange Money</span>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="material-icons text-emerald-500 text-base">verified_user</span>
                  <span className="font-semibold text-emerald-600">Paiement sécurisé</span>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Bus animé */}
        <div className="relative w-full mt-8 h-20 overflow-hidden pointer-events-none select-none">
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-slate-300/20 rounded-t-2xl" />
          <div
            className="absolute bottom-2 left-0 flex gap-8 animate-road-dash"
            style={{ width: "200%" }}
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-12 h-1 bg-[#135bec]/25 rounded-full" />
            ))}
          </div>
          <div className="absolute bottom-5 animate-drive-bus">
            <svg viewBox="0 0 130 48" className="w-40 h-auto drop-shadow-2xl" fill="none">
              <rect x="2"   y="10" width="120" height="30" rx="7" fill="#135bec" />
              <rect x="8"   y="3"  width="108" height="13" rx="4" fill="#0d47c7" />
              <rect x="15"  y="13" width="17"  height="11" rx="2" fill="#bfdbfe" opacity="0.9" />
              <rect x="38"  y="13" width="17"  height="11" rx="2" fill="#bfdbfe" opacity="0.9" />
              <rect x="61"  y="13" width="17"  height="11" rx="2" fill="#bfdbfe" opacity="0.9" />
              <rect x="84"  y="13" width="17"  height="11" rx="2" fill="#bfdbfe" opacity="0.9" />
              <rect x="102" y="20" width="14"  height="18" rx="2" fill="#1e40af" />
              <rect x="2"   y="27" width="120" height="3"  rx="1" fill="#fde68a" />
              <circle cx="24" cy="40" r="8"   fill="#1e293b" />
              <circle cx="24" cy="40" r="3.5" fill="#94a3b8" />
              <circle cx="96" cy="40" r="8"   fill="#1e293b" />
              <circle cx="96" cy="40" r="3.5" fill="#94a3b8" />
              <rect x="114" y="14" width="7" height="5" rx="1" fill="#fef08a" />
              <text x="35" y="24" fontFamily="Arial" fontSize="9" fill="white" fontWeight="bold" letterSpacing="1">NJILA</text>
            </svg>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────────────────── */}
      <section className="py-12 bg-[#135bec]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(({ value, label, icon }) => (
              <div key={label} className="text-center">
                <span className="material-icons text-white/60 text-3xl mb-2 block">{icon}</span>
                <p className="text-3xl md:text-4xl font-extrabold text-white">{value}</p>
                <p className="text-blue-200 text-sm mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VILLES POPULAIRES ───────────────────────────────────────────── */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3">Villes populaires</h2>
            <p className="text-slate-500 text-lg">Découvrez les destinations les plus demandées</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {POPULAR_CITIES.map(({ nom, img, desc }) => (
              <button
                key={nom}
                onClick={() => {
                  setForm(f => ({ ...f, destination: nom }));
                  document.querySelector("form")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group relative overflow-hidden rounded-2xl aspect-[3/4] cursor-pointer"
              >
                <img src={img} alt={nom} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white text-left">
                  <p className="font-bold text-lg leading-tight">{nom}</p>
                  <p className="text-white/70 text-xs mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3">Pourquoi choisir NJILA ?</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Une expérience de voyage simplifiée du début à la fin
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map(({ icon, title, desc, color, tags }) => (
              <div
                key={title}
                className="group p-8 rounded-2xl border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default"
              >
                <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center mb-6`}>
                  <span className="material-icons text-3xl">{icon}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
                <p className="text-slate-500 leading-relaxed">{desc}</p>
                {tags.length > 0 && (
                  <div className="flex gap-2 mt-4">
                    <span className="px-2 py-1 bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase tracking-widest rounded">
                      {tags[0]}
                    </span>
                    <span className="px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded">
                      {tags[1]}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AGENCES PARTENAIRES (chargées depuis le backend) ─────────────── */}
      <section id="agences" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
                Nos Agences Partenaires
              </h2>
              <p className="text-slate-500">
                Voyagez avec les entreprises de transport les plus fiables du Cameroun
              </p>
            </div>
            <Link
              to="/recherche"
              className="hidden md:flex items-center gap-1 text-[#135bec] font-semibold hover:underline text-sm"
            >
              Rechercher un voyage <span className="material-icons text-sm">arrow_forward</span>
            </Link>
          </div>

          {/* ── Skeleton loading ── */}
          {agencesLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl overflow-hidden bg-white border border-slate-100 animate-pulse">
                  <div className="aspect-video bg-slate-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Agences chargées ── */}
          {!agencesLoading && agences.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {agences.map((agence, index) => {
                const badge = getBadge(agence, index);
                const fallbackImg = AGENCY_FALLBACKS[index % AGENCY_FALLBACKS.length];

                return (
                  <div
                    key={agence.id_agence}
                    className="group cursor-pointer rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100"
                  >
                    {/* Image / Logo */}
                    <div className="relative overflow-hidden aspect-video bg-gradient-to-br from-slate-100 to-blue-50">
                      {agence.logo_image ? (
                        <img
                          src={agence.logo_image}
                          alt={agence.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={e => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      {/* Fallback image statique */}
                      <img
                        src={fallbackImg}
                        alt={agence.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        style={{ display: agence.logo_image ? "none" : "block" }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      {/* Badge type */}
                      <div className="absolute top-3 left-3">
                        <span className={`${badge.bg} text-white text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest`}>
                          {badge.type}
                        </span>
                      </div>
                      {/* Nom agence */}
                      <div className="absolute bottom-4 left-4">
                        <h4 className="text-white font-extrabold text-xl drop-shadow">{agence.name}</h4>
                      </div>
                    </div>

                    {/* Détail agence */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {agence.adresse && (
                            <p className="text-sm text-slate-500 flex items-center gap-1 truncate">
                              <span className="material-icons text-slate-300 text-base flex-shrink-0">location_on</span>
                              {agence.adresse}
                            </p>
                          )}
                          {agence.telephone && (
                            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                              <span className="material-icons text-slate-300 text-base flex-shrink-0">phone</span>
                              {agence.telephone}
                            </p>
                          )}
                        </div>
                        {/* Compteurs filiales / bus */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
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

                      {/* CTA */}
                      <button
                        onClick={() => navigate("/recherche")}
                        className="mt-3 w-full text-sm font-bold text-[#135bec] border border-[#135bec]/20 hover:bg-[#135bec] hover:text-white py-2 rounded-xl transition-all"
                      >
                        Voir les voyages →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Aucune agence ── */}
          {!agencesLoading && agences.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <span className="material-icons text-5xl mb-3 block">business</span>
              <p className="font-medium">Aucune agence disponible pour le moment</p>
            </div>
          )}
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ───────────────────────────────────────────── */}
      <section id="comment" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3">Comment ça marche ?</h2>
            <p className="text-slate-500 text-lg">Réservez votre billet en 4 étapes simples</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-gradient-to-r from-[#135bec]/20 via-[#135bec] to-[#135bec]/20" />
            {HOW_IT_WORKS.map(({ step, title, desc, icon }) => (
              <div key={step} className="text-center relative">
                <div className="w-16 h-16 bg-[#135bec] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#135bec]/30 relative z-10">
                  <span className="material-icons text-white text-2xl">{icon}</span>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-white border-2 border-[#135bec] rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-black text-[#135bec]">{step}</span>
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-[#135bec] to-blue-800 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
          <img src={IMAGES.BUS_MODERN} alt="" className="w-96 h-auto object-cover" />
        </div>
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="text-white max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
              Évitez la queue à l'agence.<br />
              <span className="text-yellow-300">Réservez depuis votre canapé.</span>
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed mb-6">
              NJILA simplifie le transport interurbain au Cameroun. Que vous partiez pour une réunion d'affaires ou rendre visite à votre famille, votre siège est garanti avant même d'arriver à l'agence.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                "Confirmation instantanée",
                "Paiement 100% sécurisé",
                "Billet électronique immédiat",
              ].map(txt => (
                <div key={txt} className="flex items-center gap-2 text-sm text-blue-100">
                  <span className="material-icons text-emerald-400 text-base">check_circle</span>
                  {txt}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 flex-shrink-0">
            <button
              onClick={() => navigate("/register")}
              className="bg-white text-[#135bec] font-extrabold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors shadow-xl text-base"
            >
              Commencer maintenant →
            </button>
            <button
              onClick={() => navigate("/recherche")}
              className="border-2 border-white/40 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors text-base"
            >
              Rechercher un voyage
            </button>
          </div>
        </div>
      </section>

      {/* ── AIDE ────────────────────────────────────────────────────────── */}
      <section id="aide" className="py-20 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="text-white">
            <h2 className="text-3xl font-extrabold mb-4">Besoin d'aide ?</h2>
            <p className="text-slate-400 mb-8">
              Notre équipe est disponible 24h/24 pour vous accompagner dans vos réservations.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "help_outline", label: "FAQ",                href: "#"                        },
                { icon: "headset_mic", label: "Centre d'assistance", href: "#"                        },
                { icon: "phone",       label: "+237 650 123 456",    href: "tel:+237650123456"        },
                { icon: "email",       label: "contact@njila.cm",    href: "mailto:contact@njila.cm"  },
              ].map(({ icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-xl transition-colors text-sm font-medium text-white"
                >
                  <span className="material-icons text-[#135bec]">{icon}</span>
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div className="relative">
            <img
              src={IMAGES.BUS_HIGHWAY}
              alt="Support NJILA"
              className="w-full rounded-2xl object-cover h-64 opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-transparent rounded-2xl" />
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <NjilaLogo size="md" white />
            <p className="text-sm mt-4 leading-relaxed">
              La plateforme de référence pour digitaliser le transport interurbain au Cameroun.
            </p>
            <div className="flex gap-3 mt-6">
              {[Facebook, Twitter, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 bg-slate-800 hover:bg-[#135bec] rounded-full flex items-center justify-center transition-colors"
                >
                  <Icon className="w-4 h-4 text-white" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Liens rapides</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/recherche" className="hover:text-white transition-colors">Rechercher un trajet</Link></li>
              <li><a href="#agences"    className="hover:text-white transition-colors">Nos agences</a></li>
              <li><a href="#comment"    className="hover:text-white transition-colors">Comment ça marche</a></li>
              <li><a href="#aide"       className="hover:text-white transition-colors">Aide & support</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#aide"                  className="hover:text-white transition-colors">Centre d'aide</a></li>
              <li><a href="mailto:contact@njila.cm" className="hover:text-white transition-colors">Nous contacter</a></li>
              <li><a href="#"                       className="hover:text-white transition-colors">Politique de remboursement</a></li>
              <li><a href="#"                       className="hover:text-white transition-colors">Conditions d'utilisation</a></li>
              <li><a href="#"                       className="hover:text-white transition-colors">Confidentialité</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Trajets populaires</h4>
            <ul className="space-y-2 text-sm">
              {[
                ["Douala", "Yaoundé"],
                ["Yaoundé", "Bafoussam"],
                ["Douala", "Kribi"],
                ["Yaoundé", "Garoua"],
                ["Douala", "Bamenda"],
              ].map(([o, d]) => (
                <li key={`${o}-${d}`}>
                  <button
                    onClick={() => {
                      setRecherche({ origine: o, destination: d, date: "", nombrePlaces: 1 });
                      navigate("/recherche");
                    }}
                    className="hover:text-white transition-colors text-left"
                  >
                    {o} → {d}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 py-5 text-center text-xs flex items-center justify-center gap-4 flex-wrap">
          <a href="#" className="hover:text-white transition-colors">Conditions Générales</a>
          <span className="text-slate-700">|</span>
          <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
          <span className="text-slate-700">|</span>
          <span>© NJILA 2026 | Cameroun</span>
        </div>
      </footer>
    </div>
  );
}
