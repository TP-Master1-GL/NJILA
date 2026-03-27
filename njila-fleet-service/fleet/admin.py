from django.contrib import admin
from .models import (
    Agence, Filiale, Bus, Chauffeur, Guichetier,
    Trajet, Voyage, Annonce, Avis
)


# ============ AGENCES ============

@admin.register(Agence)
class AgenceAdmin(admin.ModelAdmin):
    list_display = ['name', 'telephone', 'email_officiel', 'statut_global', 'date_inscription']
    list_filter = ['statut_global', 'date_inscription']
    search_fields = ['name', 'email_officiel', 'telephone']
    readonly_fields = ['id_agence', 'date_inscription', 'created_at', 'updated_at']
    ordering = ['-date_inscription']
    fieldsets = (
        ('Informations générales', {
            'fields': ('id_agence', 'name', 'adresse', 'logo_image')
        }),
        ('Contact', {
            'fields': ('telephone', 'email_officiel')
        }),
        ('Statut', {
            'fields': ('statut_global',)
        }),
        ('Dates', {
            'fields': ('date_inscription', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ============ FILIALES ============

@admin.register(Filiale)
class FilialeAdmin(admin.ModelAdmin):
    list_display = ['nom', 'code', 'ville', 'agence', 'telephone', 'est_active']
    list_filter = ['ville', 'est_active', 'agence']
    search_fields = ['nom', 'code', 'ville', 'email', 'telephone']
    readonly_fields = ['id_filiale', 'created_at', 'updated_at']
    autocomplete_fields = ['agence']
    ordering = ['agence', 'ville', 'nom']


# ============ BUS ============

@admin.register(Bus)
class BusAdmin(admin.ModelAdmin):
    list_display = ['immatriculation', 'modele', 'capacite', 'etat', 'Id_agence', 'created_at']
    list_filter = ['etat', 'Id_agence', 'created_at']
    search_fields = ['immatriculation', 'modele', 'marque']
    readonly_fields = ['IdBus', 'created_at', 'updated_at']
    autocomplete_fields = ['Id_agence']
    ordering = ['-created_at']
    fieldsets = (
        ('Identification', {
            'fields': ('IdBus', 'immatriculation')
        }),
        ('Caractéristiques', {
            'fields': ('modele', 'marque', 'capacite', 'classe')
        }),
        ('Statut', {
            'fields': ('etat',)
        }),
        ('Agence', {
            'fields': ('Id_agence',)
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ============ CHAUFFEURS ============

@admin.register(Chauffeur)
class ChauffeurAdmin(admin.ModelAdmin):
    list_display = ['name', 'surname', 'numero_permis', 'email', 'phone', 'est_disponible', 'Id_agence']
    list_filter = ['est_disponible', 'Id_agence', 'date_embauche']
    search_fields = ['name', 'surname', 'email', 'phone', 'numero_permis']
    readonly_fields = ['id_chauffeur', 'created_at', 'updated_at']
    autocomplete_fields = ['Id_agence']
    ordering = ['surname', 'name']
    fieldsets = (
        ('Identité', {
            'fields': ('id_chauffeur', 'name', 'surname', 'photo_profil')
        }),
        ('Contact', {
            'fields': ('email', 'phone', 'Adresse')
        }),
        ('Permis de conduire', {
            'fields': ('numero_permis',)
        }),
        ('Statut', {
            'fields': ('est_disponible', 'date_embauche')
        }),
        ('Agence', {
            'fields': ('Id_agence',)
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ============ GUICHETIERS ============

@admin.register(Guichetier)
class GuichetierAdmin(admin.ModelAdmin):
    list_display = ['name', 'surname', 'email', 'phone', '_id_filiale', 'est_actif', 'derniere_connexion']
    list_filter = ['est_actif', '_id_filiale', 'created_at']
    search_fields = ['name', 'surname', 'email', 'phone']
    readonly_fields = ['Id_guichetier', 'created_at', 'updated_at']
    autocomplete_fields = ['_id_filiale']
    ordering = ['surname', 'name']
    fieldsets = (
        ('Identité', {
            'fields': ('Id_guichetier', 'name', 'surname', 'photo_profil')
        }),
        ('Contact', {
            'fields': ('email', 'phone', 'adresse')
        }),
        ('Authentification', {
            'fields': ('password',)
        }),
        ('Filiale', {
            'fields': ('_id_filiale',)
        }),
        ('Statut', {
            'fields': ('est_actif', 'derniere_connexion')
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ============ TRAJETS ============

@admin.register(Trajet)
class TrajetAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'distance', 'est_actif', 'created_at']
    list_filter = ['est_actif', 'filiale_depart', 'filiale_arrive']
    search_fields = ['filiale_depart__nom', 'filiale_arrive__nom']
    readonly_fields = ['Id_trajet', 'created_at', 'updated_at']
    autocomplete_fields = ['filiale_depart', 'filiale_arrive']
    ordering = ['filiale_depart', 'filiale_arrive']


# ============ VOYAGES ============

@admin.register(Voyage)
class VoyageAdmin(admin.ModelAdmin):
    list_display = ['Id_voyage', 'Id_trajet', 'date_heure_depart', 'prix', 'status', 'places_disponibles', 'IdBus', 'id_chauffeur']
    list_filter = ['status', 'type_voyage', 'date_heure_depart', 'IdBus', 'id_chauffeur']
    search_fields = ['Id_trajet__filiale_depart__nom', 'Id_trajet__filiale_arrive__nom']
    readonly_fields = ['Id_voyage', 'created_at', 'updated_at']
    autocomplete_fields = ['Id_trajet', 'IdBus', 'id_chauffeur']
    ordering = ['-date_heure_depart']
    date_hierarchy = 'date_heure_depart'
    fieldsets = (
        ('Identification', {
            'fields': ('Id_voyage',)
        }),
        ('Trajet et horaires', {
            'fields': ('Id_trajet', 'date_heure_depart', 'date_heure_arrive_prevue', 'date_heure_arrive_reelle')
        }),
        ('Tarifs et places', {
            'fields': ('prix', 'type_voyage', 'places_disponibles', 'places_total_reservees')
        }),
        ('Assignations', {
            'fields': ('IdBus', 'id_chauffeur')
        }),
        ('Statut', {
            'fields': ('status', 'motif_annulation')
        }),
        ('Dates', {
            'fields': ('created_at', 'updated_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )


# ============ ANNONCES ============

@admin.register(Annonce)
class AnnonceAdmin(admin.ModelAdmin):
    list_display = ['type', 'message', 'Id_voyage', 'datePublication', 'est_active']
    list_filter = ['type', 'est_active', 'datePublication']
    search_fields = ['message']
    readonly_fields = ['id_annonce', 'datePublication', 'created_at', 'updated_at']
    autocomplete_fields = ['Id_voyage']
    ordering = ['-datePublication']
    fieldsets = (
        ('Information', {
            'fields': ('id_annonce', 'type', 'message')
        }),
        ('Voyage concerné', {
            'fields': ('Id_voyage',)
        }),
        ('Statut', {
            'fields': ('est_active',)
        }),
        ('Dates', {
            'fields': ('datePublication', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# ============ AVIS ============

@admin.register(Avis)
class AvisAdmin(admin.ModelAdmin):
    list_display = ['note', 'commentaires', 'Id_voyage', 'user_id', 'date_avis', 'est_approuve']
    list_filter = ['note', 'est_approuve', 'date_avis']
    search_fields = ['commentaires', 'user_id']
    readonly_fields = ['id_avis', 'date_avis', 'created_at', 'updated_at']
    autocomplete_fields = ['Id_voyage']
    ordering = ['-date_avis']
    fieldsets = (
        ('Évaluation', {
            'fields': ('id_avis', 'note', 'commentaires')
        }),
        ('Voyage et utilisateur', {
            'fields': ('Id_voyage', 'user_id')
        }),
        ('Modération', {
            'fields': ('est_approuve',)
        }),
        ('Dates', {
            'fields': ('date_avis', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )