export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8888";

export const ROLES = {
  VOYAGEUR:       "VOYAGEUR",
  GUICHETIER:     "GUICHETIER",
  MANAGER_LOCAL:  "MANAGER_LOCAL",
  MANAGER_GLOBAL: "MANAGER_GLOBAL",
  ADMIN:          "ADMIN",
  CHAUFFEUR:      "CHAUFFEUR",
};

export const ROUTES = {
  // Public
  HOME:           "/",
  LOGIN:          "/login",
  REGISTER:       "/register",
  SEARCH:         "/recherche",
  RESULTS:        "/resultats",
  SEAT_SELECTION: "/selection-places/:voyageId",
  PAYMENT:        "/paiement",

  // Voyageur
  VOYAGEUR_DASHBOARD:   "/voyageur",
  VOYAGEUR_RESERVATIONS:"/voyageur/reservations",
  VOYAGEUR_PROFIL:      "/voyageur/profil",
  VOYAGEUR_BILLET:      "/voyageur/billet/:id",

  // Guichetier
  GUICHETIER_POS:       "/guichet",
  GUICHETIER_SCAN:      "/guichet/scan",
  GUICHETIER_PASSAGERS: "/guichet/passagers",

  // Manager
  MANAGER_DASHBOARD:  "/manager",
  MANAGER_FLOTTE:     "/manager/flotte",
  MANAGER_VOYAGES:    "/manager/voyages",
  MANAGER_CHAUFFEURS: "/manager/chauffeurs",
  MANAGER_STATS:      "/manager/stats",

  // Admin
  ADMIN_DASHBOARD:    "/admin",
  ADMIN_AGENCES:      "/admin/agences",
  ADMIN_ABONNEMENTS:  "/admin/abonnements",
  ADMIN_UTILISATEURS: "/admin/utilisateurs",
};

export const STATUT_RESERVATION = {
  EN_ATTENTE: "EN_ATTENTE",
  CONFIRMEE:  "CONFIRMEE",
  PAYEE:      "PAYEE",
  ANNULEE:    "ANNULEE",
  EXPIREE:    "EXPIREE",
  EMBARQUEE:  "EMBARQUEE",
};

export const OPERATEUR_PAIEMENT = {
  MTN_MONEY:    "MTN_MONEY",
  ORANGE_MONEY: "ORANGE_MONEY",
  ESPECES:      "ESPECES",
};
