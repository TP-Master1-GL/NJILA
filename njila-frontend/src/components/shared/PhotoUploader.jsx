import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { uploadToCloudinary } from "../../services/cloudinaryService";
import toast from "react-hot-toast";

/**
 * Composant réutilisable pour uploader une photo vers Cloudinary.
 * 
 * Workflow :
 * 1. Utilisateur sélectionne une image locale
 * 2. Aperçu immédiat
 * 3. Upload vers Cloudinary (blob → secure_url)
 * 4. Appelle onUploaded(cloudinaryUrl) sans refetch supplémentaire
 * 
 * @param {string}   currentUrl   - URL actuelle de l'image (de Cloudinary ou DB)
 * @param {string}   initiales    - Texte fallback si pas de photo (ex: "JD")
 * @param {function} onUploaded   - Callback quand Cloudinary retourne l'URL
 * @param {string}   folder       - Dossier Cloudinary ("profiles" | "logos")
 * @param {string}   shape        - Classes Tailwind de forme (ex: "rounded-2xl" | "rounded-full")
 * @param {string}   size         - Classes Tailwind de taille (ex: "w-20 h-20")
 * @param {string}   bgColor      - Classe Tailwind de couleur de fond (ex: "bg-[#135bec]")
 */
export default function PhotoUploader({
  currentUrl = null,
  initiales = "?",
  onUploaded = () => {},
  folder = "profiles",
  shape = "rounded-2xl",
  size = "w-20 h-20",
  bgColor = "bg-gradient-to-br from-[#135bec] to-blue-700",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset erreur
    setError(null);

    // ── Validation locale ──────────────────────────────────────────────
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      const msg = `Image trop lourde (${sizeMB} MB, max 5 MB)`;
      setError(msg);
      toast.error(msg);
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      const msg = `Format non supporté: ${file.type}. Acceptés: JPG, PNG, WebP`;
      setError(msg);
      toast.error(msg);
      return;
    }

    // ── Aperçu immédiat ───────────────────────────────────────────────
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      // Upload vers Cloudinary → retourne secure_url
      const cloudUrl = await uploadToCloudinary(file, folder);
      
      // Callback avec l'URL Cloudinary
      onUploaded(cloudUrl);
      
      toast.success("Photo mise à jour avec succès !");
      
      // Garder le preview un peu avant de le nettoyer
      setTimeout(() => {
        setPreview(null);
        URL.revokeObjectURL(localUrl);
      }, 500);
    } catch (err) {
      const errorMsg = err.message || "Échec de l'upload";
      setError(errorMsg);
      toast.error(`Erreur : ${errorMsg}`);
      setPreview(null);
      URL.revokeObjectURL(localUrl);
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = preview || currentUrl;

  return (
    <div className="relative flex-shrink-0">
      {/* Image ou initiales */}
      <div
        className={`${size} ${shape} ${bgColor} flex items-center justify-center overflow-hidden shadow-lg transition-all duration-200`}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Photo"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-white text-2xl font-extrabold select-none">
            {initiales}
          </span>
        )}

        {/* Overlay chargement */}
        {uploading && (
          <div className={`absolute inset-0 ${shape} bg-black/60 flex items-center justify-center backdrop-blur-sm`}>
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Bouton appareil photo */}
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        className={`absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-50 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          uploading ? "cursor-not-allowed" : "cursor-pointer hover:scale-110"
        }`}
        title={uploading ? "Upload en cours..." : "Cliquez pour changer la photo"}
      >
        <Camera className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {/* Message d'erreur */}
      {error && (
        <div className="absolute -bottom-12 left-0 right-0 px-2 py-1 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 whitespace-nowrap overflow-hidden text-ellipsis">
          {error}
        </div>
      )}

      {/* Input file (caché) */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
        aria-label="Télécharger une photo"
      />
    </div>
  );
}
