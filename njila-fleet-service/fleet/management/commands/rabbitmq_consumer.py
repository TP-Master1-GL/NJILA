from django.core.management.base import BaseCommand
import logging
import time

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Démarre le consommateur RabbitMQ pour le fleet-service'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--stop',
            action='store_true',
            help='Arrêter le consommateur',
        )
    
    def handle(self, *args, **options):
        from fleet import consumers
        
        if options['stop']:
            self.stdout.write("Arrêt du consommateur RabbitMQ...")
            consumers.stop_consumer()
            self.stdout.write(self.style.SUCCESS("Consommateur arrêté"))
        else:
            self.stdout.write("Démarrage du consommateur RabbitMQ...")
            consumers.start_consumer()
            self.stdout.write(self.style.SUCCESS("Consommateur démarré"))
            
            # Maintenir le script en vie
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                self.stdout.write("\nArrêt du consommateur...")
                consumers.stop_consumer()
                self.stdout.write(self.style.SUCCESS("Consommateur arrêté"))