import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export const formatDate = (date) =>
  format(parseISO(date), "dd MMM yyyy", { locale: fr });

export const formatDateTime = (date) =>
  format(parseISO(date), "dd MMM yyyy à HH:mm", { locale: fr });

export const formatHeure = (date) =>
  format(parseISO(date), "HH:mm", { locale: fr });

export const formatMontant = (montant) =>
  new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
  }).format(montant);

export const formatDuree = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
};

export const getInitiales = (nom, prenom) =>
  `${nom?.[0] || ""}${prenom?.[0] || ""}`.toUpperCase();
