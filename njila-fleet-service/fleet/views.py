from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, permission_classes

from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Count, Q, Sum, Avg
from django.utils import timezone
import logging

from .models import (
    Agence, Bus, Guichetier, Chauffeur, Trajet, 
    Voyage, Filiale, Annonce, Avis,
    StatusBus, StatusVoyage, StatutGlobalAgence, TypeAnnonce,
    ClasseBus
)
from .serializers import (
    AgenceSerializer, AgenceListSerializer,
    FilialeSerializer, FilialeListSerializer,
    BusListSerializer, BusDetailSerializer, BusCreateUpdateSerializer, BusStatusUpdateSerializer,
    GuichetierSerializer,
    ChauffeurSerializer, ChauffeurListSerializer,
    TrajetSerializer, TrajetListSerializer,
    VoyageSerializer, VoyageListSerializer, VoyageCreateUpdateSerializer, VoyageStatusUpdateSerializer,
    AnnonceSerializer,
    AvisSerializer
)
from .rabbitmq import (
    publish_agence_created, publish_agence_updated,
    publish_filiale_created, publish_filiale_updated,
    publish_voyage_cancelled, publish_voyage_delayed, publish_voyage_departed,
    publish_bus_status_changed, publish_bus_breakdown,
    publish_agence_subscription_request, publish_staff_created, publish_annonce_published
)

logger = logging.getLogger(__name__)

# ============ PERMISSIONS RBAC ============
from .permissions import (
    IsAuthenticated, IsAdmin, IsManagerLocal, 
    IsManagerGlobal, IsGuichetier, IsChauffeur, IsVoyageur
)


# ============ AGENCES ============

class AgenceListCreateView(generics.ListCreateAPIView):
    """
    GET: Liste des agences (Public)
    POST: Créer une agence (Admin uniquement)
    """
    permission_classes = [AllowAny]  # GET public, POST checké dans perform_create
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [AllowAny()]
    
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['statut_global']
    search_fields = ['name', 'email_officiel', 'telephone']
    ordering_fields = ['name', 'date_inscription', 'statut_global']
    
    def get_queryset(self):
        queryset = Agence.objects.all()
        statut = self.request.query_params.get('statut_global')
        if statut:
            queryset = queryset.filter(statut_global=statut)
        return queryset.order_by('-date_inscription')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AgenceSerializer
        return AgenceListSerializer
    
    @transaction.atomic
    def perform_create(self, serializer):
        agence = serializer.save()
        publish_agence_created(agence)
        publish_agence_subscription_request(agence)
        logger.info(f"Agence créée: {agence.name}")


class AgenceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Détail agence (Public)
    PUT/PATCH: Modifier agence (Admin uniquement)
    DELETE: Supprimer agence (Admin uniquement)
    """
    queryset = Agence.objects.all()
    lookup_field = 'id_agence'
    serializer_class = AgenceSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdmin()]
    
    @transaction.atomic
    def perform_update(self, serializer):
        agence = serializer.save()
        publish_agence_updated(agence)
        logger.info(f"Agence mise à jour: {agence.name}")
    
    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.bus.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": f"Impossible de supprimer l'agence {instance.name} car elle possède {instance.bus.count()} bus"})
        instance.delete()
        logger.info(f"Agence supprimée: {instance.name}")


# ============ FILIALES ============

class FilialeListCreateView(generics.ListCreateAPIView):
    """
    GET: Liste des filiales (Public)
    POST: Créer une filiale (Manager Global ou Admin)
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ville', 'est_active', 'agence']
    search_fields = ['nom', 'code', 'ville', 'email']
    ordering_fields = ['nom', 'ville', 'created_at']
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerGlobal()]
        return [AllowAny()]
    
    def get_queryset(self):
        queryset = Filiale.objects.all()
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(agence_id=agence_id)
        ville = self.request.query_params.get('ville')
        if ville:
            queryset = queryset.filter(ville=ville)
        
        # Manager global ne voit que ses filiales
        if hasattr(self.request, 'user_info') and self.request.method != 'POST':
            role = self.request.user_info.get('role')
            if role == 'MANAGER_GLOBAL':
                user_agence_id = self.request.user_info.get('agence_id')
                queryset = queryset.filter(agence_id=user_agence_id)
        
        return queryset.select_related('agence').order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return FilialeSerializer
        return FilialeListSerializer
    
    @transaction.atomic
    def perform_create(self, serializer):
        filiale = serializer.save()
        publish_filiale_created(filiale)
        logger.info(f"Filiale créée: {filiale.nom}")


class FilialeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Détail filiale (Public)
    PUT/PATCH: Modifier filiale (Manager Global ou Admin)
    DELETE: Supprimer filiale (Manager Global ou Admin)
    """
    queryset = Filiale.objects.all()
    lookup_field = 'id_filiale'
    serializer_class = FilialeSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerGlobal()]
    
    @transaction.atomic
    def perform_update(self, serializer):
        filiale = serializer.save()
        publish_filiale_updated(filiale)
        logger.info(f"Filiale mise à jour: {filiale.nom}")
    
    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.bus.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": f"Impossible de supprimer la filiale {instance.nom} car elle possède {instance.bus.count()} bus"})
        instance.delete()
        logger.info(f"Filiale supprimée: {instance.nom}")


class FilialeStatsView(APIView):
    """GET: Statistiques d'une filiale (Public)"""
    permission_classes = [AllowAny]
    
    def get(self, request, id_filiale):
        filiale = get_object_or_404(Filiale, id_filiale=id_filiale)
        
        bus_stats = Bus.objects.filter(Id_agence=filiale.agence).aggregate(
            total=Count('IdBus'),
            disponibles=Count('IdBus', filter=Q(etat=StatusBus.DISPONIBLE)),
            en_panne=Count('IdBus', filter=Q(etat=StatusBus.EN_PANNE)),
            en_voyage=Count('IdBus', filter=Q(etat=StatusBus.EN_VOYAGE)),
            maintenance=Count('IdBus', filter=Q(etat=StatusBus.MAINTENANCE)),
            capacite_totale=Sum('capacite')
        )
        
        voyages_stats = Voyage.objects.filter(IdBus__Id_agence=filiale.agence).aggregate(
            total=Count('Id_voyage'),
            programmes=Count('Id_voyage', filter=Q(status=StatusVoyage.PROGRAMME)),
            en_cours=Count('Id_voyage', filter=Q(status=StatusVoyage.EN_COURS)),
            termines=Count('Id_voyage', filter=Q(status=StatusVoyage.TERMINE)),
            annules=Count('Id_voyage', filter=Q(status=StatusVoyage.ANNULE))
        )
        
        return Response({
            'filiale': {
                'id': filiale.id_filiale,
                'nom': filiale.nom,
                'ville': filiale.ville,
                'est_active': filiale.est_active
            },
            'bus_stats': bus_stats,
            'voyages_stats': voyages_stats,
            'date_calcul': timezone.now()
        })


# ============ BUS ============

class BusListCreateView(generics.ListCreateAPIView):
    """
    GET: Liste des bus (Manager Local ou supérieur)
    POST: Ajouter un bus (Manager Local ou supérieur)
    """
    permission_classes = [IsManagerLocal]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['etat', 'Id_agence']
    search_fields = ['immatriculation', 'modele']
    ordering_fields = ['created_at', 'immatriculation', 'capacite']
    
    def get_queryset(self):
        queryset = Bus.objects.all()
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(Id_agence_id=agence_id)
        etat = self.request.query_params.get('etat')
        if etat:
            queryset = queryset.filter(etat=etat)
        disponible = self.request.query_params.get('disponible')
        if disponible and disponible.lower() == 'true':
            queryset = queryset.filter(etat=StatusBus.DISPONIBLE)
        
        # Filtrer par l'agence du manager local
        if hasattr(self.request, 'user_info'):
            role = self.request.user_info.get('role')
            if role == 'MANAGER_LOCAL':
                user_agence_id = self.request.user_info.get('agence_id')
                queryset = queryset.filter(Id_agence_id=user_agence_id)
        
        return queryset.select_related('Id_agence').order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return BusCreateUpdateSerializer
        return BusListSerializer
    
    def perform_create(self, serializer):
        bus = serializer.save()
        logger.info(f"Bus créé: {bus.immatriculation}")


class BusRetrieveUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Détail bus (Manager Local ou supérieur)
    PUT/PATCH: Modifier bus (Manager Local ou supérieur)
    DELETE: Supprimer bus (Manager Local ou supérieur)
    """
    queryset = Bus.objects.all()
    lookup_field = 'IdBus'
    permission_classes = [IsManagerLocal]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return BusCreateUpdateSerializer
        return BusDetailSerializer
    
    def perform_destroy(self, instance):
        if instance.etat == StatusBus.EN_VOYAGE:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "Impossible de supprimer un bus en voyage"})
        instance.delete()
        logger.info(f"Bus supprimé: {instance.immatriculation}")


class BusStatusUpdateView(APIView):
    """PUT: Changer l'état d'un bus (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]
    
    def put(self, request, IdBus):
        bus = get_object_or_404(Bus, IdBus=IdBus)
        ancien_etat = bus.etat
        nouveau_etat = request.data.get('etat')
        raison = request.data.get('raison', '')
        
        if not nouveau_etat or nouveau_etat not in dict(StatusBus.choices):
            return Response({"error": "État invalide"}, status=status.HTTP_400_BAD_REQUEST)
        
        if ancien_etat == nouveau_etat:
            return Response({"message": f"Le bus est déjà en état {nouveau_etat}"}, status=status.HTTP_200_OK)
        
        bus.etat = nouveau_etat
        bus.save()
        
        publish_bus_status_changed(bus, ancien_etat, nouveau_etat, raison)
        
        if nouveau_etat == StatusBus.EN_PANNE:
            publish_bus_breakdown(bus, raison)
        
        return Response({
            "message": f"État du bus changé de {ancien_etat} à {nouveau_etat}",
            "bus": {
                "IdBus": bus.IdBus,
                "immatriculation": bus.immatriculation,
                "etat": bus.etat
            }
        }, status=status.HTTP_200_OK)


class BusStatsView(APIView):
    """GET: Statistiques sur les bus (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]
    
    def get(self, request):
        agence_id = request.query_params.get('agence_id')
        queryset = Bus.objects.filter(Id_agence_id=agence_id) if agence_id else Bus.objects.all()
        
        stats = {
            'total_bus': queryset.count(),
            'par_etat': queryset.values('etat').annotate(
                count=Count('IdBus')
            ).order_by('etat'),
            'capacite_totale': queryset.aggregate(
                total=Sum('capacite')
            )['total'] or 0,
            'capacite_moyenne': queryset.aggregate(
                moyenne=Avg('capacite')
            )['moyenne'] or 0,
        }
        
        for item in stats['par_etat']:
            item['etat_label'] = dict(StatusBus.choices).get(item['etat'], item['etat'])
        
        return Response(stats)


class BusDisponiblesListView(generics.ListAPIView):
    """GET: Liste des bus disponibles (Manager Local ou supérieur)"""
    serializer_class = BusListSerializer
    permission_classes = [IsManagerLocal]
    
    def get_queryset(self):
        queryset = Bus.objects.filter(etat=StatusBus.DISPONIBLE)
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(Id_agence_id=agence_id)
        return queryset.select_related('Id_agence').order_by('-created_at')


# ============ CHAUFFEURS ============

class ChauffeurListCreateView(generics.ListCreateAPIView):
    """GET: Liste des chauffeurs | POST: Ajouter un chauffeur (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['est_disponible', 'Id_agence']
    search_fields = ['name', 'surname', 'email', 'numero_permis']
    ordering_fields = ['name', 'date_embauche']
    
    def get_queryset(self):
        queryset = Chauffeur.objects.all()
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(Id_agence_id=agence_id)
        disponible = self.request.query_params.get('disponible')
        if disponible and disponible.lower() == 'true':
            queryset = queryset.filter(est_disponible=True)
        
        # Filtrer par l'agence du manager local
        if hasattr(self.request, 'user_info'):
            role = self.request.user_info.get('role')
            if role == 'MANAGER_LOCAL':
                user_agence_id = self.request.user_info.get('agence_id')
                queryset = queryset.filter(Id_agence_id=user_agence_id)
        
        return queryset.select_related('Id_agence').order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ChauffeurSerializer
        return ChauffeurListSerializer
    
    def perform_create(self, serializer):
        chauffeur = serializer.save()
        publish_staff_created(
            user_id=chauffeur.id_chauffeur,
            role='CHAUFFEUR',
            agence_id=chauffeur.Id_agence.id_agence
        )
        logger.info(f"Chauffeur créé: {chauffeur.name} {chauffeur.surname}")


class ChauffeurDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail chauffeur | PUT: Modifier | DELETE: Supprimer (Manager Local ou supérieur)"""
    queryset = Chauffeur.objects.all()
    lookup_field = 'id_chauffeur'
    serializer_class = ChauffeurSerializer
    permission_classes = [IsManagerLocal]
    
    def perform_destroy(self, instance):
        if instance.voyages.filter(status__in=[StatusVoyage.PROGRAMME, StatusVoyage.EN_COURS]).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "Impossible de supprimer un chauffeur avec des voyages programmés ou en cours"})
        instance.delete()
        logger.info(f"Chauffeur supprimé: {instance.name} {instance.surname}")


class ChauffeurStatusUpdateView(APIView):
    """PUT: Changer la disponibilité d'un chauffeur (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]
    
    def put(self, request, id_chauffeur):
        chauffeur = get_object_or_404(Chauffeur, id_chauffeur=id_chauffeur)
        est_disponible = request.data.get('est_disponible')
        
        if est_disponible is None:
            return Response({"error": "Le champ est_disponible est requis"}, status=status.HTTP_400_BAD_REQUEST)
        
        chauffeur.est_disponible = est_disponible
        chauffeur.save()
        
        return Response({
            "message": f"Disponibilité du chauffeur changée",
            "chauffeur": {
                "id": chauffeur.id_chauffeur,
                "nom": f"{chauffeur.name} {chauffeur.surname}",
                "est_disponible": chauffeur.est_disponible
            }
        }, status=status.HTTP_200_OK)


# ============ GUICHETIERS ============

class GuichetierListCreateView(generics.ListCreateAPIView):
    """GET: Liste des guichetiers | POST: Ajouter un guichetier (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['est_actif', '_id_filiale']
    search_fields = ['name', 'surname', 'email', 'phone']
    ordering_fields = ['name', 'created_at']
    
    def get_queryset(self):
        queryset = Guichetier.objects.all()
        filiale_id = self.request.query_params.get('filiale_id')
        if filiale_id:
            queryset = queryset.filter(_id_filiale_id=filiale_id)
        actif = self.request.query_params.get('actif')
        if actif and actif.lower() == 'true':
            queryset = queryset.filter(est_actif=True)
        
        # Filtrer par la filiale du manager local
        if hasattr(self.request, 'user_info'):
            role = self.request.user_info.get('role')
            if role == 'MANAGER_LOCAL':
                user_filiale_id = self.request.user_info.get('filiale_id')
                queryset = queryset.filter(_id_filiale_id=user_filiale_id)
        
        return queryset.select_related('_id_filiale').order_by('-created_at')
    
    def get_serializer_class(self):
        return GuichetierSerializer
    
    def perform_create(self, serializer):
        guichetier = serializer.save()
        publish_staff_created(
            user_id=guichetier.Id_guichetier,
            role='GUICHETIER',
            filiale_id=guichetier._id_filiale.id_filiale if guichetier._id_filiale else None
        )
        logger.info(f"Guichetier créé: {guichetier.name} {guichetier.surname}")


class GuichetierDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail guichetier | PUT: Modifier | DELETE: Supprimer (Manager Local ou supérieur)"""
    queryset = Guichetier.objects.all()
    lookup_field = 'Id_guichetier'
    serializer_class = GuichetierSerializer
    permission_classes = [IsManagerLocal]
    
    def perform_destroy(self, instance):
        instance.delete()
        logger.info(f"Guichetier supprimé: {instance.name} {instance.surname}")


# ============ TRAJETS ============

class TrajetListCreateView(generics.ListCreateAPIView):
    """GET: Liste des trajets | POST: Créer un trajet (Manager Global ou Admin)"""
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['est_actif', 'filiale_depart', 'filiale_arrive']
    search_fields = ['filiale_depart__nom', 'filiale_arrive__nom']
    ordering_fields = ['distance', 'created_at']
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerGlobal()]
        return [AllowAny()]
    
    def get_queryset(self):
        queryset = Trajet.objects.all()
        depart = self.request.query_params.get('depart')
        if depart:
            queryset = queryset.filter(filiale_depart__ville=depart)
        arrivee = self.request.query_params.get('arrivee')
        if arrivee:
            queryset = queryset.filter(filiale_arrive__ville=arrivee)
        return queryset.select_related('filiale_depart', 'filiale_arrive').order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return TrajetSerializer
        return TrajetListSerializer
    
    def perform_create(self, serializer):
        trajet = serializer.save()
        logger.info(f"Trajet créé: {trajet}")


class TrajetDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail trajet | PUT: Modifier | DELETE: Supprimer (Manager Global ou Admin)"""
    queryset = Trajet.objects.all()
    lookup_field = 'Id_trajet'
    serializer_class = TrajetSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerGlobal()]
    
    def perform_destroy(self, instance):
        if instance.voyages.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": f"Impossible de supprimer le trajet {instance} car il a {instance.voyages.count()} voyages associés"})
        instance.delete()
        logger.info(f"Trajet supprimé: {instance}")


# ============ VOYAGES ============

class VoyageListCreateView(generics.ListCreateAPIView):
    """
    GET: Liste des voyages (Public)
    POST: Programmer un voyage (Manager Local ou supérieur)
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'type_voyage', 'Id_trajet', 'IdBus']
    search_fields = ['Id_trajet__filiale_depart__nom', 'Id_trajet__filiale_arrive__nom']
    ordering_fields = ['date_heure_depart', 'prix', 'created_at']
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerLocal()]
        return [AllowAny()]
    
    def get_queryset(self):
        queryset = Voyage.objects.all()
        
        date_debut = self.request.query_params.get('date_debut')
        if date_debut:
            queryset = queryset.filter(date_heure_depart__gte=date_debut)
        date_fin = self.request.query_params.get('date_fin')
        if date_fin:
            queryset = queryset.filter(date_heure_depart__lte=date_fin)
        
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(IdBus__Id_agence_id=agence_id)
        
        return queryset.select_related('Id_trajet', 'IdBus', 'id_chauffeur').order_by('date_heure_depart')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return VoyageCreateUpdateSerializer
        return VoyageListSerializer
    
    @transaction.atomic
    def perform_create(self, serializer):
        voyage = serializer.save()
        
        bus = voyage.IdBus
        bus.etat = StatusBus.EN_VOYAGE
        bus.save()
        
        logger.info(f"Voyage programmé: {voyage}")


class VoyageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Détail voyage (Public)
    PUT/PATCH: Modifier voyage (Manager Local ou supérieur)
    DELETE: Supprimer voyage (Manager Local ou supérieur)
    """
    queryset = Voyage.objects.all()
    lookup_field = 'Id_voyage'
    serializer_class = VoyageSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerLocal()]
    
    @transaction.atomic
    def perform_update(self, serializer):
        voyage = serializer.save()
        logger.info(f"Voyage mis à jour: {voyage}")
    
    @transaction.atomic
    def perform_destroy(self, instance):
        if instance.status == StatusVoyage.EN_COURS:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "Impossible de supprimer un voyage en cours"})
        
        bus = instance.IdBus
        bus.etat = StatusBus.DISPONIBLE
        bus.save()
        
        instance.delete()
        logger.info(f"Voyage supprimé: {instance}")


class VoyageStatusUpdateView(APIView):
    """PUT: Changer le statut d'un voyage (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]
    
    @transaction.atomic
    def put(self, request, Id_voyage):
        voyage = get_object_or_404(Voyage, Id_voyage=Id_voyage)
        ancien_status = voyage.status
        nouveau_status = request.data.get('status')
        motif = request.data.get('motif', '')
        
        if not nouveau_status or nouveau_status not in dict(StatusVoyage.choices):
            return Response({"error": "Statut invalide"}, status=status.HTTP_400_BAD_REQUEST)
        
        if ancien_status == nouveau_status:
            return Response({"message": f"Le voyage est déjà en statut {nouveau_status}"}, status=status.HTTP_200_OK)
        
        voyage.status = nouveau_status
        voyage.save()
        
        if nouveau_status == StatusVoyage.ANNULE:
            voyage.motif_annulation = motif
            voyage.save()
            publish_voyage_cancelled(voyage, motif)
            if voyage.IdBus:
                bus = voyage.IdBus
                bus.etat = StatusBus.DISPONIBLE
                bus.save()
            if voyage.id_chauffeur:
                chauffeur = voyage.id_chauffeur
                chauffeur.est_disponible = True
                chauffeur.save()
        
        elif nouveau_status == StatusVoyage.RETARDE:
            publish_voyage_delayed(voyage, voyage.date_heure_depart)
        
        elif nouveau_status == StatusVoyage.EN_COURS:
            publish_voyage_departed(voyage)
        
        elif nouveau_status == StatusVoyage.TERMINE:
            if voyage.IdBus:
                bus = voyage.IdBus
                bus.etat = StatusBus.DISPONIBLE
                bus.save()
            if voyage.id_chauffeur:
                chauffeur = voyage.id_chauffeur
                chauffeur.est_disponible = True
                chauffeur.save()
        
        return Response({
            "message": f"Statut du voyage changé de {ancien_status} à {nouveau_status}",
            "voyage": {
                "Id_voyage": voyage.Id_voyage,
                "status": voyage.status
            }
        }, status=status.HTTP_200_OK)


class VoyageSearchView(generics.ListAPIView):
    """GET: Recherche de voyages disponibles (Public)"""
    serializer_class = VoyageListSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        depart = self.request.query_params.get('depart')
        arrivee = self.request.query_params.get('arrivee')
        date = self.request.query_params.get('date')
        
        queryset = Voyage.objects.filter(
            status=StatusVoyage.PROGRAMME,
            places_disponibles__gt=0,
            date_heure_depart__gte=timezone.now()
        )
        
        if depart:
            queryset = queryset.filter(Id_trajet__filiale_depart__ville=depart)
        if arrivee:
            queryset = queryset.filter(Id_trajet__filiale_arrive__ville=arrivee)
        if date:
            queryset = queryset.filter(date_heure_depart__date=date)
        
        return queryset.select_related('Id_trajet', 'IdBus').order_by('date_heure_depart')


# ============ ANNONCES ============

class AnnonceListCreateView(generics.ListCreateAPIView):
    """
    GET: Liste des annonces (Public)
    POST: Publier une annonce (Manager Local ou supérieur)
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'Id_voyage']
    search_fields = ['message']
    ordering_fields = ['datePublication', 'created_at']
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerLocal()]
        return [AllowAny()]
    
    def get_queryset(self):
        queryset = Annonce.objects.all()
        voyage_id = self.request.query_params.get('voyage_id')
        if voyage_id:
            queryset = queryset.filter(Id_voyage_id=voyage_id)
        return queryset.select_related('Id_voyage').order_by('-datePublication')
    
    def get_serializer_class(self):
        return AnnonceSerializer
    
    def perform_create(self, serializer):
        annonce = serializer.save()
        publish_annonce_published(annonce)
        logger.info(f"Annonce publiée: {annonce.get_type_display()} pour voyage {annonce.Id_voyage}")


class AnnonceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Détail annonce (Public)
    PUT/PATCH: Modifier annonce (Manager Local ou supérieur)
    DELETE: Supprimer annonce (Manager Local ou supérieur)
    """
    queryset = Annonce.objects.all()
    lookup_field = 'id_annonce'
    serializer_class = AnnonceSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerLocal()]


# ============ AVIS ============

class AvisListCreateView(generics.ListCreateAPIView):
    """
    GET: Liste des avis (Public)
    POST: Laisser un avis (Voyageur uniquement)
    """
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['note', 'Id_voyage']
    search_fields = ['commentaires']
    ordering_fields = ['date_avis', 'note']
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsVoyageur()]
        return [AllowAny()]
    
    def get_queryset(self):
        queryset = Avis.objects.filter(est_approuve=True)
        voyage_id = self.request.query_params.get('voyage_id')
        if voyage_id:
            queryset = queryset.filter(Id_voyage_id=voyage_id)
        note_min = self.request.query_params.get('note_min')
        if note_min:
            queryset = queryset.filter(note__gte=note_min)
        return queryset.select_related('Id_voyage').order_by('-date_avis')
    
    def get_serializer_class(self):
        return AvisSerializer
    
    def perform_create(self, serializer):
        avis = serializer.save()
        logger.info(f"Avis créé: note {avis.note}/5 pour voyage {avis.Id_voyage}")


class AvisDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Détail avis (Public)
    PUT/PATCH: Modifier avis (Propriétaire ou Admin)
    DELETE: Supprimer avis (Propriétaire ou Admin)
    """
    queryset = Avis.objects.all()
    lookup_field = 'id_avis'
    serializer_class = AvisSerializer
    
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def perform_update(self, serializer):
        # Vérifier que l'utilisateur est le propriétaire ou admin
        if hasattr(self.request, 'user_info'):
            user_id = self.request.user_info.get('userId')
            avis = self.get_object()
            role = self.request.user_info.get('role')
            
            if str(avis.user_id) != user_id and role != 'ADMINISTRATEUR':
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Vous n'êtes pas autorisé à modifier cet avis")
        
        serializer.save()
        logger.info(f"Avis modifié: {serializer.instance.id_avis}")
    
    def perform_destroy(self, instance):
        # Vérifier que l'utilisateur est le propriétaire ou admin
        if hasattr(self.request, 'user_info'):
            user_id = self.request.user_info.get('userId')
            role = self.request.user_info.get('role')
            
            if str(instance.user_id) != user_id and role != 'ADMINISTRATEUR':
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Vous n'êtes pas autorisé à supprimer cet avis")
        
        instance.delete()
        logger.info(f"Avis supprimé: {instance.id_avis}")


class AvisStatsView(APIView):
    """GET: Statistiques des avis pour un voyage (Public)"""
    permission_classes = [AllowAny]
    
    def get(self, request, Id_voyage):
        voyage = get_object_or_404(Voyage, Id_voyage=Id_voyage)
        avis = Avis.objects.filter(Id_voyage=voyage, est_approuve=True)
        
        stats = {
            'voyage': str(voyage),
            'total_avis': avis.count(),
            'note_moyenne': avis.aggregate(avg=Avg('note'))['avg'] or 0,
            'repartition': {
                '5_etoiles': avis.filter(note=5).count(),
                '4_etoiles': avis.filter(note=4).count(),
                '3_etoiles': avis.filter(note=3).count(),
                '2_etoiles': avis.filter(note=2).count(),
                '1_etoile': avis.filter(note=1).count(),
            }
        }
        
        return Response(stats)


# ============ ASSIGNATION BUS ET CHAUFFEUR ============

class VoyageAssignBusView(APIView):
    """POST: Assigner un bus à un voyage (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]
    
    def post(self, request, Id_voyage):
        voyage = get_object_or_404(Voyage, Id_voyage=Id_voyage)
        bus_id = request.data.get('bus_id')
        
        if not bus_id:
            return Response({"error": "bus_id est requis"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            bus = Bus.objects.get(IdBus=bus_id)
        except Bus.DoesNotExist:
            return Response({"error": "Bus non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        if bus.etat != StatusBus.DISPONIBLE:
            return Response({"error": "Ce bus n'est pas disponible"}, status=status.HTTP_400_BAD_REQUEST)
        
        if voyage.status not in [StatusVoyage.PROGRAMME, StatusVoyage.CONFIRME]:
            return Response({"error": "Impossible d'assigner un bus à un voyage déjà en cours ou terminé"}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        if voyage.IdBus:
            ancien_bus = voyage.IdBus
            ancien_bus.etat = StatusBus.DISPONIBLE
            ancien_bus.save()
        
        voyage.IdBus = bus
        voyage.save()
        
        bus.etat = StatusBus.EN_VOYAGE
        bus.save()
        
        logger.info(f"Bus {bus.immatriculation} assigné au voyage {voyage.Id_voyage}")
        
        return Response({
            "message": "Bus assigné avec succès",
            "voyage_id": str(voyage.Id_voyage),
            "bus": {
                "IdBus": bus.IdBus,
                "immatriculation": bus.immatriculation
            }
        }, status=status.HTTP_200_OK)


class VoyageAssignChauffeurView(APIView):
    """POST: Assigner un chauffeur à un voyage (Manager Local ou supérieur)"""
    permission_classes = [IsManagerLocal]
    
    def post(self, request, Id_voyage):
        voyage = get_object_or_404(Voyage, Id_voyage=Id_voyage)
        chauffeur_id = request.data.get('chauffeur_id')
        
        if not chauffeur_id:
            return Response({"error": "chauffeur_id est requis"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            chauffeur = Chauffeur.objects.get(id_chauffeur=chauffeur_id)
        except Chauffeur.DoesNotExist:
            return Response({"error": "Chauffeur non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        if not chauffeur.est_disponible:
            return Response({"error": "Ce chauffeur n'est pas disponible"}, status=status.HTTP_400_BAD_REQUEST)
        
        if voyage.status not in [StatusVoyage.PROGRAMME, StatusVoyage.CONFIRME]:
            return Response({"error": "Impossible d'assigner un chauffeur à un voyage déjà en cours ou terminé"}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        voyage.id_chauffeur = chauffeur
        voyage.save()
        
        chauffeur.est_disponible = False
        chauffeur.save()
        
        logger.info(f"Chauffeur {chauffeur.name} {chauffeur.surname} assigné au voyage {voyage.Id_voyage}")
        
        return Response({
            "message": "Chauffeur assigné avec succès",
            "voyage_id": str(voyage.Id_voyage),
            "chauffeur": {
                "id": chauffeur.id_chauffeur,
                "nom": f"{chauffeur.name} {chauffeur.surname}"
            }
        }, status=status.HTTP_200_OK)


# ============ HEALTH CHECK ============


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Endpoint public pour vérifier que le service est vivant"""
    return Response({
        'status': 'healthy',
        'service': 'fleet-management-service',
        'version': '1.0.0'
    })