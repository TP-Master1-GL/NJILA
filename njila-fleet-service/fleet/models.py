from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.utils import timezone
import uuid


# ============ ÉNUMÉRATIONS ============

class ClasseBus(models.TextChoices):
    """Énumération pour les classes de bus"""
    STANDARD = 'standard', 'Standard'
    VIP = 'vip', 'VIP'
    CONFORT = 'confort', 'Confort'
    LUXE = 'luxe', 'Luxe'

class StatusBus(models.TextChoices):
    """Énumération pour les statuts de bus"""
    DISPONIBLE = 'disponible', 'Disponible'
    EN_PANNE = 'en_panne', 'En panne'
    EN_VOYAGE = 'en_voyage', 'En voyage'
    MAINTENANCE = 'maintenance', 'En maintenance'
    RESERVE = 'reserve', 'Réservé'

class TypeVoyage(models.TextChoices):
    STANDARD = 'standard', 'Standard'
    VIP = 'vip', 'VIP'
    CONFORT = 'confort', 'Confort'
    LUXE = 'luxe', 'Luxe'

class StatusVoyage(models.TextChoices):
    PROGRAMME = 'programme', 'Programmé'
    CONFIRME = 'confirme', 'Confirmé'
    EN_COURS = 'en_cours', 'En cours'
    TERMINE = 'termine', 'Terminé'
    ANNULE = 'annule', 'Annulé'
    RETARDE = 'retarde', 'Retardé'

class StatutGlobalAgence(models.TextChoices):
    ACTIVE = 'active', 'Active'
    SUSPENDUE = 'suspendue', 'Suspendue'
    EXPIREE = 'expiree', 'Expirée'
    EN_ATTENTE = 'en_attente', 'En attente'

class TypeAnnonce(models.TextChoices):
    RETARD = 'retard', 'Retard'
    ANNULATION = 'annulation', 'Annulation'
    PROMOTION = 'promotion', 'Promotion'
    INFORMATION = 'information', 'Information'


# ============ MODÈLES ============

class Agence(models.Model):
    """
    Agence mère - Respecte exactement le MCD
    Attributs: Id_agence, name, adresse, telephone, email_officiel, statut_global, logo_image, date_inscription
    """
    id_agence = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    adresse = models.TextField()
    telephone = models.CharField(max_length=20)
    email_officiel = models.EmailField(unique=True)
    statut_global = models.CharField(max_length=20, choices=StatutGlobalAgence.choices, default=StatutGlobalAgence.ACTIVE)
    logo_image = models.ImageField(
        upload_to='agences/logos/',  
        blank=True,
        null=True,
        help_text="Logo de l'agence (format: JPG, PNG, max 2MB)"
    )    
    date_inscription = models.DateTimeField(auto_now_add=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Agence"
        verbose_name_plural = "Agences"
        db_table = 'njila_agence'
        indexes = [
            models.Index(fields=['statut_global']),
            models.Index(fields=['email_officiel']),
        ]
    
    def __str__(self):
        return self.name


class Filiale(models.Model):
    """
    Filiale d'une agence
    """
    VILLES = [
        ('Douala', 'Douala'),
        ('Yaoundé', 'Yaoundé'),
        ('Bafoussam', 'Bafoussam'),
        ('Garoua', 'Garoua'),
        ('Ngaoundéré', 'Ngaoundéré'),
        ('Bamenda', 'Bamenda'),
        ('Maroua', 'Maroua'),
        ('Kribi', 'Kribi'),
        ('Limbe', 'Limbe'),
        ('Ebolowa', 'Ebolowa'),
    ]
    
    id_filiale = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agence = models.ForeignKey(Agence, on_delete=models.CASCADE, related_name='filiales')
    nom = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    ville = models.CharField(max_length=50, choices=VILLES)
    adresse = models.TextField()
    telephone = models.CharField(max_length=20)
    email = models.EmailField()
    est_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Filiale"
        verbose_name_plural = "Filiales"
        db_table = 'njila_filiale'
        unique_together = ['agence', 'code']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['ville', 'est_active']),
        ]
    
    def __str__(self):
        return f"{self.nom} - {self.ville}"


class Bus(models.Model):
    """
    Bus - Respecte exactement le MCD
    Attributs: IdBus, modele, immatriculation, capacite, etat, Id_agence
    """
    IdBus = models.AutoField(primary_key=True)
    modele = models.CharField(max_length=50)
    immatriculation = models.CharField(
        max_length=20, 
        unique=True,
        validators=[RegexValidator(r'^[A-Z0-9\s]+$', 'L\'immatriculation ne doit contenir que des lettres majuscules et des chiffres')]
    )
    capacite = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(100)])
    etat = models.CharField(max_length=20, choices=StatusBus.choices, default=StatusBus.DISPONIBLE)
    Id_agence = models.ForeignKey(Agence, on_delete=models.CASCADE, related_name='bus')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Bus"
        verbose_name_plural = "Bus"
        db_table = 'njila_bus'
        indexes = [
            models.Index(fields=['immatriculation']),
            models.Index(fields=['etat']),
            models.Index(fields=['Id_agence', 'etat']),
        ]
    
    def __str__(self):
        return f"{self.immatriculation} - {self.modele}"


class Chauffeur(models.Model):
    """
    Chauffeur - Respecte exactement le MCD
    Attributs: id_chauffeur, numero_permis, name, surname, email, phone, Adresse, photo_profil, Id_agence
    """
    id_chauffeur = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_permis = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    surname = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    Adresse = models.TextField()
    photo_profil = models.URLField(blank=True)
    Id_agence = models.ForeignKey(Agence, on_delete=models.CASCADE, related_name='chauffeurs')
    
    est_disponible = models.BooleanField(default=True)
    date_embauche = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Chauffeur"
        verbose_name_plural = "Chauffeurs"
        db_table = 'njila_chauffeur'
        indexes = [
            models.Index(fields=['numero_permis']),
            models.Index(fields=['Id_agence']),
            models.Index(fields=['est_disponible']),
        ]
    
    def __str__(self):
        return f"{self.name} {self.surname} - {self.numero_permis}"


class Guichetier(models.Model):
    """
    Guichetier - Respecte exactement le MCD
    Attributs: Id_guichetier, name, surname, email, phone, derniere_connexion, adresse, photo_profil, password, _id_filiale
    """
    Id_guichetier = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    surname = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    derniere_connexion = models.DateTimeField(null=True, blank=True)
    adresse = models.TextField()
    photo_profil = models.ImageField(
        upload_to='guichetiers/photos/',
        blank=True,
        null=True,
        help_text="Photo de profil (format: JPG, PNG, max 2MB)"
    )    
    password = models.CharField(max_length=255)
    _id_filiale = models.ForeignKey(Filiale, on_delete=models.CASCADE, related_name='guichetiers', null=True, blank=True)
    
    est_actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Guichetier"
        verbose_name_plural = "Guichetiers"
        db_table = 'njila_guichetier'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['_id_filiale']),
        ]
    
    def __str__(self):
        return f"{self.name} {self.surname}"


class Trajet(models.Model):
    """
    Trajet - Respecte exactement le MCD
    Attributs: Id_trajet, filiale_depart, filiale_arrive, distance
    """
    Id_trajet = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    filiale_depart = models.ForeignKey(Filiale, on_delete=models.PROTECT, related_name='trajets_depart')
    filiale_arrive = models.ForeignKey(Filiale, on_delete=models.PROTECT, related_name='trajets_arrivee')
    distance = models.FloatField(validators=[MinValueValidator(0)], help_text="Distance en kilomètres")
    
    est_actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Trajet"
        verbose_name_plural = "Trajets"
        db_table = 'njila_trajet'
        unique_together = ['filiale_depart', 'filiale_arrive']
        indexes = [
            models.Index(fields=['filiale_depart', 'filiale_arrive']),
        ]
    
    def __str__(self):
        return f"{self.filiale_depart.nom} → {self.filiale_arrive.nom} ({self.distance} km)"


class Voyage(models.Model):
    """
    Voyage - Respecte exactement le MCD
    Attributs: Id_voyage, date_heure_depart, date_heure_arrive_prevue, prix, type_voyage, 
               status, places_disponibles, places_total_reservees, id_chauffeur, IdBus, Id_trajet
    """
    Id_voyage = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date_heure_depart = models.DateTimeField()
    date_heure_arrive_prevue = models.DateTimeField()
    prix = models.DecimalField(max_digits=10, decimal_places=2)
    type_voyage = models.CharField(max_length=20, choices=TypeVoyage.choices, default=TypeVoyage.STANDARD)
    status = models.CharField(max_length=20, choices=StatusVoyage.choices, default=StatusVoyage.PROGRAMME)
    places_disponibles = models.IntegerField(validators=[MinValueValidator(0)])
    places_total_reservees = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    
    id_chauffeur = models.ForeignKey(Chauffeur, on_delete=models.SET_NULL, null=True, blank=True, related_name='voyages')
    IdBus = models.ForeignKey(Bus, on_delete=models.PROTECT, related_name='voyages')
    Id_trajet = models.ForeignKey(Trajet, on_delete=models.PROTECT, related_name='voyages')
    
    date_heure_arrive_reelle = models.DateTimeField(null=True, blank=True)
    motif_annulation = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, blank=True)
    
    class Meta:
        verbose_name = "Voyage"
        verbose_name_plural = "Voyages"
        db_table = 'njila_voyage'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['date_heure_depart']),
            models.Index(fields=['Id_trajet', 'date_heure_depart']),
            models.Index(fields=['IdBus', 'status']),
            models.Index(fields=['id_chauffeur']),
        ]
    
    def __str__(self):
        return f"{self.Id_trajet} - {self.date_heure_depart.strftime('%d/%m/%Y %H:%M')}"
    
    def places_restantes(self):
        return self.places_disponibles


class Annonce(models.Model):
    """
    Annonce - Respecte exactement le MCD
    Attributs: id_annonce, type, message, datePublication, Id_voyage
    """
    id_annonce = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=20, choices=TypeAnnonce.choices)
    message = models.TextField()
    datePublication = models.DateTimeField(auto_now_add=True)
    Id_voyage = models.ForeignKey(Voyage, on_delete=models.CASCADE, related_name='annonces')
    
    est_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Annonce"
        verbose_name_plural = "Annonces"
        db_table = 'njila_annonce'
        indexes = [
            models.Index(fields=['Id_voyage']),
            models.Index(fields=['datePublication']),
        ]
    
    def __str__(self):
        return f"{self.get_type_display()} - {self.Id_voyage} - {self.datePublication.strftime('%d/%m/%Y')}"


class Avis(models.Model):
    """
    Avis - Respecte exactement le MCD
    Attributs: id_avis, note, date_avis, commentaires, Id_voyage
    """
    id_avis = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    note = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    date_avis = models.DateTimeField(auto_now_add=True)
    commentaires = models.TextField()
    Id_voyage = models.ForeignKey(Voyage, on_delete=models.CASCADE, related_name='avis')
    
    user_id = models.UUIDField(null=True, blank=True)
    est_approuve = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Avis"
        verbose_name_plural = "Avis"
        db_table = 'njila_avis'
        unique_together = ['user_id', 'Id_voyage']
        indexes = [
            models.Index(fields=['Id_voyage']),
            models.Index(fields=['note']),
            models.Index(fields=['user_id']),
        ]
    
    def __str__(self):
        return f"Avis {self.note}/5 - Voyage {self.Id_voyage}"