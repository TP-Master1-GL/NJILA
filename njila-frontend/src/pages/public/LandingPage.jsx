import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MapPin, Calendar, Users, ArrowRight, Star, Shield, Clock, CheckCircle, Phone, Mail, Facebook, Twitter, Instagram, ChevronDown, Bus, Ticket, Smartphone, TrendingUp } from "lucide-react";
import NjilaLogo from "../../components/ui/NjilaLogo";
import { useBookingStore } from "../../store/bookingStore";
import { useAuthStore } from "../../store/authStore";
import { useAuth } from "../../hooks/useAuth";
import { IMAGES } from "../../assets/images";

const VILLES = ["Douala", "Yaoundé", "Bafoussam", "Garoua", "Ngaoundéré", "Bamenda", "Kribi", "Bertoua", "Ebolowa", "Maroua"];

const POPULAR_CITIES = [
  { nom: "Douala",      img: IMAGES.DOUALA,     desc: "Hub économique" },
  { nom: "Yaoundé",     img: IMAGES.YAOUNDE,    desc: "Capitale politique" },
  { nom: "Bafoussam",   img: IMAGES.BAFOUSSAM,  desc: "Capitale de l'Ouest" },
  { nom: "Garoua",      img: IMAGES.GAROUA,     desc: "Nord Cameroun" },
  { nom: "Ngaoundéré",  img: IMAGES.NGAOUNDERE, desc: "Adamaoua" },
];

const AGENCES = [
  { nom: "Finex Voyage",   img: IMAGES.AGENCY_1, route: "Douala – Yaoundé – Kribi",    note: 4.8, type: "PREMIUM",  badge: "bg-emerald-500" },
  { nom: "General Voyage", img: IMAGES.AGENCY_2, route: "Yaoundé – Bafoussam – West",  note: 4.5, type: "EXPRESS",  badge: "bg-blue-500"    },
  { nom: "Buca Voyages",   img: IMAGES.AGENCY_3, route: "Tous les grands hubs",         note: 4.2, type: "ECONOMY", badge: "bg-amber-500"   },
];

const FEATURES = [
  { icon: "airline_seat_recline_extra", title: "Sélection de siège en temps réel",  desc: "Choisissez exactement votre place. Aucune surprise à l'embarquement.", color: "bg-[#135bec]/10 text-[#135bec]",  tags: [] },
  { icon: "payments",                   title: "Mobile Money Ready",                  desc: "Payez en toute sécurité avec MTN ou Orange Money. Confirmation instantanée.", color: "bg-emerald-50 text-emerald-600",  tags: ["MTN MoMo", "Orange Money"] },
  { icon: "qr_code_2",                  title: "Billets Électroniques",               desc: "Votre billet avec numéro unique, stocké sur dashboard et envoyé par SMS.", color: "bg-[#135bec]/10 text-[#135bec]", tags: [] },
];

const STATS = [
  { value: "50+",    label: "Agences partenaires", icon: "business" },
  { value: "10k+",   label: "Voyages par mois",    icon: "directions_bus" },
  { value: "98%",    label: "Satisfaction client",  icon: "thumb_up" },
  { value: "24/7",   label: "Support disponible",  icon: "headset_mic" },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Recherchez votre trajet",    desc: "Sélectionnez votre ville de départ, d'arrivée et la date souhaitée.", icon: "search" },
  { step: "02", title: "Choisissez votre place",     desc: "Visualisez le plan du bus et sélectionnez votre siège préféré en temps réel.", icon: "airline_seat_recline_extra" },
  { step: "03", title: "Payez avec Mobile Money",    desc: "Réglez en toute sécurité avec MTN MoMo ou Orange Money en quelques secondes.", icon: "payments" },
  { step: "04", title: "Recevez votre billet",       desc: "Votre billet électronique avec numéro unique vous est envoyé par email et SMS.", icon: "qr_code_2" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { setRecherche } = useBookingStore();
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useAuth();
  const [form, setForm] = useState({ origine: "Douala", destination: "Yaoundé", date: "", nombrePlaces: 1 });
  const [navOpen, setNavOpen] = useState(false);

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
              <Link to="/recherche" className="text-sm font-medium text-slate-600 hover:text-[#135bec] transition-colors">Trajets</Link>
              <a href="#agences"    className="text-sm font-medium text-slate-600 hover:text-[#135bec] transition-colors">Agences</a>
              <a href="#comment"    className="text-sm font-medium text-slate-600 hover:text-[#135bec] transition-colors">Comment ça marche</a>
              <a href="#aide"       className="text-sm font-medium text-slate-600 hover:text-[#135bec] transition-colors">Aide</a>
            </div>

            {/* Auth */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">Bonjour, {user?.nom}</span>
                  <button onClick={logout} className="text-sm font-semibold text-[#135bec] hover:underline">Déconnexion</button>
                </div>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-[#135bec] px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                    Se connecter
                  </Link>
                  <Link to="/register" className="text-sm font-bold bg-[#135bec] hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition-colors shadow-sm shadow-[#135bec]/30">
                    S'inscrire gratuitement
                  </Link>
                </>
              )}
            </div>

            {/* Mobile burger */}
            <button onClick={() => setNavOpen(!navOpen)} className="md:hidden p-2">
              <span className="material-icons text-slate-600">{navOpen ? "close" : "menu"}</span>
            </button>
          </div>
        </div>
        {navOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
            <Link to="/recherche" className="block text-sm font-medium text-slate-700 py-2">Trajets</Link>
            <Link to="/login"     className="block text-sm font-medium text-slate-700 py-2">Se connecter</Link>
            <Link to="/register"  className="block w-full text-center bg-[#135bec] text-white font-bold py-3 rounded-lg">S'inscrire</Link>
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 pt-16 pb-32">
        {/* Déco background */}
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
                  <path d="M2 10 C 75 3, 225 3, 298 10" stroke="#135bec" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.4"/>
                </svg>
              </span>{" "}
              avec facilité
            </h1>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
              Réservation instantanée pour Douala, Yaoundé et au-delà. Évitez les queues aux agences et sécurisez votre siège en quelques secondes.
            </p>
          </div>

          {/* Formulaire de recherche */}
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                {/* Origine */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Origine</label>
                  <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">location_on</span>
                    <select value={form.origine} onChange={e => setForm(f => ({...f, origine: e.target.value}))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-[#135bec] text-sm font-medium appearance-none">
                      {VILLES.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                {/* Destination */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Destination</label>
                  <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">near_me</span>
                    <select value={form.destination} onChange={e => setForm(f => ({...f, destination: e.target.value}))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-[#135bec] text-sm font-medium appearance-none">
                      {VILLES.map(v => <option key={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                {/* Date */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Date de voyage</label>
                  <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">event</span>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-[#135bec] text-sm" />
                  </div>
                </div>
                {/* Bouton */}
                <div className="flex items-end">
                  <button type="submit" className="w-full h-[52px] bg-[#135bec] hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-[#135bec]/30 flex items-center justify-center gap-2 text-sm">
                    <span className="material-icons text-xl">search</span>
                    Rechercher
                  </button>
                </div>
              </div>
              {/* Badges paiement */}
              <div className="flex items-center justify-center gap-6 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center"><span className="text-white text-[8px] font-black">M</span></div>
                  <span className="font-semibold text-yellow-600">MTN MoMo</span>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center"><span className="text-white text-[8px] font-black">O</span></div>
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
              <button key={nom} onClick={() => { setForm(f => ({...f, destination: nom})); document.querySelector("form")?.scrollIntoView({behavior:"smooth"}); }}
                className="group relative overflow-hidden rounded-2xl aspect-[3/4] cursor-pointer">
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
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">Une expérience de voyage simplifiée du début à la fin</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map(({ icon, title, desc, color, tags }) => (
              <div key={title} className="group p-8 rounded-2xl border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
                <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center mb-6`}>
                  <span className="material-icons text-3xl">{icon}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
                <p className="text-slate-500 leading-relaxed">{desc}</p>
                {tags.length > 0 && (
                  <div className="flex gap-2 mt-4">
                    <span className="px-2 py-1 bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase tracking-widest rounded">{tags[0]}</span>
                    <span className="px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded">{tags[1]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AGENCES PARTENAIRES ─────────────────────────────────────────── */}
      <section id="agences" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">Nos Agences Partenaires</h2>
              <p className="text-slate-500">Voyagez avec les entreprises de transport les plus fiables du Cameroun</p>
            </div>
            <a href="#" className="hidden md:flex items-center gap-1 text-[#135bec] font-semibold hover:underline text-sm">
              Voir toutes les agences <span className="material-icons text-sm">arrow_forward</span>
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {AGENCES.map(({ nom, img, route, note, type, badge }) => (
              <div key={nom} className="group cursor-pointer rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100">
                <div className="relative overflow-hidden aspect-video">
                  <img src={img} alt={nom} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className={`${badge} text-white text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest`}>{type}</span>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <h4 className="text-white font-extrabold text-xl">{nom}</h4>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500">{route}</p>
                  <div className="flex items-center gap-1">
                    <span className="material-icons text-yellow-400 text-base">star</span>
                    <span className="text-sm font-bold text-slate-700">{note}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
            {/* Ligne de connexion */}
            <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-gradient-to-r from-[#135bec]/20 via-[#135bec] to-[#135bec]/20" />
            {HOW_IT_WORKS.map(({ step, title, desc, icon }, i) => (
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

      {/* ── CTA SECTION ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-[#135bec] to-blue-800 relative overflow-hidden">
        {/* Bus filigrane */}
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
              <div className="flex items-center gap-2 text-sm text-blue-100">
                <span className="material-icons text-emerald-400 text-base">check_circle</span>
                Confirmation instantanée
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-100">
                <span className="material-icons text-emerald-400 text-base">check_circle</span>
                Paiement 100% sécurisé
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-100">
                <span className="material-icons text-emerald-400 text-base">check_circle</span>
                Billet électronique immédiat
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 flex-shrink-0">
            <button onClick={() => navigate("/register")}
              className="bg-white text-[#135bec] font-extrabold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors shadow-xl text-base">
              Commencer maintenant →
            </button>
            <button onClick={() => navigate("/recherche")}
              className="border-2 border-white/40 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors text-base">
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
            <p className="text-slate-400 mb-8">Notre équipe est disponible 24h/24 pour vous accompagner dans vos réservations.</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "help_outline", label: "FAQ",               href: "#" },
                { icon: "headset_mic", label: "Centre d'assistance",href: "#" },
                { icon: "phone",       label: "+237 650 123 456",   href: "tel:+237650123456" },
                { icon: "email",       label: "contact@njila.cm",   href: "mailto:contact@njila.cm" },
              ].map(({ icon, label, href }) => (
                <a key={label} href={href}
                  className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-xl transition-colors text-sm font-medium text-white">
                  <span className="material-icons text-[#135bec]">{icon}</span>
                  {label}
                </a>
              ))}
            </div>
          </div>
          <div className="relative">
            <img src={IMAGES.BUS_HIGHWAY} alt="Support NJILA" className="w-full rounded-2xl object-cover h-64 opacity-60" />
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
                <a key={i} href="#" className="w-9 h-9 bg-slate-800 hover:bg-[#135bec] rounded-full flex items-center justify-center transition-colors">
                  <Icon className="w-4 h-4 text-white" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Liens rapides</h4>
            <ul className="space-y-2 text-sm">
              {["Rechercher un trajet", "Nos agences", "Offres spéciales", "Application mobile"].map(l => (
                <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Support</h4>
            <ul className="space-y-2 text-sm">
              {["Centre d'aide", "Nous contacter", "Politique de remboursement", "Conditions d'utilisation", "Confidentialité"].map(l => (
                <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Trajets populaires</h4>
            <ul className="space-y-2 text-sm">
              {["Douala → Yaoundé", "Yaoundé → Bafoussam", "Douala → Kribi", "Yaoundé → Garoua", "Douala → Bamenda"].map(l => (
                <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 py-5 text-center text-xs">
          <span>Conditions Générales</span>
          <span className="mx-4">|</span>
          <span>© NJILA 2026 | Cameroun</span>
        </div>
      </footer>
    </div>
  );
}