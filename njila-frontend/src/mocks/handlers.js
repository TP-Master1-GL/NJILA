import { http, HttpResponse, delay } from "msw";
import {
  MOCK_AGENCES, MOCK_TABLEAU_DE_BORD, MOCK_USERS,
  MOCK_VOYAGES_SEARCH, MOCK_RESERVATIONS, MOCK_TICKETS,
  MOCK_VOYAGEUR, MOCK_VOYAGE_DETAIL, MOCK_AUTH_USERS,
  MOCK_FIDELITE, MOCK_STATS_FILIALE,
} from "./data";

const BASE = "http://localhost:8888";
const LAT  = 400; // délai simulé en ms

export const handlers = [

  // ── Auth ────────────────────────────────────────────────────────────────────
  http.post(`${BASE}/api/auth/login`, async ({ request }) => {
    await delay(LAT);
    const { email } = await request.json();
    const user = MOCK_AUTH_USERS[email];
    if (!user) {
      return HttpResponse.json({ message: "Identifiants incorrects" }, { status: 401 });
    }
    return HttpResponse.json({ user, accessToken: user.accessToken, refreshToken: user.refreshToken });
  }),

  http.post(`${BASE}/api/auth/register`, async () => {
    await delay(LAT);
    return HttpResponse.json({ message: "Compte créé avec succès" }, { status: 201 });
  }),

  http.post(`${BASE}/api/auth/logout`, async () => {
    await delay(100);
    return HttpResponse.json({ message: "Déconnecté" });
  }),

  http.get(`${BASE}/api/auth/me`, async () => {
    await delay(100);
    return HttpResponse.json(MOCK_AUTH_USERS["admin@njila.cm"]);
  }),

  http.post(`${BASE}/api/auth/refresh`, async () => {
    await delay(100);
    return HttpResponse.json({ accessToken: "mock-token-refreshed" });
  }),

  // ── Subscribe — Admin NJILA ─────────────────────────────────────────────────
  http.get(`${BASE}/api/subscribe/agences`, async () => {
    await delay(LAT);
    return HttpResponse.json(MOCK_AGENCES);
  }),

  http.get(`${BASE}/api/subscribe/agences/:id`, async ({ params }) => {
    await delay(LAT);
    const agence = MOCK_AGENCES.find(a => a.agence_id === params.id || a.id === Number(params.id));
    if (!agence) return HttpResponse.json({ message: "Agence introuvable" }, { status: 404 });
    return HttpResponse.json({ ...agence, abonnement_actuel: { plan: "MENSUEL", statut: "ACTIVE", jours_restants: 22, dateExpiration: "2026-04-22T00:00:00Z" } });
  }),

  http.post(`${BASE}/api/subscribe/agences`, async ({ request }) => {
    await delay(LAT);
    const body = await request.json();
    const newAgence = { id: MOCK_AGENCES.length + 1, statut_global: "EN_ATTENTE", date_inscription: new Date().toISOString(), ...body };
    MOCK_AGENCES.push(newAgence);
    return HttpResponse.json(newAgence, { status: 201 });
  }),

  http.get(`${BASE}/api/subscribe/tableau-de-bord`, async () => {
    await delay(LAT);
    return HttpResponse.json(MOCK_TABLEAU_DE_BORD);
  }),

  http.post(`${BASE}/api/subscribe/agences/:id/souscrire`, async ({ params }) => {
    await delay(800);
    return HttpResponse.json({
      id: 99, id_agence: params.id, plan: "MENSUEL", statut: "ACTIVE",
      jours_restants: 30, cle_privee_pem: "-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----",
      cle_chiffree: "MOCK_ENCRYPTED_KEY",
      avertissement: "Clé privée mock — test uniquement",
    }, { status: 201 });
  }),

  http.post(`${BASE}/api/subscribe/agences/:id/suspendre`, async ({ params }) => {
    await delay(LAT);
    return HttpResponse.json({ id: params.id, statut: "SUSPENDED" });
  }),

  http.post(`${BASE}/api/subscribe/agences/:id/reactiver`, async ({ params }) => {
    await delay(LAT);
    return HttpResponse.json({ id: params.id, statut: "ACTIVE" });
  }),

  http.post(`${BASE}/api/subscribe/agences/:id/renouveler`, async ({ params }) => {
    await delay(800);
    return HttpResponse.json({ id: params.id, statut: "ACTIVE", plan: "MENSUEL", jours_restants: 30 });
  }),

  // ── Users ───────────────────────────────────────────────────────────────────
  http.get(`${BASE}/api/users`, async ({ request }) => {
    await delay(LAT);
    const url    = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const role   = url.searchParams.get("role")   || "";
    let users = MOCK_USERS;
    if (search) users = users.filter(u => `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(search.toLowerCase()));
    if (role)   users = users.filter(u => u.role === role);
    return HttpResponse.json({ users, total: users.length, page: 1 });
  }),

  http.get(`${BASE}/api/users/:id/profile`, async ({ params }) => {
    await delay(LAT);
    const user = MOCK_USERS.find(u => u.id === Number(params.id));
    if (!user) return HttpResponse.json({ message: "Utilisateur introuvable" }, { status: 404 });
    return HttpResponse.json(user);
  }),

  http.patch(`${BASE}/api/users/:id/profile`, async ({ request, params }) => {
    await delay(LAT);
    const body = await request.json();
    const user = MOCK_USERS.find(u => u.id === Number(params.id));
    return HttpResponse.json({ ...user, ...body });
  }),

  // ── Search ──────────────────────────────────────────────────────────────────
  http.get(`${BASE}/api/search/voyages`, async ({ request }) => {
    await delay(600);
    const url    = new URL(request.url);
    const dest   = url.searchParams.get("destination") || "";
    const origin = url.searchParams.get("origine")     || "";
    let voyages = MOCK_VOYAGES_SEARCH;
    if (dest)   voyages = voyages.filter(v => v.destination.toLowerCase().includes(dest.toLowerCase()));
    if (origin) voyages = voyages.filter(v => v.origine.toLowerCase().includes(origin.toLowerCase()));
    return HttpResponse.json(voyages);
  }),

  http.get(`${BASE}/api/search/villes`, async () => {
    await delay(100);
    return HttpResponse.json(["Douala", "Yaoundé", "Bafoussam", "Garoua", "Ngaoundéré", "Bamenda", "Kribi", "Bertoua"]);
  }),

  // ── Fleet ───────────────────────────────────────────────────────────────────
  http.get(`${BASE}/api/fleet/voyages/:id`, async ({ params }) => {
    await delay(LAT);
    const voyage = MOCK_VOYAGES_SEARCH.find(v => v.id === Number(params.id));
    if (!voyage) return HttpResponse.json(MOCK_VOYAGE_DETAIL);
    return HttpResponse.json({
      ...voyage,
      dateHeureDepart: voyage.heureDepart,
      immatriculationBus: "LT-1234-A",
      nomResponsable: "Voyageur",
    });
  }),

  http.get(`${BASE}/api/fleet/voyages/:id/disponibilite`, async () => {
    await delay(200);
    return HttpResponse.json(true);
  }),

  http.get(`${BASE}/api/fleet/bus`, async () => {
    await delay(LAT);
    return HttpResponse.json([
      { id: 1, immatriculation: "LT 789 CD", numero: "Bus #042", type: "VIP",     capacite: 45, dernierService: "2023-10-12", statut: "AVAILABLE" },
      { id: 2, immatriculation: "NW 123 AB", numero: "Bus #038", type: "CLASSIC", capacite: 70, dernierService: "2023-11-05", statut: "ON_TRIP"   },
      { id: 3, immatriculation: "CE 552 XY", numero: "Bus #012", type: "VIP",     capacite: 45, dernierService: "2023-10-20", statut: "MAINTENANCE"},
      { id: 4, immatriculation: "OU 001 AA", numero: "Bus #055", type: "CLASSIC", capacite: 70, dernierService: "2023-11-15", statut: "AVAILABLE" },
    ]);
  }),

  http.post(`${BASE}/api/fleet/bus`, async ({ request }) => {
    await delay(LAT);
    const body = await request.json();
    return HttpResponse.json({ id: 99, statut: "AVAILABLE", ...body }, { status: 201 });
  }),

  http.get(`${BASE}/api/fleet/voyages`, async () => {
    await delay(LAT);
    return HttpResponse.json(MOCK_VOYAGES_SEARCH);
  }),

  http.get(`${BASE}/api/fleet/chauffeurs`, async () => {
    await delay(LAT);
    return HttpResponse.json([
      { id: 1, nom: "Amadou Kouassi",  telephone: "+237677001001", permis: "2027-06-15", statut: "DISPONIBLE", voyages: 142 },
      { id: 2, nom: "Jean-Paul Ngwa",  telephone: "+237677001002", permis: "2026-03-10", statut: "EN_VOYAGE",  voyages: 98  },
      { id: 3, nom: "Fabrice Tagne",   telephone: "+237677001003", permis: "2025-12-31", statut: "DISPONIBLE", voyages: 215 },
    ]);
  }),

  http.get(`${BASE}/api/fleet/filiales`, async () => {
    await delay(LAT);
    return HttpResponse.json([
      { id: 1, nom: "Filiale Biyemassi", ville: "Yaoundé",  code: "BYDE", codeAgence: "GEN" },
      { id: 2, nom: "Filiale Akwa",      ville: "Douala",   code: "DKLA", codeAgence: "GEN" },
      { id: 3, nom: "Filiale Centre",    ville: "Bafoussam",code: "BAFCTR", codeAgence: "BNM" },
    ]);
  }),

  // ── Bookings ────────────────────────────────────────────────────────────────
  http.post(`${BASE}/api/bookings`, async ({ request }) => {
    await delay(800);
    const body = await request.json();
    const newReservation = {
      id: MOCK_RESERVATIONS.length + 1,
      statut: body.canal === "GUICHET" ? "PAYEE" : "EN_ATTENTE",
      dateReservation: new Date().toISOString(),
      montantTotal: (body.nombrePlaces || 1) * 5000,
      ...body,
    };
    MOCK_RESERVATIONS.push(newReservation);
    return HttpResponse.json(newReservation, { status: 201 });
  }),

  http.get(`${BASE}/api/bookings/:id`, async ({ params }) => {
    await delay(LAT);
    const reservation = MOCK_RESERVATIONS.find(r => r.id === Number(params.id));
    if (!reservation) return HttpResponse.json({ message: "Réservation introuvable" }, { status: 404 });
    return HttpResponse.json({ ...reservation, tickets: MOCK_TICKETS.filter(t => t.idReservation === reservation.id) });
  }),

  http.get(`${BASE}/api/bookings/history/:userId`, async ({ params }) => {
    await delay(LAT);
    const reservations = MOCK_RESERVATIONS.filter(r => r.idVoyageur === Number(params.userId));
    return HttpResponse.json(reservations);
  }),

  http.get(`${BASE}/api/bookings/voyage/:voyageId`, async ({ params }) => {
    await delay(LAT);
    return HttpResponse.json(MOCK_RESERVATIONS.filter(r => r.idVoyage === Number(params.voyageId)));
  }),

  http.patch(`${BASE}/api/bookings/:id/cancel`, async ({ params }) => {
    await delay(LAT);
    const r = MOCK_RESERVATIONS.find(r => r.id === Number(params.id));
    if (!r) return HttpResponse.json({ message: "Introuvable" }, { status: 404 });
    r.statut = "ANNULEE";
    return HttpResponse.json(r);
  }),

  http.patch(`${BASE}/api/bookings/:id/confirm`, async ({ params }) => {
    await delay(800);
    return HttpResponse.json({
      id: 99, type: "EMB",
      numeroTicket:       `GEN-EMB-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-BYDE-000099`,
      nomVoyageur:        "Jean Dupont",
      telephoneVoyageur:  "+237699000004",
      origine:            "Douala",
      destination:        "Yaoundé",
      dateDepart:         "2026-04-01",
      immatriculationBus: "LT-1234-A",
      numeroPlace:        "05",
      statut:             "ACTIF",
      dateEmission:       new Date().toISOString(),
    });
  }),

  http.get(`${BASE}/api/bookings/:id/ticket`, async ({ params }) => {
    await delay(LAT);
    const ticket = MOCK_TICKETS.find(t => t.idReservation === Number(params.id));
    if (!ticket) return HttpResponse.json({ message: "Ticket introuvable" }, { status: 404 });
    return HttpResponse.json(ticket);
  }),

  http.get(`${BASE}/api/bookings/:id/ticket/pdf`, async () => {
    await delay(400);
    // Retourner un faux PDF (4 octets = "%PDF")
    return new HttpResponse(new Uint8Array([37, 80, 68, 70]), {
      headers: { "Content-Type": "application/pdf" },
    });
  }),

  http.get(`${BASE}/api/bookings/fidelite/:idVoyageur`, async () => {
    await delay(LAT);
    return HttpResponse.json(MOCK_FIDELITE);
  }),

  // ── Payments ────────────────────────────────────────────────────────────────
  http.post(`${BASE}/api/payments/initiate`, async ({ request }) => {
    await delay(1200);
    const body = await request.json();
    return HttpResponse.json({
      id: 1, bookingId: body.bookingId, statut: "EN_COURS",
      message: "Demande envoyée à l'opérateur. Vérifiez votre téléphone.",
      transactionId: `TXN-${Date.now()}`,
    });
  }),

  http.get(`${BASE}/api/payments/:id/status`, async () => {
    await delay(LAT);
    return HttpResponse.json({ id: 1, statut: "REUSSI", transactionId: `TXN-${Date.now()}` });
  }),

  http.get(`${BASE}/api/payments/history/:userId`, async () => {
    await delay(LAT);
    return HttpResponse.json([
      { id: 1, montant: 12000, statut: "REUSSI",   operateur: "ORANGE_MONEY", datePaiement: "2026-03-20T10:05:00Z", referenceTransaction: "TXN-001" },
      { id: 2, montant: 3500,  statut: "REUSSI",   operateur: "MTN_MONEY",    datePaiement: "2026-03-21T14:05:00Z", referenceTransaction: "TXN-002" },
      { id: 3, montant: 6000,  statut: "REMBOURSE", operateur: "ORANGE_MONEY", datePaiement: "2026-03-18T11:05:00Z", referenceTransaction: "TXN-003" },
    ]);
  }),
];
