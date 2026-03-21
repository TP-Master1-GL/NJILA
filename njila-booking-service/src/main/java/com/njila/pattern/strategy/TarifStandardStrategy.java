package com.njila.pattern.strategy;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
 
/**
 * STRATÉGIE STANDARD — Calcul de base sans réduction ni majoration.
 *
 * Formule : prixTotal = prixBase × nombrePlaces
 * Priorité 3 (fallback par défaut dans TarificationService).
 */
@Component
@Slf4j
public class TarifStandardStrategy implements TarifStrategy {
 
    @Override
    public double calculerPrix(double prixBase, int nombrePlaces) {
        double prix = prixBase * nombrePlaces;
        log.debug("[STRATEGY-STANDARD] prixBase={} × places={} = {}", prixBase, nombrePlaces, prix);
        return prix;
    }
 
    @Override
    public String getNom() {
        return "STANDARD";
    }
}