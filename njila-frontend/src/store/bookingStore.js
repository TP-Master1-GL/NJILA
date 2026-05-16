import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useBookingStore = create(
  persist(
    (set, get) => ({
      // ─────────────────────────────────────────────────────────
      // Recherche
      // ─────────────────────────────────────────────────────────
      recherche: {
        origine: "",
        destination: "",
        date: "",
        nombrePlaces: 1,
      },

      // ─────────────────────────────────────────────────────────
      // Voyage sélectionné
      // ─────────────────────────────────────────────────────────
      voyageSelectionne: null,

      // ─────────────────────────────────────────────────────────
      // Places sélectionnées
      // ─────────────────────────────────────────────────────────
      placesSelectionnees: [],

      // ─────────────────────────────────────────────────────────
      // Données passagers
      // ─────────────────────────────────────────────────────────
      passagers: [],

      // ─────────────────────────────────────────────────────────
      // Réservation en cours
      // ─────────────────────────────────────────────────────────
      reservationEnCours: null,

      // ─────────────────────────────────────────────────────────
      // Actions
      // ─────────────────────────────────────────────────────────

      setRecherche: (recherche) =>
        set({
          recherche,
        }),

      setVoyageSelectionne: (voyage) =>
        set({
          voyageSelectionne: voyage,

          // reset automatique lors du changement de voyage
          placesSelectionnees: [],
          passagers: [],
          reservationEnCours: null,
        }),

      // ─────────────────────────────────────────────────────────
      // Gestion des places
      // ─────────────────────────────────────────────────────────
      togglePlace: (place) =>
        set((state) => {
          const existe = state.placesSelectionnees.some(
            (p) => p.id === place.id
          );

          return {
            placesSelectionnees: existe
              ? state.placesSelectionnees.filter(
                  (p) => p.id !== place.id
                )
              : [
                  ...state.placesSelectionnees,
                  {
                    id: place.id,
                    numero: place.numero,
                    occupe: place.occupe ?? false,
                  },
                ],
          };
        }),

      // Ajouter plusieurs places d'un coup
      setPlacesSelectionnees: (places) =>
        set({
          placesSelectionnees: Array.isArray(places) ? places : [],
        }),

      clearPlacesSelectionnees: () =>
        set({
          placesSelectionnees: [],
        }),

      // ─────────────────────────────────────────────────────────
      // Gestion passagers
      // ─────────────────────────────────────────────────────────
      setPassagers: (passagers) =>
        set({
          passagers: Array.isArray(passagers) ? passagers : [],
        }),

      addPassager: (passager) =>
        set((state) => ({
          passagers: [...state.passagers, passager],
        })),

      removePassager: (index) =>
        set((state) => ({
          passagers: state.passagers.filter((_, i) => i !== index),
        })),

      clearPassagers: () =>
        set({
          passagers: [],
        }),

      // ─────────────────────────────────────────────────────────
      // Réservation en cours
      // ─────────────────────────────────────────────────────────
      setReservationEnCours: (reservation) =>
        set({
          reservationEnCours: reservation,
        }),

      clearReservationEnCours: () =>
        set({
          reservationEnCours: null,
        }),

      // ─────────────────────────────────────────────────────────
      // Helpers
      // ─────────────────────────────────────────────────────────
      getNombrePlaces: () => {
        return get().placesSelectionnees.length;
      },

      getPrixTotal: () => {
        const voyage = get().voyageSelectionne;
        const places = get().placesSelectionnees;

        if (!voyage) return 0;

        return (voyage.prix || 0) * places.length;
      },

      // ─────────────────────────────────────────────────────────
      // Reset complet
      // ─────────────────────────────────────────────────────────
      resetBooking: () =>
        set({
          voyageSelectionne: null,
          placesSelectionnees: [],
          passagers: [],
          reservationEnCours: null,
        }),
    }),

    // ───────────────────────────────────────────────────────────
    // Persist Zustand
    // ───────────────────────────────────────────────────────────
    {
      name: "booking-storage",

      partialize: (state) => ({
        recherche: state.recherche,
        voyageSelectionne: state.voyageSelectionne,
        placesSelectionnees: state.placesSelectionnees,
        passagers: state.passagers,
        reservationEnCours: state.reservationEnCours,
      }),
    }
  )
);