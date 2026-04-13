#!/bin/bash

echo "🧪 Nettoyage des anciens rapports..."
coverage erase

echo "🚀 Exécution des tests avec coverage..."
coverage run --source='authentication' manage.py test authentication.tests --verbosity=1

echo "📊 Génération du rapport..."
coverage report -m

echo "🌐 Génération du rapport HTML..."
coverage html

echo "✅ Rapport HTML généré dans htmlcov/index.html"

# Afficher le pourcentage total
TOTAL=$(coverage report | grep TOTAL | awk '{print $4}')
echo "📈 Couverture totale : $TOTAL"
