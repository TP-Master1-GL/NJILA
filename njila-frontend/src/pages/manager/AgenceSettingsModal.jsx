/**
 * AgenceSettingsModal.jsx
 *
 * Permet de modifier :
 * - Nom, adresse, téléphone, email
 * - Logo (via Cloudinary → logo_url envoyé au backend)
 * - Statut global
 *
 * Endpoints :
 *   - agenceService.modifierAgence(agenceId, payload)
 *   - uploadToCloudinary(file, folder)  [géré dans PhotoUploader]
 *
 * Correction : logo envoyé comme `logo_url` (URLField) et non `logo_image` (ImageField)
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  X, Loader2, AlertCircle, CheckCircle,
  Building2, MapPin, Phone, Mail, Image as ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { agenceService } from "../../services/agenceService";
import PhotoUploader from "../../components/shared/PhotoUploader";

export default function AgenceSettingsModal({ agenceId, agence, onClose }) {

  // ── État du formulaire ──────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name:            agence?.name            || "",
    adresse:         agence?.adresse         || "",
    telephone:       agence?.telephone       || "",
    email_officiel:  agence?.email_officiel  || "",
    statut_global:   agence?.statut_global   || "active",
    // ✅ Priorité : logo_url (Cloudinary) puis logo_image (fichier local)
    logo_url: agence?.logo_url || agence?.logo_image || null,
  });

  const [errors,      setErrors]      = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Mutation modification agence ───────────────────────────────────────────
  const modifyMutation = useMutation({
    mutationFn: (payload) => agenceService.modifierAgence(agenceId, payload),
    onSuccess: () => {
      toast.success("Agence mise à jour avec succès !");
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error) => {
      toast.error(`Erreur : ${error.message || "Modification échouée"}`);
      setIsSubmitting(false);
    },
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name?.trim())
      newErrors.name = "Le nom est requis";

    if (!formData.email_officiel?.trim())
      newErrors.email_officiel = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_officiel))
      newErrors.email_officiel = "Email invalide";

    if (!formData.telephone?.trim())
      newErrors.telephone = "Le téléphone est requis";

    if (!formData.adresse?.trim())
      newErrors.adresse = "L'adresse est requise";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Handler changement input ───────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  };

  // ── Handler logo uploadé par Cloudinary ───────────────────────────────────
  const handleLogoUploaded = (cloudinaryUrl) => {
    // ✅ On stocke l'URL Cloudinary dans logo_url (string), pas dans logo_image (fichier)
    setFormData(prev => ({ ...prev, logo_url: cloudinaryUrl }));
    toast.success("Logo téléchargé !");
  };

  // ── Handler submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    // ✅ On envoie logo_url (URLField Django) et NON logo_image (ImageField Django)
    // logo_image n'accepte que des fichiers binaires multipart, pas des strings URL
    const payload = {
      name:           formData.name,
      adresse:        formData.adresse,
      telephone:      formData.telephone,
      email_officiel: formData.email_officiel,
      statut_global:  formData.statut_global,
      ...(formData.logo_url && { logo_url: formData.logo_url }),
    };

    modifyMutation.mutate(payload);
  };

  // ── Initiales pour avatar de fallback ─────────────────────────────────────
  const initiales = formData.name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
          <h2 className="text-2xl font-bold text-slate-900">Paramètres Agence</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        {/* Contenu */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Section Logo */}
          <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-2xl p-6 border border-blue-100">
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Logo de l'Agence
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Téléchargez le logo de votre agence. Format : JPG, PNG, WebP (max 5 MB)
                </p>
                {/* Aperçu de l'URL si logo déjà uploadé */}
                {formData.logo_url && (
                  <p className="text-xs text-green-600 truncate max-w-xs">
                    ✓ Logo enregistré
                  </p>
                )}
              </div>

              {/* PhotoUploader appelle handleLogoUploaded(url) après upload Cloudinary */}
              <PhotoUploader
                currentUrl={formData.logo_url}
                initiales={initiales}
                onUploaded={handleLogoUploaded}
                folder="agences"
                shape="rounded-xl"
                size="w-24 h-24"
                bgColor="bg-gradient-to-br from-[#135bec] to-blue-700"
              />
            </div>
          </div>

          {/* Section Informations Générales */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Informations Générales
            </h3>

            {/* Nom */}
            <div>
              <label className="text-sm font-bold text-slate-700">
                Nom de l'agence
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full mt-1 px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  errors.name
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-200 focus:ring-blue-500"
                }`}
                placeholder="Ex: NJILA Express"
              />
              {errors.name && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Officiel
              </label>
              <input
                type="email"
                name="email_officiel"
                value={formData.email_officiel}
                onChange={handleChange}
                className={`w-full mt-1 px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  errors.email_officiel
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-200 focus:ring-blue-500"
                }`}
                placeholder="contact@agence.cm"
              />
              {errors.email_officiel && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email_officiel}
                </p>
              )}
            </div>

            {/* Téléphone */}
            <div>
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Téléphone
              </label>
              <input
                type="tel"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                className={`w-full mt-1 px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  errors.telephone
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-200 focus:ring-blue-500"
                }`}
                placeholder="+237 6XX XXX XXX"
              />
              {errors.telephone && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.telephone}
                </p>
              )}
            </div>

            {/* Adresse */}
            <div>
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Adresse
              </label>
              <textarea
                name="adresse"
                value={formData.adresse}
                onChange={handleChange}
                rows="3"
                className={`w-full mt-1 px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  errors.adresse
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-200 focus:ring-blue-500"
                }`}
                placeholder="Adresse complète du siège social"
              />
              {errors.adresse && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.adresse}
                </p>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2 bg-slate-200 text-slate-900 font-bold rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
