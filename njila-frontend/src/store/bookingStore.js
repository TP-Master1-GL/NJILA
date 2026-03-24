import { create } from "zustand";

export const useBookingStore = create((set) => ({
  // Recherche
  recherche: {
    origine:      "",
    destination:  "",
    date:         "",
    nombrePlaces: 1,
  },

  // Voyage sélectionné
  voyageSelectionne: null,

  // Places sélectionnées
  placesSelectionnees: [],

  // Données passagers
  passagers: [],

  // Réservation en cours
  reservationEnCours: null,

  // Actions
  setRecherche: (recherche) => set({ recherche }),

  setVoyageSelectionne: (voyage) => set({
    voyageSelectionne: voyage,
    placesSelectionnees: [],
    passagers: [],
  }),

  togglePlace: (place) => set((state) => {
    const existe = state.placesSelectionnees.find((p) => p.id === place.id);
    return {
      placesSelectionnees: existe
        ? state.placesSelectionnees.filter((p) => p.id !== place.id)
        : [...state.placesSelectionnees, place],
    };
  }),

  setPassagers: (passagers) => set({ passagers }),

  setReservationEnCours: (reservation) => set({ reservationEnCours: reservation }),

  resetBooking: () => set({
    voyageSelectionne:   null,
    placesSelectionnees: [],
    passagers:           [],
    reservationEnCours:  null,
  }),
}));
