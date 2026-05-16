import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Phone, ArrowLeft, AlertCircle, Loader } from "lucide-react";
import { useBookingStore } from "../../store/bookingStore";
import { useAuthStore } from "../../store/authStore";
import { bookingService } from "../../services/bookingService";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { formatMontant } from "../../utils/formatters";
import toast from "react-hot-toast";

// ─── Helper : traduction des erreurs backend ──────────────────────────────────
function extraireMessageErreur(err) {
  const raw =
    err?.response?.data?.message ||
    err?.response?.data?.error   ||
    err?.response?.data?.detail  ||
    err?.message                 ||
    "Une erreur inattendue est survenue.";

  if (raw.includes("id_place") || raw.includes("null value") || raw.includes("not-null constraint"))
    return "Erreur de configuration interne. Veuillez réessayer ou contacter le support.";
  if (raw.includes("viennent d'être réservés") || raw.includes("déjà réservé"))
    return "Ces places ont été réservées entre-temps. Veuillez retourner choisir d'autres sièges.";
  if (raw.includes("Places insuffisantes"))
    return "Plus assez de places disponibles pour ce voyage.";
  if (raw.includes("Voyage introuvable"))
    return "Ce voyage n'existe plus. Veuillez effectuer une nouvelle recherche.";

  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PaymentPage() {
  const navigate = useNavigate();
  const {
    voyageSelectionne,
    placesSelectionnees,
    passagers,
    setReservationEnCours,
    resetBooking,
  } = useBookingStore();
  const { user } = useAuthStore();

  const [operateur,     setOperateur]     = useState("ORANGE_MONEY");
  const [telephone,     setTelephone]     = useState("");
  const [etape,         setEtape]         = useState("paiement"); // "paiement" | "traitement"
  const [reservationId, setReservationId] = useState(null);

  // ── Garde : données obligatoires ─────────────────────────────────────────
  useEffect(() => {
    if (!voyageSelectionne || placesSelectionnees.length === 0 || !user) {
      toast.error("Données de réservation incomplètes");
      navigate("/recherche");
      return;
    }
    if (!passagers || passagers.length === 0) {
      toast.error("Informations des passagers manquantes");
      navigate(-1);
    }
  }, []);

  const prixTotal         = placesSelectionnees.length * (voyageSelectionne?.prix || 5000);
  const passagerPrincipal = passagers?.[0] || {};

  // ─── Mutation ─────────────────────────────────────────────────────────────
  // Le backend (ReservationService) publie lui-même l'événement booking.created
  // vers le payment-service via RabbitMQ dès que la réservation est créée.
  // Le frontend n'a donc qu'un seul appel à effectuer.
  const { mutate: lancerPaiement, isPending: isProcessing } = useMutation({
    mutationFn: async () => {
      if (!telephone.trim()) throw new Error("Numéro de téléphone requis");

      const reservationPayload = {
        idVoyage:          voyageSelectionne.id,
        idVoyageur:        user.id,
        nomVoyageur:       (passagerPrincipal.nom       || user?.nom       || "").trim(),
        prenomVoyageur:    (passagerPrincipal.prenom    || user?.prenom    || "").trim(),
        telephoneVoyageur: (passagerPrincipal.telephone || user?.telephone || telephone).trim(),
        emailVoyageur:     (passagerPrincipal.email     || user?.email     || "").trim(),
        nombrePlaces:      placesSelectionnees.length,
        canal:             "WEB",
        codeAgence:        voyageSelectionne.agenceId  || user?.agenceId,
        codeFiliale:       voyageSelectionne.filialeId || user?.filialeId,
        typeTarif:         "STANDARD",
        devise:            "XAF",
        siegesDemandes:    placesSelectionnees.map((p) => p.numero),
        membresGroupe:
          passagers.length > 1
            ? passagers.slice(1).map((p) => ({
                nom:       (p.nom       || "").trim(),
                prenom:    (p.prenom    || "").trim(),
                telephone: (p.telephone || "").trim(),
                aBagage:   false,
              }))
            : [],
        // Transmis au backend pour que BookingCreatedEvent contienne les
        // coordonnées Mobile Money → le payment-service les utilise directement
        telephonePaiement: telephone.trim(),
        operateurPaiement: operateur,          // "ORANGE_MONEY" | "MTN_MONEY"
        paymentMethodType: "MOBILE_MONEY",
      };

      try {
        return await bookingService.creerReservation(reservationPayload);
      } catch (err) {
        throw new Error(extraireMessageErreur(err));
      }
    },

    onSuccess: (reservation) => {
      setReservationId(reservation.id);
      setReservationEnCours(reservation);
      toast.success("Demande de paiement envoyée. Vérifiez votre téléphone.");
      setEtape("traitement");
    },

    onError: (err) => {
      toast.error(err.message || "Erreur lors du traitement.", { duration: 6000 });
      if (err.message?.includes("réservées entre-temps") || err.message?.includes("sièges")) {
        setTimeout(() => navigate(-1), 2500);
      }
    },
  });

  const handleLancerPaiement = () => {
    if (!telephone.trim()) {
      toast.error("Veuillez entrer un numéro de téléphone Mobile Money");
      return;
    }
    lancerPaiement();
  };

  const handleConfirmerPaiement = () => {
    resetBooking();
    navigate(`/voyageur/billet/${reservationId}`);
  };

  // ═══════════════════════════════════════════════════════════
  // ÉTAPE 1 — CHOIX OPÉRATEUR + NUMÉRO
  // ═══════════════════════════════════════════════════════════
  if (etape === "paiement") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950">

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors group"
            >
              <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 rounded-xl flex items-center justify-center transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold">Retour</span>
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200 hidden sm:block">
              Paiement sécurisé
            </span>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
            {[["1", "Sélection"], ["2", "Passager"], ["3", "Paiement"]].map(([n, l], i) => (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  n === "3" ? "bg-blue-600 text-white" : "bg-green-500 text-white"
                }`}>
                  {n === "3" ? "3" : "✓"}
                </div>
                <span className={`text-sm font-medium ${
                  n === "3" ? "text-gray-900 dark:text-slate-100" : "text-gray-400"
                }`}>{l}</span>
                {i < 2 && <div className="w-12 h-px bg-gray-200 dark:bg-slate-700" />}
              </div>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="max-w-4xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Formulaire paiement */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Finaliser votre réservation
              </h2>

              {/* Montant */}
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-xl mb-6 border border-blue-100 dark:border-blue-800">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                  Montant à payer
                </span>
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatMontant(prixTotal)}
                </span>
              </div>

              {/* Récap passager */}
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl">
                <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">
                  Passager principal
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {passagerPrincipal.prenom} {passagerPrincipal.nom}
                  {passagerPrincipal.cni && (
                    <span className="ml-1 text-green-600 dark:text-green-400">
                      — CNI : {passagerPrincipal.cni}
                    </span>
                  )}
                </p>
                {passagers.length > 1 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    + {passagers.length - 1} autre(s) passager(s)
                  </p>
                )}
              </div>

              <div className="space-y-6">

                {/* Sélection opérateur */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Sélectionnez votre opérateur Mobile Money
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "ORANGE_MONEY", label: "Orange Money", bg: "bg-orange-500", emoji: "🟠" },
                      { id: "MTN_MONEY",    label: "MTN MoMo",     bg: "bg-yellow-400", emoji: "🟡" },
                    ].map((op) => (
                      <button
                        key={op.id}
                        onClick={() => setOperateur(op.id)}
                        disabled={isProcessing}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all disabled:opacity-50 ${
                          operateur === op.id
                            ? "border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950"
                            : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600"
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${op.bg}`}>
                          {op.emoji}
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {op.label}
                        </span>
                        {operateur === op.id && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">
                            Sélectionné
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Numéro Mobile Money */}
                <Input
                  label="Numéro de téléphone Mobile Money"
                  placeholder="+237 6XX XXX XXX"
                  icon={Phone}
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  disabled={isProcessing}
                />

                {/* Info opérateur */}
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Une demande de confirmation sera envoyée sur votre{" "}
                    <strong>
                      {operateur === "ORANGE_MONEY" ? "Orange Money" : "MTN MoMo"}
                    </strong>
                    . Acceptez-la dans les 5 minutes.
                  </p>
                </div>

                {/* Indicateur de traitement en cours */}
                {isProcessing && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800">
                    <Loader className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                        Création de votre réservation...
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                        Ne fermez pas cette page.
                      </p>
                    </div>
                  </div>
                )}

                {/* Bouton payer */}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleLancerPaiement}
                  loading={isProcessing}
                  disabled={!telephone.trim() || isProcessing}
                >
                  {isProcessing
                    ? "Traitement en cours..."
                    : `Payer ${formatMontant(prixTotal)}`}
                </Button>

                <p className="text-xs text-gray-400 text-center">
                  PAIEMENT SÉCURISÉ ET CHIFFRÉ
                </p>
              </div>
            </div>
          </div>

          {/* Récapitulatif sticky */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 sticky top-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Récapitulatif</h3>
              <div className="space-y-3">

                <div className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Trajet</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {voyageSelectionne?.origine} → {voyageSelectionne?.destination}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Date & heure</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {voyageSelectionne?.heureDepart?.slice(0, 16).replace("T", " à ")}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Places</span>
                  <div className="flex gap-1 flex-wrap">
                    {placesSelectionnees.map((p) => (
                      <span key={p.id} className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                        #{p.numero}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Passager</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {passagerPrincipal.prenom} {passagerPrincipal.nom}
                  </span>
                </div>

                <div className="border-t border-gray-200 dark:border-slate-700 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 dark:text-white">Total</span>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatMontant(prixTotal)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-xs text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Besoin d'aide ?{" "}
                  <a href="#" className="font-semibold underline">Contacter le support</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ÉTAPE 2 — ATTENTE CONFIRMATION MOBILE MONEY
  // ═══════════════════════════════════════════════════════════
  if (etape === "traitement") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">

          {/* Spinner */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <Loader className="w-20 h-20 text-blue-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Phone className="w-7 h-7 text-blue-600" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            En attente de confirmation...
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Veuillez confirmer la transaction sur votre appareil mobile.
          </p>

          <div className="space-y-3">
            <div className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl text-left shadow-sm">
              <p className="text-sm font-bold text-gray-800 dark:text-slate-200 mb-3">
                {operateur === "ORANGE_MONEY" ? "Orange Money" : "MTN MoMo"}
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Téléphone</span>
                  <span className="font-semibold text-gray-800 dark:text-slate-200">{telephone}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Montant</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{formatMontant(prixTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Réservation</span>
                  <span className="font-semibold text-gray-800 dark:text-slate-200">#{reservationId}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                La demande expire dans 5 minutes. N'éteignez pas votre téléphone.
              </p>
            </div>

            <button
              onClick={handleConfirmerPaiement}
              className="w-full py-3.5 px-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-xl transition-colors"
            >
              J'ai confirmé — Voir mon billet
            </button>

            <button
              onClick={() => setEtape("paiement")}
              className="w-full py-2.5 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-semibold rounded-xl transition-colors text-sm"
            >
              ← Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Erreur</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Une erreur est survenue. Veuillez réessayer.</p>
        <Button onClick={() => navigate("/recherche")}>Retour à la recherche</Button>
      </div>
    </div>
  );
}
