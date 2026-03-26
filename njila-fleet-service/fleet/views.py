# from rest_framework import generics, status, filters
# from rest_framework.response import Response
# from rest_framework.views import APIView
# from rest_framework.permissions import IsAuthenticated, AllowAny
# from django_filters.rest_framework import DjangoFilterBackend
# from django.shortcuts import get_object_or_404
# from django.db.models import Q, Count
# from .models import Bus, StatusBus, ClasseBus
# from .serializers import (
#     BusListSerializer, BusDetailSerializer, 
#     BusCreateUpdateSerializer, BusStatusUpdateSerializer
# )

# # === PERMISSIONS TEMPORAIRES ===
# class IsManagerLocal(IsAuthenticated):
#     def has_permission(self, request, view):
#         return True  # À implémenter avec auth-service

# class IsManagerGlobal(IsAuthenticated):
#     def has_permission(self, request, view):
#         return True  # À implémenter avec auth-service

# # === ENDPOINTS POUR LES BUS ===

# class BusListCreateView(generics.ListCreateAPIView):
#     """
#     GET: Liste tous les bus (avec filtres)
#     POST: Ajouter un nouveau bus
    
#     Correspond à: GET /fleet/bus et GET /fleet/bus/filiale/:id
#     """
#     serializer_class = BusListSerializer
#     permission_classes = [IsAuthenticated]
#     filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
#     filterset_fields = ['status', 'classe', 'agence']
#     search_fields = ['immatriculation', 'marque', 'modele', 'agence']
#     ordering_fields = ['created_at', 'immatriculation', 'capacite']
    
#     def get_queryset(self):
#         queryset = Bus.objects.all()
        
#         # Filtre par agence (GET /fleet/bus?agence=General_Voyages)
#         agence = self.request.query_params.get('agence')
#         if agence:
#             queryset = queryset.filter(agence=agence)
        
#         # Filtre par statut
#         status = self.request.query_params.get('status')
#         if status:
#             queryset = queryset.filter(status=status)
        
#         # Filtre par disponibilité
#         disponible = self.request.query_params.get('disponible')
#         if disponible and disponible.lower() == 'true':
#             queryset = queryset.filter(status=StatusBus.DISPONIBLE)
        
#         return queryset.order_by('-created_at')
    
#     def get_serializer_class(self):
#         if self.request.method == 'POST':
#             return BusCreateUpdateSerializer
#         return BusListSerializer
    
#     def perform_create(self, serializer):
#         # Sauvegarder avec l'agence fournie
#         serializer.save()

# class BusRetrieveUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
#     """
#     GET: Détail d'un bus (/fleet/bus/:id)
#     PUT: Mettre à jour un bus (/fleet/bus/:id)
#     DELETE: Supprimer un bus (/fleet/bus/:id)
#     """
#     queryset = Bus.objects.all()
#     permission_classes = [IsAuthenticated]
    
#     def get_serializer_class(self):
#         if self.request.method in ['PUT', 'PATCH']:
#             return BusCreateUpdateSerializer
#         return BusDetailSerializer
    
#     def perform_destroy(self, instance):
#         # Vérifier si le bus n'est pas en voyage
#         if instance.status == StatusBus.EN_VOYAGE:
#             raise serializers.ValidationError(
#                 {"error": "Impossible de supprimer un bus en voyage"}
#             )
#         instance.delete()

# class BusStatusUpdateView(APIView):
#     """
#     PUT: Changer le statut d'un bus (/fleet/bus/:id/etat)
#     """
#     permission_classes = [IsAuthenticated]
    
#     def put(self, request, pk):
#         bus = get_object_or_404(Bus, pk=pk)
#         serializer = BusStatusUpdateSerializer(data=request.data)
        
#         if serializer.is_valid():
#             ancien_status = bus.status
#             nouveau_status = serializer.validated_data['status']
            
#             if ancien_status == nouveau_status:
#                 return Response(
#                     {"message": f"Le bus est déjà en statut {nouveau_status}"},
#                     status=status.HTTP_200_OK
#                 )
            
#             # Mettre à jour le statut
#             bus.status = nouveau_status
#             bus.save()
            
#             # TODO: Publier événement RabbitMQ pour informer les autres services
            
#             return Response({
#                 "message": f"Statut du bus changé de {ancien_status} à {nouveau_status}",
#                 "bus": {
#                     "id": bus.id,
#                     "immatriculation": bus.immatriculation,
#                     "status": bus.status
#                 }
#             }, status=status.HTTP_200_OK)
        
#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# class BusStatsView(APIView):
#     """
#     GET: Statistiques sur les bus (/fleet/stats?agence=:agence)
#     """
#     permission_classes = [IsAuthenticated]
    
#     def get(self, request):
#         # Filtre par agence si spécifié
#         agence = request.query_params.get('agence')
#         queryset = Bus.objects.filter(agence=agence) if agence else Bus.objects.all()
        
#         stats = {
#             'total_bus': queryset.count(),
#             'par_status': queryset.values('status').annotate(
#                 count=Count('id')
#             ).order_by('status'),
#             'par_classe': queryset.values('classe').annotate(
#                 count=Count('id')
#             ).order_by('classe'),
#             'capacite_totale': queryset.aggregate(
#                 total=models.Sum('capacite')
#             )['total'] or 0,
#             'capacite_moyenne': queryset.aggregate(
#                 moyenne=models.Avg('capacite')
#             )['moyenne'] or 0,
#         }
        
#         # Ajouter des libellés pour les status
#         for item in stats['par_status']:
#             item['status_label'] = dict(StatusBus.choices).get(item['status'], item['status'])
        
#         # Ajouter des libellés pour les classes
#         for item in stats['par_classe']:
#             item['classe_label'] = dict(ClasseBus.choices).get(item['classe'], item['classe'])
        
#         return Response(stats)

# class BusDisponiblesListView(generics.ListAPIView):
#     """
#     GET: Liste des bus disponibles (/fleet/bus/disponibles?agence=:agence)
#     """
#     serializer_class = BusListSerializer
#     permission_classes = [IsAuthenticated]
    
#     def get_queryset(self):
#         queryset = Bus.objects.filter(status=StatusBus.DISPONIBLE)
        
#         # Filtrer par agence si spécifié
#         agence = self.request.query_params.get('agence')
#         if agence:
#             queryset = queryset.filter(agence=agence)
        
#         return queryset.order_by('-created_at')



from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
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
    # Agences
    AgenceSerializer, AgenceListSerializer,
    # Filiales
    FilialeSerializer, FilialeListSerializer,
    # Bus
    BusListSerializer, BusDetailSerializer, BusCreateUpdateSerializer, BusStatusUpdateSerializer,
    # Guichetiers
    GuichetierSerializer,
    # Chauffeurs
    ChauffeurSerializer, ChauffeurListSerializer,
    # Trajets
    TrajetSerializer, TrajetListSerializer,
    # Voyages
    VoyageSerializer, VoyageListSerializer, VoyageCreateUpdateSerializer, VoyageStatusUpdateSerializer,
    # Annonces
    AnnonceSerializer,
    # Avis
    AvisSerializer
)
from .rabbitmq import (
    publish_agence_created, publish_agence_updated,
    publish_filiale_created, publish_filiale_updated,
    publish_voyage_cancelled, publish_voyage_delayed, publish_voyage_departed,
    publish_bus_status_changed, publish_bus_breakdown,
    publish_agence_subscription_request
)

logger = logging.getLogger(__name__)

# ============ PERMISSIONS TEMPORAIRES ============
class IsAdminOrManager(AllowAny):
    def has_permission(self, request, view):
        return True


# ============ AGENCES ============

class AgenceListCreateView(generics.ListCreateAPIView):
    """GET: Liste des agences | POST: Créer une agence"""
    permission_classes = [IsAdminOrManager]
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
    """GET: Détail agence | PUT: Modifier | DELETE: Supprimer"""
    queryset = Agence.objects.all()
    lookup_field = 'id_agence'
    serializer_class = AgenceSerializer
    permission_classes = [IsAdminOrManager]
    
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
    """GET: Liste des filiales | POST: Créer une filiale"""
    permission_classes = [IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['ville', 'est_active', 'agence']
    search_fields = ['nom', 'code', 'ville', 'email']
    ordering_fields = ['nom', 'ville', 'created_at']
    
    def get_queryset(self):
        queryset = Filiale.objects.all()
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(agence_id=agence_id)
        ville = self.request.query_params.get('ville')
        if ville:
            queryset = queryset.filter(ville=ville)
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
    """GET: Détail filiale | PUT: Modifier | DELETE: Supprimer"""
    queryset = Filiale.objects.all()
    lookup_field = 'id_filiale'
    serializer_class = FilialeSerializer
    permission_classes = [IsAdminOrManager]
    
    @transaction.atomic
    def perform_update(self, serializer):
        filiale = serializer.save()
        publish_filiale_updated(filiale)
        logger.info(f"Filiale mise à jour: {filiale.nom}")
    
    @transaction.atomic
    def perform_destroy(self, instance):
        # Vérifier s'il y a des bus dans cette filiale
        if instance.bus.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": f"Impossible de supprimer la filiale {instance.nom} car elle possède {instance.bus.count()} bus"})
        instance.delete()
        logger.info(f"Filiale supprimée: {instance.nom}")


class FilialeStatsView(APIView):
    """GET: Statistiques d'une filiale"""
    permission_classes = [IsAdminOrManager]
    
    def get(self, request, id_filiale):
        filiale = get_object_or_404(Filiale, id_filiale=id_filiale)
        
        # Statistiques des bus dans cette filiale
        bus_stats = Bus.objects.filter(Id_agence=filiale.agence).aggregate(
            total=Count('IdBus'),
            disponibles=Count('IdBus', filter=Q(etat=StatusBus.DISPONIBLE)),
            en_panne=Count('IdBus', filter=Q(etat=StatusBus.EN_PANNE)),
            en_voyage=Count('IdBus', filter=Q(etat=StatusBus.EN_VOYAGE)),
            maintenance=Count('IdBus', filter=Q(etat=StatusBus.MAINTENANCE)),
            capacite_totale=Sum('capacite')
        )
        
        # Statistiques des voyages de cette filiale
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
    """GET: Liste des bus | POST: Ajouter un bus"""
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['etat', 'Id_agence']
    search_fields = ['immatriculation', 'modele', 'marque']
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
        return queryset.select_related('Id_agence').order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return BusCreateUpdateSerializer
        return BusListSerializer
    
    def perform_create(self, serializer):
        bus = serializer.save()
        logger.info(f"Bus créé: {bus.immatriculation}")


class BusRetrieveUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail bus | PUT: Modifier | DELETE: Supprimer"""
    queryset = Bus.objects.all()
    lookup_field = 'IdBus'
    permission_classes = [AllowAny]
    
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
    """PUT: Changer l'état d'un bus"""
    permission_classes = [AllowAny]
    
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
    """GET: Statistiques sur les bus"""
    permission_classes = [AllowAny]
    
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
    """GET: Liste des bus disponibles"""
    serializer_class = BusListSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = Bus.objects.filter(etat=StatusBus.DISPONIBLE)
        agence_id = self.request.query_params.get('agence_id')
        if agence_id:
            queryset = queryset.filter(Id_agence_id=agence_id)
        return queryset.select_related('Id_agence').order_by('-created_at')


# ============ CHAUFFEURS ============

class ChauffeurListCreateView(generics.ListCreateAPIView):
    """GET: Liste des chauffeurs | POST: Ajouter un chauffeur"""
    permission_classes = [IsAdminOrManager]
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
        return queryset.select_related('Id_agence').order_by('-created_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ChauffeurSerializer
        return ChauffeurListSerializer
    
    def perform_create(self, serializer):
        chauffeur = serializer.save()
        # Publier événement staff.created pour auth-service
        publish_staff_created(
            user_id=chauffeur.id_chauffeur,
            role='CHAUFFEUR',
            agence_id=chauffeur.Id_agence.id_agence
        )
        logger.info(f"Chauffeur créé: {chauffeur.name} {chauffeur.surname}")


class ChauffeurDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail chauffeur | PUT: Modifier | DELETE: Supprimer"""
    queryset = Chauffeur.objects.all()
    lookup_field = 'id_chauffeur'
    serializer_class = ChauffeurSerializer
    permission_classes = [IsAdminOrManager]
    
    def perform_destroy(self, instance):
        if instance.voyages.filter(status__in=[StatusVoyage.PROGRAMME, StatusVoyage.EN_COURS]).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": "Impossible de supprimer un chauffeur avec des voyages programmés ou en cours"})
        instance.delete()
        logger.info(f"Chauffeur supprimé: {instance.name} {instance.surname}")


class ChauffeurStatusUpdateView(APIView):
    """PUT: Changer la disponibilité d'un chauffeur"""
    permission_classes = [IsAdminOrManager]
    
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
    """GET: Liste des guichetiers | POST: Ajouter un guichetier"""
    permission_classes = [IsAdminOrManager]
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
        return queryset.select_related('_id_filiale').order_by('-created_at')
    
    def get_serializer_class(self):
        return GuichetierSerializer
    
    def perform_create(self, serializer):
        guichetier = serializer.save()
        # Publier événement staff.created pour auth-service
        publish_staff_created(
            user_id=guichetier.Id_guichetier,
            role='GUICHETIER',
            filiale_id=guichetier._id_filiale.id_filiale if guichetier._id_filiale else None
        )
        logger.info(f"Guichetier créé: {guichetier.name} {guichetier.surname}")


class GuichetierDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail guichetier | PUT: Modifier | DELETE: Supprimer"""
    queryset = Guichetier.objects.all()
    lookup_field = 'Id_guichetier'
    serializer_class = GuichetierSerializer
    permission_classes = [IsAdminOrManager]
    
    def perform_destroy(self, instance):
        instance.delete()
        logger.info(f"Guichetier supprimé: {instance.name} {instance.surname}")


# ============ TRAJETS ============

class TrajetListCreateView(generics.ListCreateAPIView):
    """GET: Liste des trajets | POST: Créer un trajet"""
    permission_classes = [IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['est_actif', 'filiale_depart', 'filiale_arrive']
    search_fields = ['filiale_depart__nom', 'filiale_arrive__nom']
    ordering_fields = ['distance', 'created_at']
    
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
    """GET: Détail trajet | PUT: Modifier | DELETE: Supprimer"""
    queryset = Trajet.objects.all()
    lookup_field = 'Id_trajet'
    serializer_class = TrajetSerializer
    permission_classes = [IsAdminOrManager]
    
    def perform_destroy(self, instance):
        if instance.voyages.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"error": f"Impossible de supprimer le trajet {instance} car il a {instance.voyages.count()} voyages associés"})
        instance.delete()
        logger.info(f"Trajet supprimé: {instance}")


# ============ VOYAGES ============

class VoyageListCreateView(generics.ListCreateAPIView):
    """GET: Liste des voyages | POST: Programmer un voyage"""
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'type_voyage', 'Id_trajet', 'IdBus']
    search_fields = ['Id_trajet__filiale_depart__nom', 'Id_trajet__filiale_arrive__nom']
    ordering_fields = ['date_heure_depart', 'prix', 'created_at']
    
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
    """GET: Détail voyage | PUT: Modifier | DELETE: Supprimer"""
    queryset = Voyage.objects.all()
    lookup_field = 'Id_voyage'
    serializer_class = VoyageSerializer
    permission_classes = [AllowAny]
    
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
    """PUT: Changer le statut d'un voyage"""
    permission_classes = [AllowAny]
    
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
            # Publier événement d'annulation
            publish_voyage_cancelled(voyage, motif)
            # Libérer le bus
            if voyage.IdBus:
                bus = voyage.IdBus
                bus.etat = StatusBus.DISPONIBLE
                bus.save()
            # Libérer le chauffeur
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
    """GET: Recherche de voyages disponibles"""
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
    """GET: Liste des annonces | POST: Publier une annonce"""
    permission_classes = [IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'Id_voyage']
    search_fields = ['message']
    ordering_fields = ['datePublication', 'created_at']
    
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
        # Publier l'annonce pour notification-service
        publish_annonce_published(annonce)
        logger.info(f"Annonce publiée: {annonce.get_type_display()} pour voyage {annonce.Id_voyage}")


class AnnonceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET: Détail annonce | PUT: Modifier | DELETE: Supprimer"""
    queryset = Annonce.objects.all()
    lookup_field = 'id_annonce'
    serializer_class = AnnonceSerializer
    permission_classes = [IsAdminOrManager]


# ============ AVIS ============

class AvisListCreateView(generics.ListCreateAPIView):
    """GET: Liste des avis | POST: Laisser un avis"""
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['note', 'Id_voyage']
    search_fields = ['commentaires']
    ordering_fields = ['date_avis', 'note']
    
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
    """GET: Détail avis | PUT: Modifier | DELETE: Supprimer"""
    queryset = Avis.objects.all()
    lookup_field = 'id_avis'
    serializer_class = AvisSerializer
    permission_classes = [AllowAny]


class AvisStatsView(APIView):
    """GET: Statistiques des avis pour un voyage"""
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
        
        # Libérer l'ancien bus s'il existe
        if voyage.IdBus:
            ancien_bus = voyage.IdBus
            ancien_bus.etat = StatusBus.DISPONIBLE
            ancien_bus.save()
        
        # Assigner le nouveau bus
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
    """
    POST: Assigner un chauffeur à un voyage
    POST /api/fleet/voyages/<Id_voyage>/assign-chauffeur/
    """
    permission_classes = [IsAdminOrManager]
    
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