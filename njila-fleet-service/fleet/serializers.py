from rest_framework import serializers
from .models import (
    Agence, Bus, Guichetier, Chauffeur, Trajet, 
    Voyage, Filiale, Annonce, Avis,
    TypeVoyage, StatusVoyage, StatusBus, StatutGlobalAgence, ClasseBus, StatusBus, TypeAnnonce
)

class BusListSerializer(serializers.ModelSerializer):
    """
    Serializer pour la liste des bus
    """
    class Meta:
        model = Bus
        fields = [
            'IdBus', 'immatriculation', 'modele', 
            'capacite',  'etat', 'Id_agence'
        ]


class BusDetailSerializer(serializers.ModelSerializer):
    """
    Serializer pour les détails d'un bus
    """
    class Meta:
        model = Bus
        fields = [
            'IdBus', 'immatriculation', 'modele', 
            'capacite', 'etat', 'Id_agence',
            'created_at', 'updated_at'
        ]


class BusCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer pour la création et mise à jour des bus
    """
    class Meta:
        model = Bus
        fields = [
            'IdBus', 'immatriculation', 'modele', 
            'capacite',  'etat', 'Id_agence'
        ]
        read_only_fields = ['IdBus']
    
    def validate_immatriculation(self, value):
        if not value.replace(' ', '').isalnum():
            raise serializers.ValidationError(
                "L'immatriculation ne doit contenir que des lettres et des chiffres"
            )
        return value.upper()
    
    def validate_capacite(self, value):
        if value < 1 or value > 100:
            raise serializers.ValidationError(
                "La capacité doit être comprise entre 1 et 100 places"
            )
        return value


class BusStatusUpdateSerializer(serializers.Serializer):
    """
    Serializer pour la mise à jour du statut d'un bus
    """
    etat = serializers.ChoiceField(choices=StatusBus.choices)
    
    def validate_status(self, value):
        if value not in dict(StatusBus.choices):
            raise serializers.ValidationError(
                f"Statut invalide. Choisir parmi: {dict(StatusBus.choices)}"
            )
        return value
    




# ============ AGENCE ============

class AgenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Agence
        fields = '__all__'
        read_only_fields = ['id_agence', 'date_inscription', 'created_at', 'updated_at']
    
    def validate_email_officiel(self, value):
        if Agence.objects.filter(email_officiel=value).exclude(id_agence=self.instance.id_agence if self.instance else None).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé")
        return value
    
    def validate_code(self, value):
        value = value.upper().strip()
        if not value.isalnum():
            raise serializers.ValidationError("Le code ne doit contenir que des lettres et chiffres")
        return value
    def validate_logo_image(self, value):
        if value:
            if value.size > 2 * 1024 * 1024:
                raise serializers.ValidationError("L'image ne doit pas dépasser 2MB")
            
            valid_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif']
            if value.content_type not in valid_types:
                raise serializers.ValidationError("Format d'image non supporté. Utilisez JPG, PNG ou GIF")
        
        return value


class AgenceListSerializer(serializers.ModelSerializer):
    nb_filiales = serializers.IntegerField(source='filiales.count', read_only=True)
    nb_bus = serializers.IntegerField(source='bus.count', read_only=True)
    
    class Meta:
        model = Agence
        fields = ['id_agence', 'name', 'adresse', 'telephone', 'email_officiel', 
                  'statut_global', 'logo_image', 'date_inscription', 'nb_filiales', 'nb_bus']


# ============ FILIALE ============

class FilialeSerializer(serializers.ModelSerializer):
    agence_name = serializers.CharField(source='agence.name', read_only=True)
    
    class Meta:
        model = Filiale
        fields = '__all__'
        read_only_fields = ['id_filiale', 'created_at', 'updated_at']


class FilialeListSerializer(serializers.ModelSerializer):
    agence_name = serializers.CharField(source='agence.name', read_only=True)
    nb_bus = serializers.IntegerField(source='bus.count', read_only=True)
    
    class Meta:
        model = Filiale
        fields = ['id_filiale', 'nom', 'code', 'ville', 'adresse', 'telephone', 
                  'email', 'est_active', 'agence_name', 'nb_bus']




# ============ GUICHETIER ============

class GuichetierSerializer(serializers.ModelSerializer):
    filiale_nom = serializers.CharField(source='_id_filiale.nom', read_only=True, allow_null=True)
    nom_complet = serializers.SerializerMethodField()
    
    class Meta:
        model = Guichetier
        fields = '__all__'
        read_only_fields = ['Id_guichetier', 'created_at', 'updated_at']
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def get_nom_complet(self, obj):
        return f"{obj.name} {obj.surname}"
    
    def create(self, validated_data):
        # Hash du mot de passe
        from django.contrib.auth.hashers import make_password
        validated_data['password'] = make_password(validated_data['password'])
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        if 'password' in validated_data:
            from django.contrib.auth.hashers import make_password
            validated_data['password'] = make_password(validated_data['password'])
        return super().update(instance, validated_data)
    
    def validate_photo_profil(self, value):
        """Validation de la photo de profil"""
        if value:
            # Vérifier la taille du fichier (max 2MB)
            if value.size > 2 * 1024 * 1024:
                raise serializers.ValidationError("La photo ne doit pas dépasser 2MB")
            
            # Vérifier le type de fichier
            valid_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif']
            if value.content_type not in valid_types:
                raise serializers.ValidationError("Format d'image non supporté. Utilisez JPG, PNG ou GIF")
        
        return value


# ============ CHAUFFEUR ============

class ChauffeurSerializer(serializers.ModelSerializer):
    agence_name = serializers.CharField(source='Id_agence.name', read_only=True)
    nom_complet = serializers.SerializerMethodField()
    
    class Meta:
        model = Chauffeur
        fields = '__all__'
        read_only_fields = ['id_chauffeur', 'created_at', 'updated_at']
    
    def get_nom_complet(self, obj):
        return f"{obj.name} {obj.surname}"
    
    def validate_photo_profil(self, value):
        """Validation de la photo de profil"""
        if value:
            # Vérifier la taille du fichier (max 2MB)
            if value.size > 2 * 1024 * 1024:
                raise serializers.ValidationError("La photo ne doit pas dépasser 2MB")
            
            # Vérifier le type de fichier
            valid_types = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif']
            if value.content_type not in valid_types:
                raise serializers.ValidationError("Format d'image non supporté. Utilisez JPG, PNG ou GIF")
        
        return value


class ChauffeurListSerializer(serializers.ModelSerializer):
    agence_name = serializers.CharField(source='Id_agence.name', read_only=True)
    nom_complet = serializers.SerializerMethodField()
    
    class Meta:
        model = Chauffeur
        fields = ['id_chauffeur', 'numero_permis', 'name', 'surname', 'email', 
                  'phone', 'est_disponible', 'agence_name', 'nom_complet', 'photo_profil']
    
    def get_nom_complet(self, obj):
        return f"{obj.name} {obj.surname}"


# ============ TRAJET ============

class TrajetSerializer(serializers.ModelSerializer):
    filiale_depart_nom = serializers.CharField(source='filiale_depart.nom', read_only=True)
    filiale_arrive_nom = serializers.CharField(source='filiale_arrive.nom', read_only=True)
    
    class Meta:
        model = Trajet
        fields = '__all__'
        read_only_fields = ['Id_trajet', 'created_at', 'updated_at']


class TrajetListSerializer(serializers.ModelSerializer):
    filiale_depart_nom = serializers.CharField(source='filiale_depart.nom', read_only=True)
    filiale_arrive_nom = serializers.CharField(source='filiale_arrive.nom', read_only=True)
    
    class Meta:
        model = Trajet
        fields = ['Id_trajet', 'filiale_depart_nom', 'filiale_arrive_nom', 'distance', 'est_actif']


# ============ VOYAGE ============

class VoyageSerializer(serializers.ModelSerializer):
    trajet_detail = TrajetSerializer(source='Id_trajet', read_only=True)
    bus_detail = BusDetailSerializer(source='IdBus', read_only=True)
    chauffeur_detail = ChauffeurSerializer(source='id_chauffeur', read_only=True)
    places_restantes = serializers.SerializerMethodField()
    
    class Meta:
        model = Voyage
        fields = '__all__'
        read_only_fields = ['Id_voyage', 'created_at', 'updated_at']
    
    def get_places_restantes(self, obj):
        return obj.places_disponibles


class VoyageListSerializer(serializers.ModelSerializer):
    trajet_info = serializers.SerializerMethodField()
    bus_immatriculation = serializers.CharField(source='IdBus.immatriculation', read_only=True)
    chauffeur_nom = serializers.SerializerMethodField()
    places_restantes = serializers.SerializerMethodField()
    
    class Meta:
        model = Voyage
        fields = ['Id_voyage', 'date_heure_depart', 'date_heure_arrive_prevue', 'prix', 
                  'type_voyage', 'status', 'places_disponibles', 'places_total_reservees',
                  'trajet_info', 'bus_immatriculation', 'chauffeur_nom', 'places_restantes']
    
    def get_trajet_info(self, obj):
        return f"{obj.Id_trajet.filiale_depart.nom} → {obj.Id_trajet.filiale_arrive.nom}"
    
    def get_chauffeur_nom(self, obj):
        if obj.id_chauffeur:
            return f"{obj.id_chauffeur.name} {obj.id_chauffeur.surname}"
        return None
    
    def get_places_restantes(self, obj):
        return obj.places_disponibles


class VoyageCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Voyage
        fields = '__all__'
        read_only_fields = ['Id_voyage', 'places_total_reservees', 'created_at', 'updated_at']
    
    def validate(self, data):
        if data.get('date_heure_depart') and data.get('date_heure_arrive_prevue'):
            if data['date_heure_arrive_prevue'] <= data['date_heure_depart']:
                raise serializers.ValidationError({
                    'date_heure_arrive_prevue': "La date d'arrivée doit être postérieure au départ"
                })
        
        if data.get('IdBus') and data['IdBus'].etat != StatusBus.DISPONIBLE:
            raise serializers.ValidationError({
                'IdBus': "Le bus n'est pas disponible pour un voyage"
            })
        
        return data


class VoyageStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=StatusVoyage.choices)
    motif = serializers.CharField(required=False, allow_blank=True)


# ============ ANNONCE ============

class AnnonceSerializer(serializers.ModelSerializer):
    voyage_info = serializers.SerializerMethodField()
    
    class Meta:
        model = Annonce
        fields = '__all__'
        read_only_fields = ['id_annonce', 'datePublication', 'created_at', 'updated_at']
    
    def get_voyage_info(self, obj):
        return str(obj.Id_voyage)


# ============ AVIS ============

class AvisSerializer(serializers.ModelSerializer):
    voyage_info = serializers.SerializerMethodField()
    
    class Meta:
        model = Avis
        fields = '__all__'
        read_only_fields = ['id_avis', 'date_avis', 'created_at', 'updated_at']
    
    def get_voyage_info(self, obj):
        return str(obj.Id_voyage)