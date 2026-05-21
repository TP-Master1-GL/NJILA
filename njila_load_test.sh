#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# NJILA — Script de Test de Charge avec HEY
# Microservices : Auth | User | Fleet | Booking | Payment | Notification | Subscribe
# Niveau        : Intensif — 500 req/s | JWT Bearer Token
# ═══════════════════════════════════════════════════════════════════════════════

# ─── CONFIGURATION ─────────────────────────────────────────────────────────────
BASE_URL="http://localhost:8888"
DURATION="60s"           # Durée de chaque test
RATE=500                 # Requêtes par seconde
CONCURRENCY=100          # Workers concurrents
TIMEOUT=30            # Timeout par requête

# ⚠️  Remplace ce token avant de lancer (token valide ~3h20 après login)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1YmJiNmViZS02NTE5LTQ1YjQtOWQwNC1iZDExMjFmYzA2ODgiLCJyb2xlIjoiQURNSU5JU1RSQVRFVVIiLCJzZXNzaW9uX2lkIjoiMmQxY2NlMjQtNjU1Yi00NDNhLTk2ZTgtNmRhZmI4YmVkOGY4IiwiZmlsaWFsZV9pZCI6bnVsbCwiYWdlbmNlX2lkIjpudWxsLCJpYXQiOjE3NzkwNTQxOTQsImV4cCI6MTc3OTA2NjE5NCwianRpIjoiYjk5ZWFhZTctZTI5MC00MWNlLWFlMjItYTFhZWJiODVkNjc4In0.o76fauu_7b8Q9W9iPIveFU-tVQ21cTLkdIMLNrCP8W0"

AUTH_HEADER="Authorization: Bearer $TOKEN"
CT_HEADER="Content-Type: application/json"

# ─── IDs de test (adapte selon tes données réelles) ───────────────────────────
AGENCE_ID="1"
FILIALE_ID="1"
BUS_ID="1"
CHAUFFEUR_ID="1"
TRAJET_ID="1"
VOYAGE_ID="1"
BOOKING_ID="1"
USER_ID="5bbb6ebe-6519-45b4-9d04-bd1121fc0688"
STAFF_ID="1"
ANNONCE_ID="1"

# ─── Couleurs terminal ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ─── Vérification de hey ───────────────────────────────────────────────────────
if ! command -v hey &> /dev/null; then
  echo -e "${RED}❌  'hey' n'est pas installé.${NC}"
  echo -e "${YELLOW}👉  Installe-le : go install github.com/rakyll/hey@latest${NC}"
  echo -e "    ou : sudo apt install hey"
  exit 1
fi

# ─── Fonction utilitaire ───────────────────────────────────────────────────────
run_test() {
  local label="$1"; local cmd="$2"
  echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}🔥 TEST : $label${NC}"
  echo -e "${YELLOW}CMD : $cmd${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  eval "$cmd"
  echo -e "${GREEN}✅  Terminé : $label${NC}"
}

# ─── AUTO-LOGIN (récupère un token frais) ─────────────────────────────────────
refresh_token() {
  echo -e "${YELLOW}🔄  Rafraîchissement du token JWT...${NC}"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"ronelmaamoc52@gmail.com","password":"Ronel789"}')
  TOKEN=$(echo "$RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
  AUTH_HEADER="Authorization: Bearer $TOKEN"
  echo -e "${GREEN}✅  Token rafraîchi${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${GREEN}"
echo "  ███╗   ██╗     ██╗██╗██╗      █████╗ "
echo "  ████╗  ██║     ██║██║██║     ██╔══██╗"
echo "  ██╔██╗ ██║     ██║██║██║     ███████║"
echo "  ██║╚██╗██║██   ██║██║██║     ██╔══██║"
echo "  ██║ ╚████║╚█████╔╝██║███████╗██║  ██║"
echo "  ╚═╝  ╚═══╝ ╚════╝ ╚═╝╚══════╝╚═╝  ╚═╝"
echo -e "${NC}${BOLD}     🚀 LOAD TEST — 500 req/s | $DURATION par test${NC}\n"

# ─── Option : choisir les services à tester ───────────────────────────────────
echo -e "${BOLD}Sélectionne les services à tester (séparés par espace, ou 'all'):${NC}"
echo "  1) AUTH       2) USER       3) FLEET"
echo "  4) BOOKING    5) PAYMENT    6) NOTIFICATION    7) SUBSCRIBE"
echo ""
read -rp "Choix [all] : " CHOICE
CHOICE=${CHOICE:-all}

run_auth=false; run_user=false; run_fleet=false
run_booking=false; run_payment=false; run_notif=false; run_subscribe=false

if [[ "$CHOICE" == "all" ]]; then
  run_auth=true; run_user=true; run_fleet=true
  run_booking=true; run_payment=true; run_notif=true; run_subscribe=true
else
  [[ "$CHOICE" == *"1"* ]] && run_auth=true
  [[ "$CHOICE" == *"2"* ]] && run_user=true
  [[ "$CHOICE" == *"3"* ]] && run_fleet=true
  [[ "$CHOICE" == *"4"* ]] && run_booking=true
  [[ "$CHOICE" == *"5"* ]] && run_payment=true
  [[ "$CHOICE" == *"6"* ]] && run_notif=true
  [[ "$CHOICE" == *"7"* ]] && run_subscribe=true
fi

refresh_token

# ═══════════════════════════════════════════════════════════════════════════════
# 0. AUTH SERVICE
# ═══════════════════════════════════════════════════════════════════════════════
if $run_auth; then
  echo -e "\n${BOLD}${YELLOW}══ 0. AUTH SERVICE ══${NC}"

  # GET — Mon profil
  run_test "AUTH — GET /api/auth/me" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/auth/me"

  # GET — Lister les utilisateurs (admin)
  run_test "AUTH — GET /api/auth/users (admin)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/auth/users"

  # POST — Login (public, sans auth)
  run_test "AUTH — POST /api/auth/login (public)" \
    "hey -z $DURATION -q 100 -c 20 -t 30 \
      -m POST \
      -H '$CT_HEADER' \
      -d '{\"email\":\"ronelmaamoc52@gmail.com\",\"password\":\"Ronel789\"}' \
      $BASE_URL/api/auth/login"

  # PUT — Mise à jour profil
  run_test "AUTH — PUT /api/auth/me (update profile)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m PUT \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"name\":\"Ronel\",\"surname\":\"Maamoc\"}' \
      $BASE_URL/api/auth/me"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 1. USER SERVICE
# ═══════════════════════════════════════════════════════════════════════════════
if $run_user; then
  echo -e "\n${BOLD}${YELLOW}══ 1. USER SERVICE ══${NC}"

  # GET — Liste utilisateurs (admin)
  run_test "USER — GET /api/users/admin/list" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/users/admin/users"

  # GET — Staff par ID
  run_test "USER — GET /api/users/staff/:id" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/users/staff/$STAFF_ID"

  # GET — Employés d'une agence
  run_test "USER — GET /api/users/agences/:id/employes" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/users/agences/$AGENCE_ID/employes"

  # GET — Chauffeurs d'une filiale
  run_test "USER — GET /api/users/filiales/:id/chauffeurs" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/users/filiales/$FILIALE_ID/chauffeurs"

  # GET — Avis agence (public, sans auth)
  run_test "USER — GET /api/users/avis/agence/:id (public)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      $BASE_URL/api/users/avis/agence/$AGENCE_ID"

  # POST — Créer un employé (admin)
  run_test "USER — POST /api/users/admin/employe" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m POST \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"name\":\"Test\",\"surname\":\"Employe\",\"email\":\"employe.test@njila.cm\",\"role\":\"GUICHETIER\",\"filialeId\":\"$FILIALE_ID\"}' \
      $BASE_URL/api/users/admin/employes"

  # PUT — Modifier un staff
  run_test "USER — PUT /api/users/staff/:id" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m PUT \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"name\":\"Staff\",\"surname\":\"Update\"}' \
      $BASE_URL/api/users/staff/$STAFF_ID"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 2. FLEET SERVICE
# ═══════════════════════════════════════════════════════════════════════════════
if $run_fleet; then
  echo -e "\n${BOLD}${YELLOW}══ 2. FLEET SERVICE ══${NC}"

  # ─ GET publics (sans auth) ─
  run_test "FLEET — GET /api/agences (public)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      $BASE_URL/api/agences"

  run_test "FLEET — GET /api/filiales (public)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      $BASE_URL/api/filiales"

  run_test "FLEET — GET /api/bus/disponibles (public)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      $BASE_URL/api/bus/disponibles"

  run_test "FLEET — GET /api/voyages/recherche (public)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      '$BASE_URL/api/voyages/recherche?origine=Yaoundé&destination=Douala'"

  run_test "FLEET — GET /api/trajets (public)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      $BASE_URL/api/trajets"

  run_test "FLEET — GET /api/voyages/:id (public)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      $BASE_URL/api/voyages/$VOYAGE_ID"

  run_test "FLEET — GET /api/annonces (public)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      $BASE_URL/api/annonces"

  run_test "FLEET — GET /api/stats (public)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      $BASE_URL/api/stats"

  # ─ POST privés (auth requis) ─
  run_test "FLEET — POST /api/agences (create)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m POST \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"nom\":\"Agence Test\",\"ville\":\"Yaoundé\",\"adresse\":\"Rue Test 123\",\"telephone\":\"699000000\"}' \
      $BASE_URL/api/agences"

  run_test "FLEET — POST /api/bus (create)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m POST \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"immatriculation\":\"LT-TEST-001\",\"marque\":\"Mercedes\",\"capacite\":50,\"filialeId\":\"$FILIALE_ID\"}' \
      $BASE_URL/api/bus"

  run_test "FLEET — POST /api/voyages (create)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m POST \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"trajetId\":\"$TRAJET_ID\",\"busId\":\"$BUS_ID\",\"chauffeurId\":\"$CHAUFFEUR_ID\",\"dateDepart\":\"2026-06-01T08:00:00\",\"prix\":3500}' \
      $BASE_URL/api/voyages"

  run_test "FLEET — POST /api/trajets (create)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m POST \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"origine\":\"Yaoundé\",\"destination\":\"Douala\",\"dureeEstimee\":\"4h\",\"distance\":250}' \
      $BASE_URL/api/trajets"

  # ─ PUT privés ─
  run_test "FLEET — PUT /api/bus/:id/etat (update état)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m PUT \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"etat\":\"EN_SERVICE\"}' \
      $BASE_URL/api/bus/$BUS_ID/etat"

  run_test "FLEET — PUT /api/agences/:id (update agence)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m PUT \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"nom\":\"Agence Mise a Jour\",\"telephone\":\"699111111\"}' \
      $BASE_URL/api/agences/$AGENCE_ID"

  run_test "FLEET — PUT /api/chauffeurs/:id/disponibilite" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m PUT \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"disponible\":true}' \
      $BASE_URL/api/chauffeurs/$CHAUFFEUR_ID/disponibilite"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 3. BOOKING SERVICE
# ═══════════════════════════════════════════════════════════════════════════════
if $run_booking; then
  echo -e "\n${BOLD}${YELLOW}══ 3. BOOKING SERVICE ══${NC}"

  run_test "BOOKING — GET /api/bookings (mes réservations)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/bookings"

  run_test "BOOKING — GET /api/bookings/:id" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/bookings/$BOOKING_ID"

  run_test "BOOKING — POST /api/bookings (create réservation)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m POST \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"voyageId\":\"$VOYAGE_ID\",\"nombrePlaces\":2,\"passagers\":[{\"nom\":\"Test\",\"prenom\":\"Passager\",\"cni\":\"123456789\"}]}' \
      $BASE_URL/api/bookings"

  run_test "BOOKING — PUT /api/bookings/:id (update statut)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m PUT \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"statut\":\"CONFIRME\"}' \
      $BASE_URL/api/bookings/$BOOKING_ID"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 4. PAYMENT SERVICE
# ═══════════════════════════════════════════════════════════════════════════════
if $run_payment; then
  echo -e "\n${BOLD}${YELLOW}══ 4. PAYMENT SERVICE ══${NC}"

  run_test "PAYMENT — GET /api/v1/payment/history" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/v1/payment/history"

  run_test "PAYMENT — GET /api/v1/payment/status/:bookingId" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/v1/payment/status/$BOOKING_ID"

  run_test "PAYMENT — POST /api/v1/payment/initiate" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m POST \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"bookingId\":\"$BOOKING_ID\",\"montant\":7000,\"methode\":\"MOBILE_MONEY\",\"numero\":\"699000000\"}' \
      $BASE_URL/api/v1/payment/initiate"

  run_test "PAYMENT — PUT /api/v1/payment/confirm" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m PUT \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"transactionId\":\"TXN-TEST-001\",\"statut\":\"SUCCESS\"}' \
      $BASE_URL/api/v1/payment/confirm"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 5. NOTIFICATION SERVICE
# ═══════════════════════════════════════════════════════════════════════════════
if $run_notif; then
  echo -e "\n${BOLD}${YELLOW}══ 5. NOTIFICATION SERVICE ══${NC}"

  run_test "NOTIF — GET /api/notifications (mes notifs)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/notifications"

  run_test "NOTIF — PUT /api/notifications/:id/read (marquer lu)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m PUT \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"lu\":true}' \
      $BASE_URL/api/notifications/1/read"

  run_test "NOTIF — POST /api/notifications/send (admin)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m POST \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"titre\":\"Test Load\",\"message\":\"Notification de test de charge\",\"type\":\"INFO\",\"userId\":\"$USER_ID\"}' \
      $BASE_URL/api/notifications/send"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 6. SUBSCRIBE SERVICE
# ═══════════════════════════════════════════════════════════════════════════════
if $run_subscribe; then
  echo -e "\n${BOLD}${YELLOW}══ 6. SUBSCRIBE SERVICE ══${NC}"

  run_test "SUBSCRIBE — GET /api/subscribe (mes abonnements)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/subscribe"

  run_test "SUBSCRIBE — GET /api/agencies (liste agences)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -H '$AUTH_HEADER' \
      $BASE_URL/api/agencies"

  run_test "SUBSCRIBE — POST /api/subscribe (s'abonner)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m POST \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"agenceId\":\"$AGENCE_ID\",\"plan\":\"MENSUEL\"}' \
      $BASE_URL/api/subscribe"

  run_test "SUBSCRIBE — PUT /api/subscribe/:id (update abonnement)" \
    "hey -z $DURATION -q $RATE -c $CONCURRENCY -t 30 \
      -m PUT \
      -H '$AUTH_HEADER' \
      -H '$CT_HEADER' \
      -d '{\"plan\":\"ANNUEL\",\"statut\":\"ACTIF\"}' \
      $BASE_URL/api/subscribe/1"
fi

# ═══════════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${GREEN}"
echo "  ✅  TOUS LES TESTS TERMINÉS"
echo "  📊  Analyse les résultats ci-dessus :"
echo "      → Requests/sec réel vs cible (500)"
echo "      → Latence P50 / P95 / P99"
echo "      → Taux d'erreurs (4xx / 5xx)"
echo "      → Circuit Breaker trips (logs Gateway)"
echo -e "${NC}"
echo -e "${YELLOW}💡  Pour voir les circuit breakers :${NC}"
echo "    curl http://localhost:8888/actuator/circuitbreakerevents | jq ."
echo ""
echo -e "${YELLOW}💡  Pour voir les métriques gateway :${NC}"
echo "    curl http://localhost:8888/actuator/metrics | jq ."
# ═══════════════════════════════════════════════════════════════════════════════