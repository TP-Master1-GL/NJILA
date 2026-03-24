// ─── Agences ──────────────────────────────────────────────────────────────────
export const MOCK_AGENCES = [
  { id: 1, agence_id: "AGC-GEN-001", nom: "General Voyages",     email_officiel: "contact@generalvoyages.cm", telephone: "+237677001001", statut_global: "ACTIVE",    date_inscription: "2024-01-15T08:00:00Z" },
  { id: 2, agence_id: "AGC-BNM-001", nom: "Binam Voyage",        email_officiel: "contact@binam.cm",          telephone: "+237677002002", statut_global: "ACTIVE",    date_inscription: "2024-02-20T08:00:00Z" },
  { id: 3, agence_id: "AGC-TXP-001", nom: "Touristique Express", email_officiel: "contact@txpress.cm",        telephone: "+237677003003", statut_global: "TRIAL",     date_inscription: "2026-03-01T08:00:00Z" },
  { id: 4, agence_id: "AGC-BCA-001", nom: "Buca Voyages",        email_officiel: "contact@buca.cm",           telephone: "+237677004004", statut_global: "SUSPENDED", date_inscription: "2024-05-10T08:00:00Z" },
  { id: 5, agence_id: "AGC-FNX-001", nom: "Finex Voyage",        email_officiel: "contact@finex.cm",          telephone: "+237677005005", statut_global: "ACTIVE",    date_inscription: "2024-06-01T08:00:00Z" },
];

// ─── Abonnements tableau de bord ──────────────────────────────────────────────
export const MOCK_TABLEAU_DE_BORD = {
  resume: {
    actifs:              8,
    essais:              3,
    expirant_sous_30j:   2,
    expires:             1,
    suspendus:           1,
    recette_totale_fcfa: 2850000,
    recettes_par_plan: {
      MENSUEL:     500000,
      TRIMESTRIEL: 650000,
      ANNUEL:      1700000,
    },
  },
  abonnements_expirant_bientot: [
    { id: 10, id_agence: "AGC-BNM-001", plan: "MENSUEL",     jours_restants: 5,  statut: "EXPIRING", montantTotal: 50000  },
    { id: 11, id_agence: "AGC-TXP-001", plan: "TRIMESTRIEL", jours_restants: 18, statut: "EXPIRING", montantTotal: 130000 },
  ],
};

// ─── Utilisateurs ─────────────────────────────────────────────────────────────
export const MOCK_USERS = [
  { id: 1,  nom: "Nguembu",  prenom: "John",    email: "john@njila.cm",       telephone: "+237699000001", role: "ADMIN",          date_inscription: "2024-01-01T00:00:00Z" },
  { id: 2,  nom: "Kamga",    prenom: "Marie",   email: "marie@generalvoyages.cm", telephone: "+237699000002", role: "MANAGER_GLOBAL", date_inscription: "2024-02-01T00:00:00Z" },
  { id: 3,  nom: "Tagne",    prenom: "Fabrice", email: "fabrice@generalvoyages.cm", telephone: "+237699000003", role: "MANAGER_LOCAL",  date_inscription: "2024-03-01T00:00:00Z" },
  { id: 4,  nom: "Dupont",   prenom: "Jean",    email: "jean.dupont@gmail.com", telephone: "+237699000004", role: "VOYAGEUR",       date_inscription: "2024-04-15T00:00:00Z" },
  { id: 5,  nom: "Etoa",     prenom: "Samuel",  email: "samuel.etoa@gmail.com", telephone: "+237699000005", role: "GUICHETIER",     date_inscription: "2024-05-01T00:00:00Z" },
  { id: 6,  nom: "Ndiaye",   prenom: "Fatou",   email: "fatou@gmail.com",       telephone: "+237699000006", role: "VOYAGEUR",       date_inscription: "2025-01-10T00:00:00Z" },
  { id: 7,  nom: "Moussa",   prenom: "Ahmed",   email: "ahmed@gmail.com",       telephone: "+237699000007", role: "VOYAGEUR",       date_inscription: "2025-06-20T00:00:00Z" },
  { id: 8,  nom: "Biya",     prenom: "Paul Jr", email: "paul@gmail.com",        telephone: "+237699000008", role: "CHAUFFEUR",      date_inscription: "2024-07-01T00:00:00Z" },
];

// ─── Voyages ──────────────────────────────────────────────────────────────────
export const MOCK_VOYAGES_SEARCH = [
  { id: 1,  origine: "Douala", destination: "Yaoundé",   heureDepart: "2026-04-01T06:30:00Z", heureArrivee: "2026-04-01T10:15:00Z", prix: 6000,  placesDisponibles: 4,  type: "VIP",     agenceNom: "General Voyages", codeAgence: "GEN", codeFiliale: "BYDE" },
  { id: 2,  origine: "Douala", destination: "Yaoundé",   heureDepart: "2026-04-01T08:00:00Z", heureArrivee: "2026-04-01T12:15:00Z", prix: 3500,  placesDisponibles: 18, type: "CLASSIC", agenceNom: "Binam Voyage",    codeAgence: "BNM", codeFiliale: "DKLA" },
  { id: 3,  origine: "Douala", destination: "Yaoundé",   heureDepart: "2026-04-01T10:30:00Z", heureArrivee: "2026-04-01T14:00:00Z", prix: 8000,  placesDisponibles: 2,  type: "VIP",     agenceNom: "Finex Voyage",    codeAgence: "FNX", codeFiliale: "BYDE" },
  { id: 4,  origine: "Douala", destination: "Bafoussam", heureDepart: "2026-04-01T07:00:00Z", heureArrivee: "2026-04-01T13:00:00Z", prix: 5000,  placesDisponibles: 22, type: "CLASSIC", agenceNom: "General Voyages", codeAgence: "GEN", codeFiliale: "BYDE" },
  { id: 5,  origine: "Douala", destination: "Kribi",     heureDepart: "2026-04-01T09:00:00Z", heureArrivee: "2026-04-01T12:30:00Z", prix: 3000,  placesDisponibles: 35, type: "CLASSIC", agenceNom: "Buca Voyages",    codeAgence: "BCA", codeFiliale: "DKLA" },
];

// ─── Réservations ─────────────────────────────────────────────────────────────
export const MOCK_RESERVATIONS = [
  { id: 1, idVoyage: 1, idVoyageur: 4, nombrePlaces: 2, canal: "WEB",     codeAgence: "GEN", codeFiliale: "BYDE", statut: "PAYEE",     montantTotal: 12000, dateReservation: "2026-03-20T10:00:00Z" },
  { id: 2, idVoyage: 2, idVoyageur: 4, nombrePlaces: 1, canal: "GUICHET", codeAgence: "BNM", codeFiliale: "DKLA", statut: "CONFIRMEE", montantTotal: 3500,  dateReservation: "2026-03-21T14:00:00Z" },
  { id: 3, idVoyage: 3, idVoyageur: 6, nombrePlaces: 3, canal: "WEB",     codeAgence: "FNX", codeFiliale: "BYDE", statut: "EN_ATTENTE",montantTotal: 24000, dateReservation: "2026-03-22T08:00:00Z" },
  { id: 4, idVoyage: 1, idVoyageur: 7, nombrePlaces: 1, canal: "WEB",     codeAgence: "GEN", codeFiliale: "BYDE", statut: "ANNULEE",   montantTotal: 6000,  dateReservation: "2026-03-18T11:00:00Z" },
];

// ─── Tickets ──────────────────────────────────────────────────────────────────
export const MOCK_TICKETS = [
  { id: 1, idReservation: 1, numeroTicket: "GEN-WEB-20260320-BYDE-000001", type: "WEB", nomVoyageur: "Jean Dupont", telephoneVoyageur: "+237699000004", origine: "Douala", destination: "Yaoundé", dateDepart: "2026-04-01", immatriculationBus: "LT-1234-A", statut: "ACTIF",   dateEmission: "2026-03-20T10:05:00Z", cheminPdf: "/billets/GEN-WEB-20260320-BYDE-000001.pdf" },
  { id: 2, idReservation: 2, numeroTicket: "BNM-EMB-20260321-DKLA-000001", type: "EMB", nomVoyageur: "Jean Dupont", telephoneVoyageur: "+237699000004", origine: "Douala", destination: "Yaoundé", dateDepart: "2026-04-01", immatriculationBus: "NW-567-B",  statut: "ACTIF",   dateEmission: "2026-03-21T14:05:00Z", cheminPdf: null },
];

// ─── Voyageur info ────────────────────────────────────────────────────────────
export const MOCK_VOYAGEUR = {
  id: 4, nom: "Dupont", surname: "Jean", email: "jean.dupont@gmail.com",
  phone: "+237699000004", adresse: "Akwa, Douala",
};

// ─── Voyage détail ────────────────────────────────────────────────────────────
export const MOCK_VOYAGE_DETAIL = {
  id: 1, prix: 6000, origine: "Douala", destination: "Yaoundé",
  dateHeureDepart: "2026-04-01T06:30:00",
  immatriculationBus: "LT-1234-A",
  nomResponsable: "Jean Dupont",
};

// ─── Auth responses ───────────────────────────────────────────────────────────
export const MOCK_AUTH_USERS = {
  "admin@njila.cm":           { id: 1, nom: "Nguembu",  prenom: "John",    email: "admin@njila.cm",           role: "ADMIN",          accessToken: "mock-token-admin",   refreshToken: "mock-refresh-admin"   },
  "manager@generalvoyages.cm":{ id: 2, nom: "Kamga",    prenom: "Marie",   email: "manager@generalvoyages.cm", role: "MANAGER_GLOBAL", accessToken: "mock-token-manager-g",refreshToken: "mock-refresh-mg"     },
  "local@generalvoyages.cm":  { id: 3, nom: "Tagne",    prenom: "Fabrice", email: "local@generalvoyages.cm",   role: "MANAGER_LOCAL",  accessToken: "mock-token-manager-l",refreshToken: "mock-refresh-ml"     },
  "guichet@generalvoyages.cm":{ id: 5, nom: "Etoa",     prenom: "Samuel",  email: "guichet@generalvoyages.cm", role: "GUICHETIER",     accessToken: "mock-token-guichet",  refreshToken: "mock-refresh-g"       },
  "jean@gmail.com":           { id: 4, nom: "Dupont",   prenom: "Jean",    email: "jean@gmail.com",            role: "VOYAGEUR",       accessToken: "mock-token-voyageur", refreshToken: "mock-refresh-v"       },
};

// ─── Fidelité ─────────────────────────────────────────────────────────────────
export const MOCK_FIDELITE = {
  idVoyageur: 4, codeAgence: "GEN", nombreVoyages: 7,
  voyageGratuit: false, voyagesRestants: 3,
  message: "Encore 3 voyage(s) pour obtenir un voyage gratuit.",
};

// ─── Stats filiale ────────────────────────────────────────────────────────────
export const MOCK_STATS_FILIALE = {
  recettesTotales: 4280500, tauxOccupation: 84.2, busActifs: 24, totalBus: 32,
  voyagesAujourdhui: 24, placesDisponibles: 342, revenuPrevu: 2400000,
};
