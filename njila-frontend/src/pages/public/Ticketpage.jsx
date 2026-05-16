import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  Download,
  Printer,
  Share2,
  ArrowLeft,
  Bus,
  Calendar,
  Clock,
  MapPin,
  User,
  Hash,
  Loader,
  AlertCircle,
  Home,
} from "lucide-react";
import { bookingService } from "../../services/bookingService";
import { useAuthStore } from "../../store/authStore";
import Button from "../../components/ui/Button";
import toast from "react-hot-toast";

export default function TicketPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Récupérer les détails de la réservation
  const {
    data: reservation,
    isLoading: isLoadingReservation,
    isError: isErrorReservation,
  } = useQuery({
    queryKey: ["reservation", reservationId],
    queryFn: () => bookingService.getReservation(reservationId),
    enabled: !!reservationId,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  // Récupérer le ticket associé
  const {
    data: ticket,
    isLoading: isLoadingTicket,
    isError: isErrorTicket,
  } = useQuery({
    queryKey: ["ticket", reservationId],
    queryFn: () => bookingService.getTicket(reservationId),
    enabled: !!reservationId && !!reservation,
    staleTime: Infinity,
    retry: 2,
  });

  const isLoading = isLoadingReservation || isLoadingTicket;
  const isError = isErrorReservation || isErrorTicket;

  // Données affichées — ticket prioritaire, fallback sur réservation
  const display = {
    numero: ticket?.numero || ticket?.numeroTicket || `REF-${reservationId}`,
    ref: ticket?.ref || reservation?.id || reservationId,
    operateur: ticket?.operateur || reservation?.codeAgence || "—",
    classe: ticket?.classe || reservation?.typeTarif || "STANDARD",
    origine: ticket?.origine || reservation?.origine || "—",
    destination: ticket?.destination || reservation?.destination || "—",
    date:
      ticket?.date ||
      reservation?.dateHeureDepart?.slice(0, 10) ||
      "—",
    heure:
      ticket?.heure ||
      reservation?.dateHeureDepart?.slice(11, 16) ||
      "—",
    passager:
      ticket?.passager ||
      (reservation?.nomVoyageur && reservation?.prenomVoyageur
        ? `${reservation.prenomVoyageur} ${reservation.nomVoyageur}`
        : user?.nom || "—"),
    siege:
      ticket?.place ||
      ticket?.numeroSiege ||
      reservation?.placesReservees?.[0]?.numeroSiege ||
      "—",
    montant: reservation?.montantTotal || 0,
    statut: reservation?.statut || "PAYEE",
  };

  const statutConfig = {
    PAYEE: { label: "Payé", color: "green", icon: CheckCircle },
    CONFIRMEE: { label: "Confirmé", color: "blue", icon: CheckCircle },
    EN_ATTENTE: { label: "En attente", color: "yellow", icon: Clock },
    ANNULEE: { label: "Annulé", color: "red", icon: AlertCircle },
    EMBARQUEE: { label: "Embarqué", color: "purple", icon: CheckCircle },
  };

  const statut = statutConfig[display.statut] || statutConfig["PAYEE"];
  const StatutIcon = statut.icon;

  const handleTelechargerPdf = async () => {
    try {
      const pdf = await bookingService.telechargerBilletPdf(reservationId);
      const url = window.URL.createObjectURL(pdf);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billet-${display.numero}.pdf`;
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
    const text = `Billet ${display.numero} — ${display.origine} → ${display.destination} le ${display.date} à ${display.heure}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Mon billet de bus", text, url: window.location.href });
      } catch (err) {
        if (err.name !== "AbortError") toast.error("Erreur lors du partage");
      }
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Informations copiées dans le presse-papiers");
    }
  };

  // ─── États de chargement ───────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">
            Chargement du billet...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !reservation) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Billet introuvable
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Impossible de récupérer les informations de cette réservation.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Retour
            </Button>
            <Button onClick={() => navigate("/bookings")}>Mes réservations</Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Rendu principal ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 print:bg-white">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeUp .4s ease both; }

        @keyframes successPop {
          0%   { transform: scale(0.8); opacity: 0; }
          60%  { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .success-pop { animation: successPop .5s ease both; }

        @media print {
          .no-print { display: none !important; }
          .print-ticket { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      {/* Header — masqué à l'impression */}
      <div className="no-print bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors group"
          >
            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 rounded-xl flex items-center justify-center transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold hidden sm:inline">Retour</span>
          </button>

          <div className="flex items-center gap-2">
            <Bus className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-bold text-gray-700 dark:text-slate-200">
              Billet de voyage
            </span>
          </div>

          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Accueil</span>
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Bannière succès */}
        <div className="success-pop mb-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-5 text-white flex items-center gap-4 no-print">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg">Réservation confirmée !</p>
            <p className="text-green-100 text-sm">
              Votre billet est prêt. Présentez-le au chauffeur lors de l'embarquement.
            </p>
          </div>
        </div>

        {/* Carte billet */}
        <div className="fade-in print-ticket bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden">

          {/* ── En-tête billet ── */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-200 text-xs uppercase font-semibold tracking-wider mb-1">
                  Billet électronique
                </p>
                <p className="text-2xl font-bold">{display.operateur}</p>
                <p className="text-blue-200 text-sm mt-1">{display.classe}</p>
              </div>

              {/* Badge statut */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/20`}>
                <StatutIcon className="w-3.5 h-3.5" />
                {statut.label}
              </div>
            </div>

            {/* Numéro de billet */}
            <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-300" />
              <span className="text-sm font-mono text-blue-100">{display.numero}</span>
            </div>
          </div>

          {/* ── Trajet ── */}
          <div className="p-6 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              {/* Départ */}
              <div className="text-center">
                <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                  {display.origine.slice(0, 3).toUpperCase()}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                  {display.origine}
                </p>
              </div>

              {/* Flèche */}
              <div className="flex-1 flex flex-col items-center px-4">
                <div className="flex items-center w-full gap-2">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent dark:via-blue-700" />
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-md">
                    <Bus className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent dark:via-blue-700" />
                </div>
                <p className="text-xs text-gray-400 mt-2 font-medium">~4h30</p>
              </div>

              {/* Arrivée */}
              <div className="text-center">
                <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                  {display.destination.slice(0, 3).toUpperCase()}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                  {display.destination}
                </p>
              </div>
            </div>
          </div>

          {/* ── Séparateur dentelé ── */}
          <div className="relative h-6 bg-white dark:bg-slate-900">
            <div className="absolute inset-x-0 top-0 flex">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-3 bg-gray-50 dark:bg-slate-950 rounded-b-full"
                />
              ))}
            </div>
          </div>

          {/* ── Détails ── */}
          <div className="px-6 pb-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Date */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <Calendar className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold">
                    Date
                  </p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                    {display.date}
                  </p>
                </div>
              </div>

              {/* Heure */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <Clock className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold">
                    Heure départ
                  </p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                    {display.heure}
                  </p>
                </div>
              </div>

              {/* Passager */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <User className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold">
                    Passager
                  </p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 truncate">
                    {display.passager}
                  </p>
                </div>
              </div>

              {/* Siège */}
              <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                <MapPin className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-semibold">
                    Siège
                  </p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                    {display.siege}
                  </p>
                </div>
              </div>
            </div>

            {/* Montant + référence */}
            <div className="mt-4 flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-100 dark:border-blue-800">
              <div>
                <p className="text-xs text-blue-500 uppercase font-semibold">Référence</p>
                <p className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                  {String(display.ref)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-500 uppercase font-semibold">Montant payé</p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                  {display.montant.toLocaleString("fr-CM")} XAF
                </p>
              </div>
            </div>

            {/* Email de confirmation */}
            {user?.email && (
              <p className="mt-4 text-xs text-center text-gray-400 dark:text-gray-500">
                ✉️ Une copie a été envoyée à{" "}
                <span className="font-semibold text-gray-600 dark:text-gray-300">
                  {user.email}
                </span>
              </p>
            )}

            {/* Instructions */}
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                ⚠️ Présentez ce billet (numérique ou imprimé) au guichet pour obtenir votre
                billet d'embarquement physique avant le départ.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="no-print mt-6 flex gap-3">
          <Button variant="primary" size="lg" className="flex-1" onClick={handleTelechargerPdf}>
            <Download className="w-4 h-4 mr-1" /> Télécharger PDF
          </Button>
          <Button variant="secondary" size="lg" className="flex-1" onClick={handleImprimer}>
            <Printer className="w-4 h-4 mr-1" /> Imprimer
          </Button>
          <Button variant="secondary" size="md" onClick={handlePartager} title="Partager">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="no-print mt-3">
          <Button
            variant="outline"
            size="md"
            className="w-full"
            onClick={() => navigate("/bookings")}
          >
            Voir toutes mes réservations
          </Button>
        </div>
      </div>
    </div>
  );
}
