import api from "./axios";

export const fleetService = {

  // ═══════════════════════════════════════════════════════════
  //  BUS
  // ═══════════════════════════════════════════════════════════
  getBus: async (params) => {
    const { data } = await api.get("/api/bus/", { params });
    return data;
  },
  getBusDisponibles: async () => {
    const { data } = await api.get("/api/bus/disponibles/");
    return data;
  },
  getBusDetail: async (IdBus) => {
    const { data } = await api.get(`/api/bus/${IdBus}/`);
    return data;
  },
  ajouterBus: async (payload) => {
    const { data } = await api.post("/api/bus/", payload);
    return data;
  },
  modifierBus: async (IdBus, payload) => {
    const { data } = await api.patch(`/api/bus/${IdBus}/`, payload);
    return data;
  },
  changerEtatBus: async (IdBus, etat) => {
    const { data } = await api.put(`/api/bus/${IdBus}/etat/`, { etat });
    return data;
  },
  supprimerBus: async (IdBus) => {
    await api.delete(`/api/bus/${IdBus}/`);
  },
  getBusStats: async () => {
    const { data } = await api.get("/api/stats/");
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  CHAUFFEURS
  // ═══════════════════════════════════════════════════════════
  getChauffeurs: async (params) => {
    const { data } = await api.get("/api/chauffeurs/", { params });
    return data;
  },
  getChauffeurDetail: async (id_chauffeur) => {
    const { data } = await api.get(`/api/chauffeurs/${id_chauffeur}/`);
    return data;
  },
  creerChauffeur: async (payload) => {
    const isMultipart = payload instanceof FormData;
    const { data } = await api.post("/api/chauffeurs/", payload, {
      headers: isMultipart ? { "Content-Type": "multipart/form-data" } : {},
    });
    return data;
  },
  modifierChauffeur: async (id_chauffeur, payload) => {
    const isMultipart = payload instanceof FormData;
    const { data } = await api.patch(`/api/chauffeurs/${id_chauffeur}/`, payload, {
      headers: isMultipart ? { "Content-Type": "multipart/form-data" } : {},
    });
    return data;
  },
  changerDisponibiliteChauffeur: async (id_chauffeur, est_disponible) => {
    const { data } = await api.put(
      `/api/chauffeurs/${id_chauffeur}/disponibilite/`,
      { est_disponible }
    );
    return data;
  },
  supprimerChauffeur: async (id_chauffeur) => {
    await api.delete(`/api/chauffeurs/${id_chauffeur}/`);
  },

  // ═══════════════════════════════════════════════════════════
  //  TRAJETS
  // ═══════════════════════════════════════════════════════════
  getTrajets: async (params) => {
    const { data } = await api.get("/api/trajets/", { params });
    return data;
  },
  getTrajetDetail: async (Id_trajet) => {
    const { data } = await api.get(`/api/trajets/${Id_trajet}/`);
    return data;
  },
  creerTrajet: async (payload) => {
    const { data } = await api.post("/api/trajets/", payload);
    return data;
  },
  modifierTrajet: async (Id_trajet, payload) => {
    const { data } = await api.patch(`/api/trajets/${Id_trajet}/`, payload);
    return data;
  },
  supprimerTrajet: async (Id_trajet) => {
    await api.delete(`/api/trajets/${Id_trajet}/`);
  },

  // ═══════════════════════════════════════════════════════════
  //  NORMALISATION (snake_case → camelCase)
  // ═══════════════════════════════════════════════════════════
  /**
   * Normalise un objet voyage brut (réponse Django) vers la forme
   * attendue par le frontend.
   *
   * ⚠️  IMPORTANT : idAgence et idFiliale sont les PK UUID nécessaires
   * pour l'enregistrement des réservations côté booking-service.
   * Ils sont sérialisés par VoyageListSerializer (et VoyageSerializer via
   * SerializerMethodField) et doivent IMPÉRATIVEMENT être préservés ici.
   */
  _normaliserVoyage: (v) => ({
    id:                 v.Id_voyage              || v.id,
    dateHeureDepart:    v.date_heure_depart       || v.dateHeureDepart,
    dateHeureArrivee:   v.date_heure_arrive_prevue || v.dateHeureArrivee,
    prix:               parseFloat(v.prix),
    typeVoyage:         (v.type_voyage            || v.typeVoyage || "standard").toUpperCase(),
    status:             v.status,
    placesDisponibles:  v.places_disponibles      ?? v.placesDisponibles,
    placesRestantes:    v.places_restantes        ?? v.places_disponibles ?? v.placesRestantes,
    capacite:           v.capacite               ?? null,
    trajetInfo:         v.trajet_info             || v.trajetInfo || "",
    origine:            v.origine                || null,
    destination:        v.destination            || null,
    busImmatriculation: v.bus_immatriculation     || v.busImmatriculation,
    chauffeurNom:       v.chauffeur_nom           || v.chauffeurNom,
    codeAgence:         v.codeAgence             || null,
    codeFiliale:        v.codeFiliale            || null,

    // ── IDs UUID (nécessaires pour le booking-service) ────────────────────
    idAgence:           v.idAgence               || null,
    idFiliale:          v.idFiliale              || null,

    // Données brutes conservées en cas de besoin d'accès direct
    _raw:               v,
  }),

  // ═══════════════════════════════════════════════════════════
  //  VOYAGES
  // ═══════════════════════════════════════════════════════════
  getVoyages: async (params) => {
    const { data } = await api.get("/api/voyages/", { params });
    return data;
  },

  /**
   * Recherche de voyages.
   * Le backend attend : depart (ville), arrivee (ville), date (YYYY-MM-DD)
   */
  rechercherVoyages: async ({ origine, destination, date } = {}) => {
    const depart  = (origine      || "").toLowerCase().trim();
    const arrivee = (destination  || "").toLowerCase().trim();

    try {
      const params = { depart, arrivee };
      if (date) params.date = date;
      const { data } = await api.get("/api/voyages/recherche/", { params });
      if (Array.isArray(data) && data.length > 0) {
        return data.map(fleetService._normaliserVoyage);
      }
    } catch (err) {
      console.warn("[fleetService] /voyages/recherche/ a échoué :", err.message);
    }

    console.info("[fleetService] Fallback sur /api/voyages/");
    const fallbackParams = {};
    if (date) fallbackParams.date_debut = date;

    const { data: tous } = await api.get("/api/voyages/", { params: fallbackParams });

    const voyagesFiltres = (Array.isArray(tous) ? tous : []).filter((v) => {
      if (["annule", "termine"].includes(v.status)) return false;
      if (depart  && v.trajet_info && !v.trajet_info.toLowerCase().includes(depart))  return false;
      if (arrivee && v.trajet_info && !v.trajet_info.toLowerCase().includes(arrivee)) return false;
      return true;
    });

    return voyagesFiltres.map(fleetService._normaliserVoyage);
  },

  getVoyageDetail: async (Id_voyage) => {
    const { data } = await api.get(`/api/voyages/${Id_voyage}/`);
    return fleetService._normaliserVoyage(data);
  },
  creerVoyage: async (payload) => {
    const { data } = await api.post("/api/voyages/", payload);
    return data;
  },
  modifierVoyage: async (Id_voyage, payload) => {
    const { data } = await api.patch(`/api/voyages/${Id_voyage}/`, payload);
    return data;
  },
  changerStatutVoyage: async (Id_voyage, status, motif_annulation = "") => {
    const { data } = await api.put(`/api/voyages/${Id_voyage}/statut/`, {
      status,
      ...(motif_annulation && { motif_annulation }),
    });
    return data;
  },
  assignerBusVoyage: async (Id_voyage, IdBus) => {
    const { data } = await api.post(`/api/voyages/${Id_voyage}/assign-bus/`, { IdBus });
    return data;
  },
  assignerChauffeurVoyage: async (Id_voyage, id_chauffeur) => {
    const { data } = await api.post(`/api/voyages/${Id_voyage}/assign-chauffeur/`, { id_chauffeur });
    return data;
  },
  supprimerVoyage: async (Id_voyage) => {
    await api.delete(`/api/voyages/${Id_voyage}/`);
  },

  // ═══════════════════════════════════════════════════════════
  //  FILIALES
  // ═══════════════════════════════════════════════════════════
  getFiliales: async (params) => {
    const { data } = await api.get("/api/filiales/", { params });
    return data;
  },
  getFilialeStats: async (id_filiale) => {
    const { data } = await api.get(`/api/filiales/${id_filiale}/stats/`);
    return data;
  },

  // ═══════════════════════════════════════════════════════════
  //  PROFIL PUBLIC AGENCE
  // ═══════════════════════════════════════════════════════════

  /**
   * Retourne le profil public complet d'une agence.
   *
   * Structure retournée par le backend (AgenceProfilPublicView) :
   * {
   *   agence, resume, filiales, bus, trajets, voyages, annonces, avis
   * }
   *
   * Champs voyage exposés par le backend :
   *   id_voyage, origine, destination, filiale_depart, filiale_arrivee,
   *   date_heure_depart, date_heure_arrivee, prix, type_voyage, status,
   *   status_label, places_disponibles, places_total_reservees,
   *   bus_immatriculation, bus_modele, bus_capacite
   *
   * ⚠️  Le backend N'expose PAS filiale_depart_id / filiale_arrivee_id
   * dans les voyages ni dans les trajets. La comparaison Manager Local
   * doit donc se faire par NOM de filiale (filiale_depart / filiale_arrivee).
   *
   * @param {string} id_agence   - UUID de l'agence
   * @param {object} filtres     - Filtres optionnels :
   *   - statut_voyage  : "programme"|"en_cours"|"termine"|"annule"|"retarde"|"confirme"
   *   - ville_depart   : ex. "Douala"
   *   - ville_arrivee  : ex. "Yaoundé"
   */
  getAgenceProfil: async (id_agence, filtres = {}) => {
    const params = {};
    if (filtres.statut_voyage) params.statut_voyage = filtres.statut_voyage;
    if (filtres.ville_depart)  params.ville_depart  = filtres.ville_depart;
    if (filtres.ville_arrivee) params.ville_arrivee = filtres.ville_arrivee;

    const { data } = await api.get(
      `/api/agences/${id_agence}/profil/`,
      { params }
    );
    return data;
  },

  /**
   * Normalise le profil agence retourné par le backend.
   *
   * RÈGLE CRITIQUE :
   * Les voyages sont conservés tels quels (structure snake_case du backend)
   * afin que GestionVoyages.jsx puisse lire directement les champs
   * filiale_depart, filiale_arrivee, id_voyage, etc. sans double mapping.
   *
   * On ajoute seulement des alias camelCase pour les pages qui en ont besoin
   * (ex : page de recherche publique), mais on ne supprime JAMAIS les clés
   * snake_case originales.
   *
   * @param {object} profil  - Résultat brut de getAgenceProfil()
   * @returns {object}       - Profil avec voyages enrichis (snake_case + alias camelCase)
   */
  normaliserProfilAgence: (profil) => {
    if (!profil) return null;

    return {
      ...profil,

      // ── Bus : exposés tels quels par le backend ──────────────────────────
      // Structure : { id, immatriculation, modele, capacite, etat, etat_label }
      // Aucun remapping nécessaire — GestionVoyages lit directement ces clés.
      bus: profil.bus || [],

      // ── Trajets : exposés tels quels par le backend ──────────────────────
      // Structure : { id_trajet, filiale_depart, ville_depart,
      //               filiale_arrivee, ville_arrivee, distance_km }
      // Aucun remapping nécessaire.
      trajets: profil.trajets || [],

      // ── Voyages : snake_case préservés + alias camelCase ajoutés ─────────
      voyages: (profil.voyages || []).map((v) => ({
        // ── Champs originaux du backend (snake_case) — NE PAS SUPPRIMER ──
        id_voyage:               v.id_voyage,
        origine:                 v.origine,
        destination:             v.destination,
        filiale_depart:          v.filiale_depart,
        filiale_arrivee:         v.filiale_arrivee,
        date_heure_depart:       v.date_heure_depart,
        date_heure_arrivee:      v.date_heure_arrivee,
        prix:                    v.prix,
        type_voyage:             v.type_voyage,
        status:                  v.status,
        status_label:            v.status_label,
        places_disponibles:      v.places_disponibles,
        places_total_reservees:  v.places_total_reservees,
        bus_immatriculation:     v.bus_immatriculation,
        bus_modele:              v.bus_modele,
        bus_capacite:            v.bus_capacite,

        // ── Alias camelCase (pour compatibilité page recherche publique) ──
        id:                      v.id_voyage,
        dateHeureDepart:         v.date_heure_depart,
        dateHeureArrivee:        v.date_heure_arrivee,
        prixNum:                 parseFloat(v.prix),
        typeVoyage:              (v.type_voyage || "standard").toUpperCase(),
        statusLabel:             v.status_label,
        placesDisponibles:       v.places_disponibles,
        placesReservees:         v.places_total_reservees,
        busImmatriculation:      v.bus_immatriculation,
        busModele:               v.bus_modele,
        busCapacite:             v.bus_capacite,
        filialeDepart:           v.filiale_depart,
        filialeArrivee:          v.filiale_arrivee,
      })),
    };
  },

  /**
   * Raccourci : récupère ET normalise le profil en une seule étape.
   *
   * @param {string} id_agence
   * @param {object} filtres
   * @returns {object} profil normalisé
   */
  getAgenceProfilNormalise: async (id_agence, filtres = {}) => {
    const profil = await fleetService.getAgenceProfil(id_agence, filtres);
    return fleetService.normaliserProfilAgence(profil);
  },
};