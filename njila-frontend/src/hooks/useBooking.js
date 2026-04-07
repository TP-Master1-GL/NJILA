import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useBookingStore } from "../store/bookingStore";
import { useAuthStore }    from "../store/authStore";
import { bookingService }  from "../services/bookingService";
import { paymentService }  from "../services/paymentService";
import toast from "react-hot-toast";

export const useBooking = () => {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const { user }  = useAuthStore();
  const {
    voyageSelectionne, placesSelectionnees, passagers,
    setReservationEnCours, resetBooking,
  } = useBookingStore();

  // ── Créer une réservation WEB ──────────────────────────────────────────────
  const { mutate: creerReservation, isPending: isCreating } = useMutation({
    mutationFn: (payload) => bookingService.creerReservation({
      idVoyage:     voyageSelectionne?.id,
      idVoyageur:   user?.id,
      nombrePlaces: placesSelectionnees.length,
      canal:        "WEB",
      codeAgence:   voyageSelectionne?.codeAgence || "GEN",
      codeFiliale:  voyageSelectionne?.codeFiliale || "BYDE",
      typeTarif:    "STANDARD",
      membresGroupe: passagers.slice(1).map(p => ({ nom: p.nom?.split(" ")[0], prenom: p.nom?.split(" ")[1] || "", aBagage: false })),
      ...payload,
    }),
    onSuccess: (data) => {
      setReservationEnCours(data);
      qc.invalidateQueries(["reservations"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Erreur lors de la réservation");
    },
  });

  // ── Initier paiement ───────────────────────────────────────────────────────
  const { mutate: initierPaiement, isPending: isPaying } = useMutation({
    mutationFn: ({ reservationId, operateur, telephone }) =>
      paymentService.initierPaiement({
        bookingId:  reservationId,
        montant:    placesSelectionnees.length * (voyageSelectionne?.prix || 0),
        operateur,
        telephone,
        voyageurId: user?.id,
      }),
    onSuccess: () => {
      toast.success("Paiement initié — vérifiez votre téléphone !");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Erreur de paiement");
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
      const url  = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `billet-${numeroTicket || reservationId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Téléchargement démarré");
    } catch {
      toast.error("PDF non disponible pour le moment");
    }
  };

  // ── Mes réservations ───────────────────────────────────────────────────────
  const useMesReservations = () => useQuery({
    queryKey: ["reservations", user?.id],
    queryFn:  () => bookingService.getMesReservations(user.id),
    enabled:  !!user?.id,
  });

  return {
    creerReservation, isCreating,
    initierPaiement,  isPaying,
    annuler,          isCancelling,
    telechargerPdf,
    useMesReservations,
    resetBooking,
  };
};
