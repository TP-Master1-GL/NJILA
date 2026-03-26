
from django.urls import path
from . import views

urlpatterns = [
    # ============ AGENCES ============
    path('agences/', views.AgenceListCreateView.as_view(), name='agence-list-create'),
    path('agences/<uuid:id_agence>/', views.AgenceDetailView.as_view(), name='agence-detail'),
    
    # ============ FILIALES ============
    path('filiales/', views.FilialeListCreateView.as_view(), name='filiale-list-create'),
    path('filiales/<uuid:id_filiale>/', views.FilialeDetailView.as_view(), name='filiale-detail'),
    path('filiales/<uuid:id_filiale>/stats/', views.FilialeStatsView.as_view(), name='filiale-stats'),
    
    # ============ BUS ============
    path('bus/', views.BusListCreateView.as_view(), name='bus-list-create'), 
    path('bus/<int:IdBus>/', views.BusRetrieveUpdateDeleteView.as_view(), name='bus-detail'), 
    path('bus/<int:IdBus>/etat/', views.BusStatusUpdateView.as_view(), name='bus-status-update'),  
    
    # Endpoints supplémentaires utiles
    path('bus/disponibles/', views.BusDisponiblesListView.as_view(), name='bus-disponibles'),  
    path('stats/', views.BusStatsView.as_view(), name='bus-stats'),
    
    # ============ CHAUFFEURS ============
    path('chauffeurs/', views.ChauffeurListCreateView.as_view(), name='chauffeur-list-create'),
    path('chauffeurs/<uuid:id_chauffeur>/', views.ChauffeurDetailView.as_view(), name='chauffeur-detail'),
    path('chauffeurs/<uuid:id_chauffeur>/disponibilite/', views.ChauffeurStatusUpdateView.as_view(), name='chauffeur-status'),
    
    # ============ GUICHETIERS ============
    path('guichetiers/', views.GuichetierListCreateView.as_view(), name='guichetier-list-create'),
    path('guichetiers/<uuid:Id_guichetier>/', views.GuichetierDetailView.as_view(), name='guichetier-detail'),
    
    # ============ TRAJETS ============
    path('trajets/', views.TrajetListCreateView.as_view(), name='trajet-list-create'),
    path('trajets/<uuid:Id_trajet>/', views.TrajetDetailView.as_view(), name='trajet-detail'),
    
    # ============ VOYAGES ============
    path('voyages/', views.VoyageListCreateView.as_view(), name='voyage-list-create'),
    path('voyages/recherche/', views.VoyageSearchView.as_view(), name='voyage-search'),
    path('voyages/<uuid:Id_voyage>/', views.VoyageDetailView.as_view(), name='voyage-detail'),
    path('voyages/<uuid:Id_voyage>/statut/', views.VoyageStatusUpdateView.as_view(), name='voyage-status'),
    
    # ============ ANNONCES ============
    path('annonces/', views.AnnonceListCreateView.as_view(), name='annonce-list-create'),
    path('annonces/<uuid:id_annonce>/', views.AnnonceDetailView.as_view(), name='annonce-detail'),
    
    # ============ AVIS ============
    path('avis/', views.AvisListCreateView.as_view(), name='avis-list-create'),
    path('avis/<uuid:id_avis>/', views.AvisDetailView.as_view(), name='avis-detail'),
    path('avis/voyage/<uuid:Id_voyage>/stats/', views.AvisStatsView.as_view(), name='avis-stats'),
    
    # ============ ASSIGNATION ============
path('voyages/<uuid:Id_voyage>/assign-bus/', views.VoyageAssignBusView.as_view(), name='voyage-assign-bus'),
path('voyages/<uuid:Id_voyage>/assign-chauffeur/', views.VoyageAssignChauffeurView.as_view(), name='voyage-assign-chauffeur'),
]