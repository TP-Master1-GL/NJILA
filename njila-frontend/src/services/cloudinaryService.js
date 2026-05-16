const CLOUD_NAME = "dfddyrnoq";
const API_KEY    = "528247422191155";
const UPLOAD_PRESET = "njila_unsigned"; // à créer dans Cloudinary dashboard (unsigned preset)

/**
 * Upload une image vers Cloudinary et retourne l'URL sécurisée.
 * @param {File} file - Fichier image
 * @param {string} folder - Dossier Cloudinary ("profiles" | "logos")
 * @returns {Promise<string>} URL de l'image uploadée
 */
export async function uploadToCloudinary(file, folder = "profiles") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", `njila/${folder}`);
  formData.append("api_key", API_KEY);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Échec de l'upload Cloudinary");
  }

  const data = await res.json();
  return data.secure_url;
}
