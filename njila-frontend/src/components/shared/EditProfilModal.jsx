import { useState, useEffect } from "react";
import { X, Check, User, Phone, MapPin, Loader2, Mail } from "lucide-react";
import PhotoUploader from "./PhotoUploader";

/**
 * Modal pour éditer le profil de l'utilisateur connecté
 * 
 * @param {boolean}  isOpen              - Afficher/cacher le modal
 * @param {function} onClose              - Callback pour fermer
 * @param {object}   profil              - Données du profil actuelles
 * @param {function} onSave               - Callback (form) → mise à jour profil
 * @param {boolean}  isSaving            - État de chargement
 * @param {function} onPhotoUploaded     - Callback (urlCloudinary) → update photo
 */
export default function EditProfilModal({
  isOpen,
  onClose,
  profil,
  onSave,
  isSaving,
  onPhotoUploaded,
}) {
  // Form state
  const [form, setForm] = useState({
    name: "",
    surname: "",
    phone: "",
    adresse: "",
    email: "",
  });

  const [errors, setErrors] = useState({});

  // Sync profil vers form
  useEffect(() => {
    if (profil) {
      setForm({
        name: profil.name || "",
        surname: profil.surname || "",
        phone: profil.phone || "",
        adresse: profil.adresse || "",
        email: profil.email || "",
      });
      setErrors({});
    }
  }, [profil, isOpen]);

  if (!isOpen) return null;

  // ── Validation ──────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors = {};

    if (!form.name?.trim()) {
      newErrors.name = "Le nom est requis";
    }
    if (!form.surname?.trim()) {
      newErrors.surname = "Le prénom est requis";
    }
    if (form.email && !form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = "Email invalide";
    }
    if (form.phone && !form.phone.match(/^[\d\s\-\+()]+$/)) {
      newErrors.phone = "Téléphone invalide";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Payload uniquement les champs modifiés
    const payload = {
      name: form.name?.trim(),
      surname: form.surname?.trim(),
      ...(form.email && { email: form.email?.trim() }),
      ...(form.phone && { phone: form.phone?.trim() }),
      ...(form.adresse && { adresse: form.adresse?.trim() }),
    };

    onSave(payload);
  };

  // ── Initiales pour avatar ───────────────────────────────────────────
  const initiales = `${form.name?.[0] || ""}${form.surname?.[0] || ""}`.toUpperCase() || "?";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal container */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-extrabold text-slate-900 text-lg">Modifier mon profil</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Photo uploader */}
        <div className="flex justify-center pt-6 pb-2">
          <PhotoUploader
            currentUrl={profil?.photoProfil || profil?.photo_url}
            initiales={initiales}
            onUploaded={onPhotoUploaded}
            folder="profiles"
            size="w-24 h-24"
            shape="rounded-2xl"
            bgColor="bg-gradient-to-br from-[#135bec] to-blue-700"
          />
        </div>
        <p className="text-center text-xs text-slate-400 mb-4">
          Cliquez sur l'appareil photo pour changer votre photo
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Nom
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Dupont"
                className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none transition-colors ${
                  errors.name
                    ? "border-red-300 focus:border-red-500"
                    : "border-slate-200 focus:border-[#135bec]"
                }`}
              />
            </div>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Surname */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Prénom
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={form.surname}
                onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))}
                placeholder="Jean"
                className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none transition-colors ${
                  errors.surname
                    ? "border-red-300 focus:border-red-500"
                    : "border-slate-200 focus:border-[#135bec]"
                }`}
              />
            </div>
            {errors.surname && <p className="text-xs text-red-500 mt-1">{errors.surname}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jean@example.com"
                className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none transition-colors ${
                  errors.email
                    ? "border-red-300 focus:border-red-500"
                    : "border-slate-200 focus:border-[#135bec]"
                }`}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Téléphone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+237 6XX XXX XXX"
                className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none transition-colors ${
                  errors.phone
                    ? "border-red-300 focus:border-red-500"
                    : "border-slate-200 focus:border-[#135bec]"
                }`}
              />
            </div>
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Adresse
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={form.adresse}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                placeholder="Akwa, Douala"
                className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#135bec] transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 border-2 border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#135bec] text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
