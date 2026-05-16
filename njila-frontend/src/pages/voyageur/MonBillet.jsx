import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  Printer,
  Share2,
  Loader,
  AlertCircle,
  Home,
  Ticket,
} from "lucide-react";
import { bookingService } from "../../services/bookingService";
import { useAuthStore } from "../../store/authStore";
import Button from "../../components/ui/Button";
import toast from "react-hot-toast";

// ─── Formatage date DD/MM/YYYY ───────────────────────────────────────────────
const formatDate = (raw) => {
  if (!raw) return "—";
  // ISO "2024-07-19" ou datetime "2024-07-19T14:30:00"
  const d = raw.slice(0, 10); // "YYYY-MM-DD"
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return raw;
  return `${day}/${m}/${y}`;
};

// ─── Initiales ville (3 lettres) ────────────────────────────────────────────
const abbr = (str) =>
  str && str !== "—" ? str.slice(0, 3).toUpperCase() : "—";

export default function MonBillet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // ── 1. Réservation ────────────────────────────────────────────────────────
  const {
    data: reservation,
    isLoading: isLoadingRes,
    isError: isErrorRes,
    refetch: refetchRes,
  } = useQuery({
    queryKey: ["reservation", id],
    queryFn: () => bookingService.getReservation(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  // ── 2. Ticket (données enrichies) ─────────────────────────────────────────
  const { data: ticket, isLoading: isLoadingTicket } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => bookingService.getTicket(id),
    enabled: !!id && !!reservation,
    staleTime: Infinity,
    retry: 2,
  });

  const isLoading = isLoadingRes || (!!reservation && isLoadingTicket);

  // ── 3. Données affichées — ticket prioritaire, fallback réservation ────────
  const d = {
    numeroBillet:
      ticket?.numero ||
      ticket?.numeroTicket ||
      ticket?.numBillet ||
      `REF-${id}`,
    numeroEmbarquement:
      ticket?.numeroEmbarquement ||
      ticket?.numEmbarquement ||
      ticket?.numVoyage ||
      reservation?.numeroVoyage ||
      "—",
    siege:
      ticket?.place ||
      ticket?.numeroSiege ||
      ticket?.siege ||
      reservation?.placesReservees?.[0]?.numeroSiege ||
      reservation?.siege ||
      "—",
    classe:
      ticket?.classe ||
      ticket?.typeVoyage ||
      reservation?.typeTarif ||
      "STANDARD",
    operateur:
      ticket?.operateur ||
      ticket?.agence ||
      reservation?.codeAgence ||
      reservation?.agence ||
      "—",
    origine:
      ticket?.origine ||
      ticket?.depart ||
      reservation?.origine ||
      reservation?.depart ||
      "—",
    destination:
      ticket?.destination ||
      ticket?.arrivee ||
      reservation?.destination ||
      reservation?.arrivee ||
      "—",
    dateDepart:
      ticket?.date ||
      reservation?.dateHeureDepart?.slice(0, 10) ||
      reservation?.date_heure_depart?.slice(0, 10) ||
      "—",
    heureDepart:
      ticket?.heure ||
      reservation?.dateHeureDepart?.slice(11, 16) ||
      reservation?.date_heure_depart?.slice(11, 16) ||
      "—",
    nomClient:
      ticket?.passager ||
      ticket?.nomClient ||
      (() => {
        const prenom = reservation?.prenomVoyageur ?? reservation?.prenom_voyageur ?? user?.surname ?? user?.prenom ?? "";
        const nom    = reservation?.nomVoyageur    ?? reservation?.nom_voyageur    ?? user?.name     ?? user?.nom     ?? "";
        const full   = `${prenom} ${nom}`.trim();
        return full || "—";
      })(),
    montant:
      reservation?.montantTotal ??
      reservation?.montant_total ??
      ticket?.montant ??
      0,
    manutention:
      reservation?.manutention ??
      ticket?.manutention ??
      0,
    resteARembourser:
      reservation?.resteARembourser ??
      reservation?.reste_a_rembourser ??
      0,
    devise: reservation?.devise || "XAF",
    statut: reservation?.statut || "PAYEE",
    refId: String(reservation?.id || id),
    codeRef:
      ticket?.codeRef ||
      ticket?.lT ||
      ticket?.code ||
      `LT-${String(id).slice(-6).toUpperCase()}`,
    slogan:
      ticket?.slogan ||
      reservation?.slogan ||
      "Votre transporteur du présent et du futur",
  };

  const dateFormatted = formatDate(d.dateDepart);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleTelechargerPdf = async () => {
    try {
      const pdf = await bookingService.telechargerBilletPdf(id);
      const url = window.URL.createObjectURL(pdf);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billet-${d.numeroBillet}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("PDF téléchargé avec succès");
    } catch {
      toast.error("Erreur lors du téléchargement du PDF");
    }
  };

  const handleImprimer = () => window.print();

  const handlePartager = async () => {
    const text = `Billet ${d.numeroBillet} — ${d.origine} → ${d.destination} le ${dateFormatted} à ${d.heureDepart}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Billet ${d.operateur}`, text, url: window.location.href });
      } catch (err) {
        if (err.name !== "AbortError") toast.error("Erreur lors du partage");
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Informations copiées !");
    }
  };

  // ── États ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-10 h-10 text-teal-600 animate-spin mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Chargement du billet…</p>
          <p className="text-sm text-gray-400 mt-1">Réservation #{id}</p>
        </div>
      </div>
    );
  }

  if (isErrorRes || !reservation) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Billet introuvable</h2>
          <p className="text-gray-500 mb-6">
            Impossible de récupérer la réservation #{id}.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => refetchRes()}>Réessayer</Button>
            <Button onClick={() => navigate("/voyageur/reservations")}>Mes réservations</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 print:bg-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Oswald:wght@400;600;700&display=swap');

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ticket-appear { animation: slideUp .45s cubic-bezier(.22,1,.36,1) both; }

        /* Séparateur perforations */
        .perforation {
          background-image: radial-gradient(circle, #d1d5db 3px, transparent 3px);
          background-size: 16px 100%;
          background-repeat: repeat-x;
          background-position: center;
        }

        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .ticket-shadow { box-shadow: none !important; }
        }
      `}</style>

      {/* ── Barre de navigation ── */}
      <div className="no-print bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <div className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold hidden sm:inline">Retour</span>
          </button>

          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-bold text-gray-700 dark:text-slate-200">Mon billet</span>
          </div>

          <button
            onClick={() => navigate("/voyageur")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Zone billet ── */}
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="ticket-appear ticket-shadow rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-slate-900 font-mono">

          {/* ══ BANDE TITRE TEAL ══ */}
          <div className="bg-teal-500 px-4 py-2 flex items-center justify-between">
            <span
              className="text-white font-bold tracking-widest uppercase text-sm"
              style={{ fontFamily: "'Oswald', sans-serif", letterSpacing: "0.15em" }}
            >
              BILLET PASSAGER
            </span>
            <span
              className="text-white font-black tracking-widest uppercase text-sm"
              style={{ fontFamily: "'Oswald', sans-serif" }}
            >
              {d.operateur}
            </span>
          </div>

          {/* ══ CORPS PRINCIPAL ══ */}
          <div className="flex">

            {/* ── Partie gauche (2/3) ── */}
            <div className="flex-1 p-4 border-r border-dashed border-gray-300 dark:border-slate-700">

              {/* Slogan + classe */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-gray-400 italic">{d.slogan}</p>
                <span className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                  {d.classe}
                </span>
              </div>

              {/* Bus watermark + infos centrales */}
              <div className="relative mb-3">
                {/* Watermark bus */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <svg viewBox="0 0 120 60" className="w-28 h-14 opacity-[0.06]" fill="currentColor">
                    <rect x="5" y="10" width="110" height="40" rx="8"/>
                    <rect x="15" y="5" width="90" height="20" rx="4"/>
                    <circle cx="25" cy="52" r="8"/>
                    <circle cx="95" cy="52" r="8"/>
                    <rect x="10" y="14" width="20" height="12" rx="2" fill="white"/>
                    <rect x="35" y="14" width="20" height="12" rx="2" fill="white"/>
                    <rect x="60" y="14" width="20" height="12" rx="2" fill="white"/>
                    <rect x="85" y="14" width="20" height="12" rx="2" fill="white"/>
                  </svg>
                </div>

                {/* Grille d'infos */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 relative z-10">
                  <InfoRow label="N° Billet" value={d.numeroBillet} bold />
                  <InfoRow label="N° Embarq." value={d.numeroEmbarquement} bold />
                  <InfoRow label="Nom du Client" value={d.nomClient} span />
                </div>
              </div>

              {/* Séparateur fin */}
              <div className="border-t border-gray-200 dark:border-slate-700 my-3" />

              {/* Trajet */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
                <InfoRow label="Départ" value={d.origine} />
                <InfoRow label="Destination" value={d.destination} />
              </div>

              {/* Date + Heure + Voyage */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-2 mb-3">
                <InfoRow label="Date" value={dateFormatted} />
                <InfoRow label="Heure" value={d.heureDepart} />
                <InfoRow label="N° Voyage" value={d.numeroEmbarquement !== "—" ? d.numeroEmbarquement : d.refId.slice(-4)} />
              </div>

              <div className="border-t border-gray-200 dark:border-slate-700 my-3" />

              {/* Montants */}
              <div className="grid grid-cols-3 gap-x-3">
                <InfoRow label="Montant" value={`${Number(d.montant).toLocaleString("fr-CM")} ${d.devise}`} />
                <InfoRow label="Manutention" value={d.manutention ? `${Number(d.manutention).toLocaleString("fr-CM")}` : "0"} />
                <InfoRow label="Reste à Remb." value={d.resteARembourser ? `${Number(d.resteARembourser).toLocaleString("fr-CM")}` : "0"} />
              </div>

              {/* Code + mentions */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-gray-500 mb-1">{d.codeRef}</p>
                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold uppercase">
                  Présentez vos tickets 30 min avant le départ !!!
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5 leading-relaxed">
                  Nous ne sommes pas responsables des bagages non payés et non assurés.
                  En cas de perte ou d'avarie, voir le commissaire aux avaries.
                </p>
              </div>

              {/* Footer billet valable */}
              <div className="mt-3 bg-teal-500 -mx-4 -mb-4 px-4 py-1.5 text-center">
                <p className="text-white font-black text-xs tracking-widest uppercase" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  BILLET VALABLE 48 HEURES
                </p>
              </div>
            </div>

            {/* ── Talon droit (1/3) ── */}
            <div className="w-36 flex-shrink-0">
              {/* Titre teal vertical */}
              <div className="bg-teal-500 p-2 text-center">
                <p className="text-white font-black text-sm tracking-widest" style={{ fontFamily: "'Oswald', sans-serif" }}>
                  {d.operateur}
                </p>
              </div>

              <div className="p-3 flex flex-col gap-3">
                <TalonRow label="N° Billet" value={d.numeroBillet} />
                <TalonRow label="Date" value={dateFormatted} />
                <TalonRow label="Heures" value={d.heureDepart} />

                {/* Séparateur */}
                <div className="border-t border-dashed border-gray-300 dark:border-slate-600 my-1" />

                <div className="text-center">
                  <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Ticket d'Embarquement</p>
                  <div className="border-2 border-teal-500 rounded p-2 text-center">
                    <p className="text-xs font-bold text-teal-600">{d.classe}</p>
                  </div>
                </div>

                {/* Siège */}
                <div className="text-center mt-1">
                  <p className="text-[9px] text-gray-400 uppercase mb-0.5">Siège</p>
                  <p className="text-3xl font-black text-gray-800 dark:text-white leading-none" style={{ fontFamily: "'Oswald', sans-serif" }}>
                    {d.siege}
                  </p>
                </div>

                {/* N° Voyage */}
                <div className="mt-auto pt-2 border-t border-gray-200 dark:border-slate-700">
                  <p className="text-[9px] text-gray-400 uppercase">N°Voy.</p>
                  <p className="text-sm font-bold text-gray-700 dark:text-slate-300">
                    {d.numeroEmbarquement !== "—" ? d.numeroEmbarquement : d.refId.slice(-4)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ══ BADGE TRAJET (sous le billet) ══ */}
          <div className="bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>
                {abbr(d.origine)}
              </p>
              <p className="text-[10px] text-gray-500 font-medium">{d.origine}</p>
            </div>
            <div className="flex-1 flex items-center justify-center gap-2 px-3">
              <div className="flex-1 h-px border-t border-dashed border-gray-400" />
              <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white fill-white">
                  <path d="M17 8C8 10 5.9 16.17 3.82 21H5.71C7.14 16.16 9.5 11 17 10V8M21 6L17 10V6.5C9 6.5 5 11 3 21H1C3 9 9.5 5 17 5.5V2L21 6Z"/>
                </svg>
              </div>
              <div className="flex-1 h-px border-t border-dashed border-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>
                {abbr(d.destination)}
              </p>
              <p className="text-[10px] text-gray-500 font-medium">{d.destination}</p>
            </div>
          </div>
        </div>

        {/* ── Note guichet ── */}
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl no-print">
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            ⚠️ Présentez ce billet au guichet <strong>{d.operateur}</strong> pour obtenir votre
            billet d'embarquement physique 30 min avant le départ.
          </p>
        </div>

        {/* ── Confirmation email ── */}
        {user?.email && (
          <p className="mt-2 text-xs text-center text-gray-400 no-print">
            ✉️ Une copie a été envoyée à{" "}
            <span className="font-semibold text-gray-600 dark:text-gray-300">{user.email}</span>
          </p>
        )}

        {/* ── Actions ── */}
        <div className="no-print mt-5 flex gap-3">
          <Button variant="primary" size="lg" className="flex-1" onClick={handleTelechargerPdf}>
            <Download className="w-4 h-4 mr-1.5" /> PDF
          </Button>
          <Button variant="secondary" size="lg" className="flex-1" onClick={handleImprimer}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimer
          </Button>
          <Button variant="secondary" size="md" onClick={handlePartager} title="Partager">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="no-print mt-3">
          <Button variant="outline" size="md" className="w-full" onClick={() => navigate("/voyageur/reservations")}>
            Voir toutes mes réservations
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────────────

function InfoRow({ label, value, bold = false, span = false }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-slate-500 font-semibold">
        {label}
      </p>
      <p
        className={`text-xs mt-0.5 text-gray-800 dark:text-slate-200 truncate ${
          bold ? "font-bold text-sm" : "font-semibold"
        }`}
        style={{ fontFamily: "'Courier Prime', monospace" }}
      >
        {value}
      </p>
    </div>
  );
}

function TalonRow({ label, value }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-gray-400 dark:text-slate-500">
        {label}
      </p>
      <p
        className="text-xs font-bold text-gray-800 dark:text-slate-200 mt-0.5"
        style={{ fontFamily: "'Courier Prime', monospace" }}
      >
        {value}
      </p>
    </div>
  );
}
