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
  _normaliserVoyage: (v) => ({
    id:                 v.Id_voyage           || v.id,
    dateHeureDepart:    v.date_heure_depart,
    dateHeureArrivee:   v.date_heure_arrive_prevue,
    prix:               parseFloat(v.prix),
    typeVoyage:         (v.type_voyage        || "standard").toUpperCase(),
    status:             v.status,
    placesDisponibles:  v.places_disponibles,
    placesRestantes:    v.places_restantes    ?? v.places_disponibles,
    capacite:           v.capacite            ?? null,
    trajetInfo:         v.trajet_info         || "",
    origine:            v.origine             || null,
    destination:        v.destination         || null,
    busImmatriculation: v.bus_immatriculation,
    chauffeurNom:       v.chauffeur_nom,

    // ── FIX : codeAgence et codeFiliale viennent directement du backend ──
    // VoyageListSerializer expose désormais ces deux champs :
    //   codeAgence  → voyage.IdBus.Id_agence.name
    //   codeFiliale → voyage.Id_trajet.filiale_depart.code
    // On ne les reconstruit plus depuis trajet_info (approche fragile).
    codeAgence:         v.codeAgence          || null,
    codeFiliale:        v.codeFiliale         || null,

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
   * Les villes sont stockées en minuscule dans Django (choices),
   * on convertit donc en minuscule avant l'envoi.
   *
   * Fallback : si /recherche/ retourne vide, on récupère tous
   * les voyages non annulés/terminés pour la date demandée.
   */
  rechercherVoyages: async ({ origine, destination, date } = {}) => {
    const depart  = (origine      || "").toLowerCase().trim();
    const arrivee = (destination  || "").toLowerCase().trim();

    // ── Tentative 1 : endpoint dédié /recherche/ ──
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

    // ── Fallback : /voyages/ avec filtre de date ──
    console.info("[fleetService] Fallback sur /api/voyages/");
    const fallbackParams = {};
    if (date) fallbackParams.date_debut = date;

    const { data: tous } = await api.get("/api/voyages/", { params: fallbackParams });

    const voyagesFiltres = (Array.isArray(tous) ? tous : []).filter((v) => {
      if (["annule", "termine"].includes(v.status)) return false;

      if (depart && v.trajet_info) {
        const info = v.trajet_info.toLowerCase();
        if (!info.includes(depart)) return false;
      }

      if (arrivee && v.trajet_info) {
        const info = v.trajet_info.toLowerCase();
        if (!info.includes(arrivee)) return false;
      }

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
};