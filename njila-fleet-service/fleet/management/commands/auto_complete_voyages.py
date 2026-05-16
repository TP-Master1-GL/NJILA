"""
Management command: Auto-complete voyages when arrival time is reached
Fichier: fleet/management/commands/auto_complete_voyages.py

Ce command doit être exécuté périodiquement (toutes les minutes) via Celery ou APScheduler.
Usage: python manage.py auto_complete_voyages
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from fleet.models import Voyage, StatusVoyage, StatusBus, Chauffeur, Bus
from fleet.rabbitmq import publish_bus_updated_for_booking, publish_voyage_updated_for_booking
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Auto-complete voyages when arrival time is reached"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simule les mises à jour sans les appliquer',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        now = timezone.now()

        # Chercher les voyages en cours dont l'heure d'arrivée est passée
        voyages_a_completer = Voyage.objects.filter(
            status=StatusVoyage.EN_COURS,
            date_heure_arrive_prevue__lte=now
        )

        count = 0
        errors = 0

        for voyage in voyages_a_completer:
            try:
                self._complete_voyage(voyage, dry_run)
                count += 1
            except Exception as e:
                logger.error(
                    f"Erreur lors de la completion du voyage {voyage.Id_voyage}: {str(e)}"
                )
                errors += 1

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] {count} voyage(s) auraient été marqué(s) comme terminé(s)"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ {count} voyage(s) marqué(s) comme terminé(s)"
                )
            )
            if errors > 0:
                self.stdout.write(
                    self.style.ERROR(f"✗ {errors} erreur(s) lors de la completion")
                )

    def _complete_voyage(self, voyage, dry_run=False):
        """
        Marque un voyage comme terminé et libère les ressources associées
        """
        if dry_run:
            self.stdout.write(
                f"[DRY RUN] Voyage {voyage.Id_voyage} "
                f"({voyage.Id_trajet}) serait marqué comme terminé"
            )
            return

        ancien_status = voyage.status
        voyage.status = StatusVoyage.TERMINE
        voyage.save()

        events_status = {}

        # ── Libérer le bus ────────────────────────────────────────────
        if voyage.IdBus:
            bus = voyage.IdBus
            bus.etat = StatusBus.DISPONIBLE
            bus.save()
            event_sent = publish_bus_updated_for_booking(bus)
            events_status['bus_updated'] = event_sent
            logger.info(
                f"Bus {bus.immatriculation} libéré (voyage {voyage.Id_voyage} terminé)"
            )

        # ── Libérer le chauffeur ──────────────────────────────────────
        if voyage.id_chauffeur:
            chauffeur = voyage.id_chauffeur
            chauffeur.est_disponible = True
            chauffeur.save()
            logger.info(
                f"Chauffeur {chauffeur.name} {chauffeur.surname} libéré "
                f"(voyage {voyage.Id_voyage} terminé)"
            )

        # ── Publier la mise à jour du voyage ──────────────────────────
        event_sent = publish_voyage_updated_for_booking(voyage)
        events_status['voyage_updated'] = event_sent

        all_sent = all(events_status.values())
        if all_sent:
            logger.info(
                f"Voyage {voyage.Id_voyage} auto-complété: {ancien_status} → TERMINE | "
                f"RabbitMQ: tous les événements envoyés ✓ | {events_status}"
            )
        else:
            logger.warning(
                f"Voyage {voyage.Id_voyage} auto-complété: {ancien_status} → TERMINE | "
                f"RabbitMQ: certains événements ont échoué ✗ | {events_status}"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Voyage {voyage.Id_voyage} ({voyage.Id_trajet}) "
                f"-> TERMINE (bus et chauffeur libérés)"
            )
        )