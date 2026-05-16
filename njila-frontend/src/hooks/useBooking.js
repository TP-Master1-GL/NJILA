import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useBookingStore } from "../store/bookingStore";
import { useAuthStore } from "../store/authStore";
import { bookingService } from "../services/bookingService";
import toast from "react-hot-toast";

export const useBooking = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const {
    voyageSelectionne,
    placesSelectionnees,
    passagers,
    setReservationEnCours,
    resetBooking,
  } = useBookingStore();

  const prixTotal = placesSelectionnees.length * (voyageSelectionne?.prix || 0);

  // ── Créer une réservation WEB ──────────────────────────────────────────────
  //
  // Le paiement est initié automatiquement côté backend via RabbitMQ
  // dès la création. Le frontend n'appelle plus paymentService directement.
  // telephonePaiement et operateurPaiement sont collectés ici et transmis
  // au backend qui les forward au payment-service via booking.created.
  const { mutate: creerReservation, isPending: isCreating } = useMutation({
    mutationFn: ({ telephonePaiement, operateurPaiement } = {}) => {
      const membresGroupe = passagers.slice(1).map((p) => {
        const names = p.name?.trim().split(" ") || [""];
        return {
          nom: names[0],
          prenom: names.slice(1).join(" ") || "",
          aBagage: false,
        };
      });

      return bookingService.creerReservation({
        idVoyage:          voyageSelectionne?.id,
        idVoyageur:        user?.id,
        nomVoyageur:       passagers[0]?.name?.split(" ")[0] || "",
        prenomVoyageur:    passagers[0]?.name?.split(" ").slice(1).join(" ") || "",
        telephoneVoyageur: user?.telephone || "",
        emailVoyageur:     user?.email || "",
        nombrePlaces:      placesSelectionnees.length,
        siegesDemandes:    placesSelectionnees.map((p) => p.numero),
        canal:             "WEB",
        codeAgence:        voyageSelectionne?.codeAgence || "GEN",
        codeFiliale:       voyageSelectionne?.codeFiliale || "BYDE",
        typeTarif:         "STANDARD",
        membresGroupe,
        // Informations de paiement Mobile Money transmises au payment-service
        // via l'événement booking.created (RabbitMQ) — pas d'appel direct ici
        paymentMethodType: "MOBILE_MONEY",
        telephonePaiement: telephonePaiement || user?.telephone || "",
        operateurPaiement: operateurPaiement || "ORANGE_MONEY" || "MTN_MONEY",
      });
    },
    onSuccess: (data) => {
      setReservationEnCours(data);
      qc.invalidateQueries(["reservations"]);
      // La réservation est EN_ATTENTE : on informe l'utilisateur qu'il va
      // recevoir une notification USSD push sur son téléphone
      toast.success(
        "Réservation créée ! Validez le paiement sur votre téléphone.",
        { duration: 6000 }
      );
      navigate("/reservation/confirmation");
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.message || "Erreur lors de la réservation"
      );
    },
  });

  // ── Annuler une réservation ────────────────────────────────────────────────
  const { mutate: annuler, isPending: isCancelling } = useMutation({
    mutationFn: (reservationId) =>
      bookingService.annulerReservation(reservationId, user?.id),
    onSuccess: () => {
      toast.success("Réservation annulée");
      qc.invalidateQueries(["reservations"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Impossible d'annuler");
    },
  });

  // ── Télécharger PDF ────────────────────────────────────────────────────────
  const telechargerPdf = async (reservationId, numeroTicket) => {
    try {
      const blob = await bookingService.telechargerBilletPdf(reservationId);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `billet-${numeroTicket || reservationId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Téléchargement démarré");
    } catch {
      toast.error("PDF non disponible pour le moment");
    }
  };

  // ── Mes réservations ───────────────────────────────────────────────────────
  const useMesReservations = () =>
    useQuery({
      queryKey: ["reservations", user?.id],
      queryFn:  () => bookingService.getMesReservations(user.id),
      enabled:  !!user?.id,
    });

  return {
    creerReservation,
    isCreating,
    annuler,
    isCancelling,
    telechargerPdf,
    useMesReservations,
    resetBooking,
    prixTotal,
  };
};
