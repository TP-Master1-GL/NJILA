/**
 * FilialeFormModal.jsx
 * 
 * Modal pour créer ou éditer une filiale
 * ✅ Utilisation des IDs (UUID) au lieu des codes
 * ✅ Navigation correcte après sauvegarde
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { filialeService } from "../../services/filialeService";

const VILLES = [
  "Douala",
  "Yaoundé",
  "Bafoussam",
  "Garoua",
  "Ngaoundéré",
  "Bamenda",
  "Maroua",
  "Kribi",
  "Limbe",
  "Ebolowa",
  "Dschang",
];

export default function FilialeFormModal({ filiale = null, agenceId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    nom: filiale?.nom || "",
    code: filiale?.code || "",
    ville: filiale?.ville || "",
    adresse: filiale?.adresse || "",
    telephone: filiale?.telephone || "",
    email: filiale?.email || "",
    est_active: filiale?.est_active !== false,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = !!filiale?.id_filiale;

  // ── Mutation ──
  const submitMutation = useMutation({
    mutationFn: async (payload) => {
      if (isEdit) {
        return filialeService.modifierFiliale(filiale.id_filiale, payload);
      } else {
        return filialeService.creerFiliale({ ...payload, agence: agenceId });
      }
    },
    onSuccess: (data) => {
      toast.success(isEdit ? "Filiale mise à jour !" : "Filiale créée !");
      onSuccess?.(data);
      onClose();
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
      setIsSubmitting(false);
    },
  });

  // ── Validation ──
  const validateForm = () => {
    const newErrors = {};
    if (!formData.nom?.trim()) newErrors.nom = "Le nom est requis";
    if (!formData.code?.trim()) newErrors.code = "Le code est requis";
    if (!formData.ville) newErrors.ville = "Sélectionnez une ville";
    if (!formData.adresse?.trim()) newErrors.adresse = "L'adresse est requise";
    if (!formData.telephone?.trim()) newErrors.telephone = "Le téléphone est requis";
    if (!formData.email?.trim()) newErrors.email = "L'email est requis";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    submitMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">
            {isEdit ? "Modifier Filiale" : "Nouvelle Filiale"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Nom */}
          <div>
            <label className="text-sm font-bold text-slate-700">Nom</label>
            <input
              type="text"
              name="nom"
              value={formData.nom}
              onChange={handleChange}
              className={`w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.nom ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
              }`}
            />
            {errors.nom && <p className="text-xs text-red-600 mt-1">{errors.nom}</p>}
          </div>

          {/* Code */}
          <div>
            <label className="text-sm font-bold text-slate-700">Code</label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              className={`w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.code ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
              }`}
            />
            {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code}</p>}
          </div>

          {/* Ville */}
          <div>
            <label className="text-sm font-bold text-slate-700">Ville</label>
            <select
              name="ville"
              value={formData.ville}
              onChange={handleChange}
              className={`w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.ville ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
              }`}
            >
              <option value="">Sélectionnez une ville</option>
              {VILLES.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            {errors.ville && <p className="text-xs text-red-600 mt-1">{errors.ville}</p>}
          </div>

          {/* Adresse */}
          <div>
            <label className="text-sm font-bold text-slate-700">Adresse</label>
            <input
              type="text"
              name="adresse"
              value={formData.adresse}
              onChange={handleChange}
              className={`w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.adresse ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
              }`}
            />
            {errors.adresse && <p className="text-xs text-red-600 mt-1">{errors.adresse}</p>}
          </div>

          {/* Téléphone */}
          <div>
            <label className="text-sm font-bold text-slate-700">Téléphone</label>
            <input
              type="tel"
              name="telephone"
              value={formData.telephone}
              onChange={handleChange}
              className={`w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.telephone ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
              }`}
            />
            {errors.telephone && <p className="text-xs text-red-600 mt-1">{errors.telephone}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-bold text-slate-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                errors.email ? "border-red-300 focus:ring-red-500" : "border-slate-200 focus:ring-blue-500"
              }`}
            />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
          </div>

          {/* Statut */}
          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50">
            <input
              type="checkbox"
              name="est_active"
              checked={formData.est_active}
              onChange={handleChange}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-slate-700">Actif</span>
          </label>

        </form>

        {/* Footer */}
        <div className="flex gap-2 p-6 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 font-bold rounded-lg hover:bg-slate-300"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {isEdit ? "Modifier" : "Créer"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TrajetFormModal.jsx
// ═══════════════════════════════════════════════════════════════════════════

export function TrajetFormModal({ trajet = null, filiales = [], onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    filiale_depart: trajet?.filiale_depart?.id_filiale || "",
    filiale_arrive: trajet?.filiale_arrive?.id_filiale || "",
    distance: trajet?.distance || "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = !!trajet?.Id_trajet;

  const submitMutation = useMutation({
    mutationFn: async (payload) => {
      if (isEdit) {
        return fleetService.modifierTrajet(trajet.Id_trajet, payload);
      } else {
        return fleetService.creerTrajet(payload);
      }
    },
    onSuccess: (data) => {
      toast.success(isEdit ? "Trajet modifié !" : "Trajet créé !");
      onSuccess?.(data);
      onClose();
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message}`);
      setIsSubmitting(false);
    },
  });

  const validateForm = () => {
    const newErrors = {};
    if (!formData.filiale_depart) newErrors.filiale_depart = "Sélectionnez une filiale de départ";
    if (!formData.filiale_arrive) newErrors.filiale_arrive = "Sélectionnez une filiale d'arrivée";
    if (formData.filiale_depart === formData.filiale_arrive) {
      newErrors.filiale_arrive = "Les filiales doivent être différentes";
    }
    if (!formData.distance || isNaN(formData.distance) || formData.distance <= 0) {
      newErrors.distance = "Entrez une distance valide";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    submitMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">
            {isEdit ? "Modifier Trajet" : "Nouveau Trajet"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div>
            <label className="text-sm font-bold text-slate-700">Filiale Départ</label>
            <select
              name="filiale_depart"
              value={formData.filiale_depart}
              onChange={handleChange}
              className={`w-full mt-1 px-3 py-2 border rounded-lg ${
                errors.filiale_depart ? "border-red-300" : "border-slate-200"
              }`}
            >
              <option value="">Sélectionnez</option>
              {filiales.map(f => (
                <option key={f.id_filiale} value={f.id_filiale}>
                  {f.nom} ({f.ville})
                </option>
              ))}
            </select>
            {errors.filiale_depart && <p className="text-xs text-red-600 mt-1">{errors.filiale_depart}</p>}
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">Filiale Arrivée</label>
            <select
              name="filiale_arrive"
              value={formData.filiale_arrive}
              onChange={handleChange}
              className={`w-full mt-1 px-3 py-2 border rounded-lg ${
                errors.filiale_arrive ? "border-red-300" : "border-slate-200"
              }`}
            >
              <option value="">Sélectionnez</option>
              {filiales.map(f => (
                <option key={f.id_filiale} value={f.id_filiale}>
                  {f.nom} ({f.ville})
                </option>
              ))}
            </select>
            {errors.filiale_arrive && <p className="text-xs text-red-600 mt-1">{errors.filiale_arrive}</p>}
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">Distance (km)</label>
            <input
              type="number"
              name="distance"
              value={formData.distance}
              onChange={handleChange}
              step="0.1"
              min="0"
              className={`w-full mt-1 px-3 py-2 border rounded-lg ${
                errors.distance ? "border-red-300" : "border-slate-200"
              }`}
            />
            {errors.distance && <p className="text-xs text-red-600 mt-1">{errors.distance}</p>}
          </div>

        </form>

        <div className="flex gap-2 p-6 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 font-bold rounded-lg hover:bg-slate-300"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {isEdit ? "Modifier" : "Créer"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
