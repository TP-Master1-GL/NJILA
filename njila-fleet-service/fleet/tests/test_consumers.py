import json
import uuid
from django.test import TestCase
from unittest.mock import patch, MagicMock
from django.utils import timezone

from fleet.models import Agence, StatutGlobalAgence
from fleet.consumers import RabbitMQConsumer


class RabbitMQConsumerTest(TestCase):
    """Tests pour le consommateur RabbitMQ"""
    
    def setUp(self):
        self.agence = Agence.objects.create(
            name='Test Agence',
            adresse='Douala',
            telephone='677777777',
            email_officiel='test@agence.com',
            statut_global=StatutGlobalAgence.ACTIVE
        )
    
    def test_handle_subscription_expired(self):
        """Test traitement expiration abonnement"""
        consumer = RabbitMQConsumer()
        
        message = {
            'event_type': 'SUBSCRIPTION_EXPIRED',
            'agence_id': str(self.agence.id_agence),
            'agence_nom': self.agence.name,
            'expires_at': timezone.now().isoformat()
        }
        
        consumer._handle_subscription_expired(message)
        
        self.agence.refresh_from_db()
        self.assertEqual(self.agence.statut_global, 'expiree')
    
    def test_handle_subscription_renewed(self):
        """Test traitement renouvellement abonnement"""
        # D'abord expirer l'agence
        self.agence.statut_global = 'expiree'
        self.agence.save()
        
        consumer = RabbitMQConsumer()
        
        message = {
            'event_type': 'SUBSCRIPTION_RENEWED',
            'agence_id': str(self.agence.id_agence),
            'agence_nom': self.agence.name,
            'new_expires_at': (timezone.now() + timezone.timedelta(days=365)).isoformat()
        }
        
        consumer._handle_subscription_renewed(message)
        
        self.agence.refresh_from_db()
        self.assertEqual(self.agence.statut_global, 'active')
    
    def test_handle_subscription_expired_unknown_agence(self):
        """Test expiration avec agence inconnue (ne doit pas planter)"""
        consumer = RabbitMQConsumer()
        
        message = {
            'event_type': 'SUBSCRIPTION_EXPIRED',
            'agence_id': str(uuid.uuid4()),
            'agence_nom': 'Agence Inconnue',
            'expires_at': timezone.now().isoformat()
        }
        
        # Ne doit pas lever d'exception
        consumer._handle_subscription_expired(message)
        
        # Vérifier que notre agence test n'a pas changé
        self.agence.refresh_from_db()
        self.assertEqual(self.agence.statut_global, StatutGlobalAgence.ACTIVE)
    
    @patch('fleet.consumers.RabbitMQConsumer.connect')
    def test_start_consuming(self, mock_connect):
        """Test démarrage de la consommation"""
        mock_connect.return_value = True
        
        consumer = RabbitMQConsumer()
        consumer.channel = MagicMock()
        consumer.start_consuming()
        
        # Vérifier que les queues sont bindées
        self.assertTrue(consumer.channel.basic_consume.called)