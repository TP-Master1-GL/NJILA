from django.core.management.base import BaseCommand
from fleet.models import Bus
import random

class Command(BaseCommand):
    help = 'Charge des données de test pour les bus'
    
    def handle(self, *args, **kwargs):
        self.stdout.write('Chargement des bus de test...')
        
        # Nettoyer les données existantes
        Bus.objects.all().delete()
        
        # Données de test
        agences = ['General Voyages', 'Binam', 'Touristique', 'Finex', 'Amour Mezam']
        marques = ['Toyota', 'Higer', 'King Long', 'Mercedes', 'Scania', 'Volvo', 'Isuzu']
        modeles = ['Coaster', 'Bus 60', 'HD', 'Tourismo', 'Intercity', 'Luxury', 'Standard']
        classes = ['standard', 'vip', 'confort', 'luxe']
        status = ['disponible', 'disponible', 'disponible', 'en_voyage', 'en_panne', 'maintenance']
        
        bus_crees = 0
        
        for i in range(20):
            immatriculation = f"LT{random.randint(100, 999)}{random.choice(['AB', 'CD', 'EF', 'GH'])}{random.randint(10, 99)}"
            
            if Bus.objects.filter(immatriculation=immatriculation).exists():
                continue
            
            bus = Bus.objects.create(
                immatriculation=immatriculation,
                modele=random.choice(modeles),
                marque=random.choice(marques),
                capacite=random.choice([30, 45, 60, 70, 80]),
                classe=random.choice(classes),
                status=random.choice(status),
                agence=random.choice(agences)
            )
            bus_crees += 1
            self.stdout.write(f"✓ Bus créé: {bus.immatriculation} - {bus.agence}")
        
        self.stdout.write(self.style.SUCCESS(f'\n✅ {bus_crees} bus créés avec succès!'))