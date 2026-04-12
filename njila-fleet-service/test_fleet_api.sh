#!/bin/bash

# Configuration
BASE_URL="http://localhost:8088/api"
# REMPLACEZ CE TOKEN PAR UN NOUVEAU TOKEN VALIDE
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5YjBiNGM2Ny02YTI0LTQyZTAtOWEzZS0wOTY2NDRhNmVmM2MiLCJyb2xlIjoiQURNSU5JU1RSQVRFVVIiLCJzZXNzaW9uX2lkIjoiZWM2NWI4NGEtY2NiZS00MmI2LTkyM2MtODNmYTQzMTY2ODcwIiwiZmlsaWFsZV9pZCI6bnVsbCwiYWdlbmNlX2lkIjpudWxsLCJpYXQiOjE3NzU1Njc3NTEsImV4cCI6MTc3NTU2ODY1MSwianRpIjoiNGRiODZjZWItOWMxZC00NTczLTg0YTItMTFlNzI3NzkwNjQ3In0.CJ-9gspApXZHaYbYF_me_MbS1C7ci6UtIQQBfCR14RA"

# Utiliser l'agence existante
AGENCE_ID="239c0610-5e18-4ea7-b3fd-1eab91278934"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        if [ ! -z "$3" ]; then
            echo -e "${YELLOW}   Response: $3${NC}"
        fi
    fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   FLEET SERVICE API TEST SUITE${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test Health Check
echo -e "${YELLOW}1. TEST HEALTH CHECK${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/health/")
if echo "$RESPONSE" | grep -q "healthy"; then
    print_result 0 "Health check endpoint"
else
    print_result 1 "Health check endpoint" "$RESPONSE"
fi
echo ""

# ============ FILIALES ============
echo -e "${YELLOW}2. TEST FILIALES${NC}"

# Create Filiale
echo -e "${BLUE}   - Creating filiale...${NC}"
DATA=$(cat <<EOF
{
    "nom": "Agence Centrale Douala",
    "code": "DOU-CEN-01",
    "ville": "Douala",
    "adresse": "123 Boulevard de la Liberté, Douala",
    "telephone": "699999990",
    "email": "douala@generalvoyages.cm",
    "est_active": true,
    "agence": "$AGENCE_ID"
}
EOF
)

RESPONSE=$(curl -s -X POST "$BASE_URL/filiales/" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$DATA")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "id_filiale"; then
    FILIALE_ID=$(echo "$RESPONSE" | grep -o '"id_filiale":"[^"]*"' | cut -d'"' -f4)
    print_result 0 "Create filiale (ID: $FILIALE_ID)"
    
    # Get Filiale by ID
    echo -e "${BLUE}   - Getting filiale details...${NC}"
    RESPONSE=$(curl -s -X GET "$BASE_URL/filiales/$FILIALE_ID/" \
        -H "Authorization: Bearer $TOKEN")
    if echo "$RESPONSE" | grep -q "id_filiale"; then
        print_result 0 "Get filiale details"
    else
        print_result 1 "Get filiale details" "$RESPONSE"
    fi
    
    # Get Filiale Stats
    echo -e "${BLUE}   - Getting filiale stats...${NC}"
    RESPONSE=$(curl -s -X GET "$BASE_URL/filiales/$FILIALE_ID/stats/" \
        -H "Authorization: Bearer $TOKEN")
    if echo "$RESPONSE" | grep -q "bus_stats"; then
        print_result 0 "Get filiale stats"
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    else
        print_result 1 "Get filiale stats" "$RESPONSE"
    fi
else
    print_result 1 "Create filiale" "$RESPONSE"
fi
echo ""

# ============ BUS ============
echo -e "${YELLOW}3. TEST BUS${NC}"

# Create Bus
echo -e "${BLUE}   - Creating bus...${NC}"
DATA=$(cat <<EOF
{
    "immatriculation": "LT 999 AB",
    "modele": "Toyota Hiace",
    "capacite": 30,
    "etat": "disponible",
    "Id_agence": "$AGENCE_ID"
}
EOF
)

RESPONSE=$(curl -s -X POST "$BASE_URL/bus/" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$DATA")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "IdBus"; then
    BUS_ID=$(echo "$RESPONSE" | grep -o '"IdBus":[0-9]*' | cut -d':' -f2)
    print_result 0 "Create bus (ID: $BUS_ID)"
    
    # List Buses
    echo -e "${BLUE}   - Listing all buses...${NC}"
    RESPONSE=$(curl -s -X GET "$BASE_URL/bus/?agence_id=$AGENCE_ID" \
        -H "Authorization: Bearer $TOKEN")
    if echo "$RESPONSE" | grep -q "IdBus"; then
        print_result 0 "List buses"
    else
        print_result 1 "List buses" "$RESPONSE"
    fi
else
    print_result 1 "Create bus" "$RESPONSE"
fi
echo ""

# ============ CHAUFFEURS ============
echo -e "${YELLOW}4. TEST CHAUFFEURS${NC}"

# Create Chauffeur
echo -e "${BLUE}   - Creating chauffeur...${NC}"
DATA=$(cat <<EOF
{
    "numero_permis": "P12345678",
    "name": "Jean",
    "surname": "Nkomo",
    "email": "jean.nkomo@general.cm",
    "phone": "677777777",
    "Adresse": "Quartier Makepe, Douala",
    "date_embauche": "2024-01-01",
    "Id_agence": "$AGENCE_ID",
    "est_disponible": true
}
EOF
)

RESPONSE=$(curl -s -X POST "$BASE_URL/chauffeurs/" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$DATA")

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "id_chauffeur"; then
    CHAUFFEUR_ID=$(echo "$RESPONSE" | grep -o '"id_chauffeur":"[^"]*"' | cut -d'"' -f4)
    print_result 0 "Create chauffeur (ID: $CHAUFFEUR_ID)"
    
    # Update Chauffeur Availability
    echo -e "${BLUE}   - Updating chauffeur availability...${NC}"
    RESPONSE=$(curl -s -X PUT "$BASE_URL/chauffeurs/$CHAUFFEUR_ID/disponibilite/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"est_disponible": false}')
    if echo "$RESPONSE" | grep -q "Disponibilité"; then
        print_result 0 "Update chauffeur availability"
    else
        print_result 1 "Update chauffeur availability" "$RESPONSE"
    fi
else
    print_result 1 "Create chauffeur" "$RESPONSE"
fi
echo ""

# ============ TRAJETS ============
echo -e "${YELLOW}5. TEST TRAJETS${NC}"

# Create second filiale for trajet
echo -e "${BLUE}   - Creating second filiale...${NC}"
DATA=$(cat <<EOF
{
    "nom": "Agence Yaoundé",
    "code": "YAO-CEN-01",
    "ville": "Yaoundé",
    "adresse": "456 Avenue Mvog-Mbi, Yaoundé",
    "telephone": "699999991",
    "email": "yaounde@generalvoyages.cm",
    "est_active": true,
    "agence": "$AGENCE_ID"
}
EOF
)

RESPONSE=$(curl -s -X POST "$BASE_URL/filiales/" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$DATA")

if echo "$RESPONSE" | grep -q "id_filiale"; then
    FILIALE2_ID=$(echo "$RESPONSE" | grep -o '"id_filiale":"[^"]*"' | cut -d'"' -f4)
    print_result 0 "Create second filiale (ID: $FILIALE2_ID)"
    
    # Create Trajet
    echo -e "${BLUE}   - Creating trajet...${NC}"
    DATA=$(cat <<EOF
{
    "filiale_depart": "$FILIALE_ID",
    "filiale_arrive": "$FILIALE2_ID",
    "distance": 250.5,
    "est_actif": true
}
EOF
)
    RESPONSE=$(curl -s -X POST "$BASE_URL/trajets/" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$DATA")
    
    if echo "$RESPONSE" | grep -q "Id_trajet"; then
        TRAJET_ID=$(echo "$RESPONSE" | grep -o '"Id_trajet":"[^"]*"' | cut -d'"' -f4)
        print_result 0 "Create trajet (ID: $TRAJET_ID)"
    else
        print_result 1 "Create trajet" "$RESPONSE"
    fi
else
    print_result 1 "Create second filiale" "$RESPONSE"
fi
echo ""

# Afficher le résumé
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   TEST SUITE COMPLETED${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}IDs créés:${NC}"
echo "  AGENCE_ID (existing): $AGENCE_ID"
echo "  FILIALE_ID: $FILIALE_ID"
echo "  FILIALE2_ID: $FILIALE2_ID"
echo "  BUS_ID: $BUS_ID"
echo "  CHAUFFEUR_ID: $CHAUFFEUR_ID"
echo "  TRAJET_ID: $TRAJET_ID"
echo ""

echo -e "${YELLOW}Pour vérifier les événements RabbitMQ:${NC}"
echo "  sudo rabbitmqctl list_queues | grep njila"
echo "  ou ouvrez http://localhost:15672 (guest/guest)"