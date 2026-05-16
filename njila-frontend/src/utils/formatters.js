import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export const formatHeure = (date) =>
  format(parseISO(date), "HH:mm", { locale: fr });


/**
 * formatters.js
 * Utilitaires de formatage — protégés contre undefined/null/NaN
 */

/**
 * Formate un montant en FCFA.
 * Retourne "0 FCFA" si la valeur est undefined, null, NaN ou non-numérique.
 */
export function formatMontant(value, devise = "FCFA") {
  const n = Number(value);
  if (value === undefined || value === null || isNaN(n)) {
    return `0 ${devise}`;
  }
  return `${n.toLocaleString("fr-FR")} ${devise}`;
}

/**
 * Formate une date ISO en date lisible française.
 */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Formate une date ISO en date + heure.
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Formate un nombre compact : 1 200 000 → "1.2M", 34 000 → "34k"
 */
export function formatCompact(value = 0) {
  const n = Number(value);
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/**
 * Retourne un pourcentage formaté, protégé contre NaN.
 */
export function formatPct(value) {
  const n = Number(value);
  if (isNaN(n)) return "0%";
  return `${n.toFixed(1)}%`;
}
export const formatDuree = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
};



export const getInitiales = (nom, prenom) =>
  `${nom?.[0] || ""}${prenom?.[0] || ""}`.toUpperCase();
