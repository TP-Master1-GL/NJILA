package com.njila.pattern.strategy;

public interface TarifStrategy {
    /**
     * Calcule le tarif final en appliquant une stratégie de réduction ou de majoration.
     * @param prixBase Prix de base du voyage
     * @return Tarif calculé
     */
    double calculerTarif(double prixBase);

    /**
     * Retourne le nom de la stratégie (pour logs et audit).
     */
    String getNomStrategie();
}
