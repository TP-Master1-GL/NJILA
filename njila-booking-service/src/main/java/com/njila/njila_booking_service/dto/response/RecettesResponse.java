package com.njila.njila_booking_service.dto.response;

import lombok.*;

/**
 * DTO de réponse pour les recettes (agence ou filiale).
 *
 * <p>Ventilation :
 * <ul>
 *   <li>{@code recetteTotale}     — somme de toutes les réservations payées (WEB + GUICHET)</li>
 *   <li>{@code recetteEnLigne}    — montant des réservations WEB (paiement mobile money)</li>
 *   <li>{@code recetteGuichet}    — montant des réservations GUICHET (espèces en agence)</li>
 *   <li>{@code nbReservationsEnLigne}  — nombre de réservations WEB payées</li>
 *   <li>{@code nbReservationsGuichet} — nombre de réservations GUICHET payées</li>
 *   <li>{@code partEnLignePct}    — part en ligne en % (arrondi à 1 décimale)</li>
 *   <li>{@code partGuichetPct}    — part guichet en % (arrondi à 1 décimale)</li>
 *   <li>{@code devise}            — devise utilisée (ex : "XAF")</li>
 * </ul>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecettesResponse {

    /** Code de l'entité (codeAgence ou codeFiliale) */
    private String code;

    /** Type d'entité : "AGENCE" ou "FILIALE" */
    private String typeEntite;

    /** Recette totale (WEB + GUICHET), statuts PAYEE / CONFIRMEE / EMBARQUEE */
    private double recetteTotale;

    /** Recette canal WEB (paiement mobile money : MTN / Orange) */
    private double recetteEnLigne;

    /** Recette canal GUICHET (espèces perçues localement) */
    private double recetteGuichet;

    /** Nombre de réservations WEB payées */
    private long nbReservationsEnLigne;

    /** Nombre de réservations GUICHET payées */
    private long nbReservationsGuichet;

    /** Part de la recette en ligne sur le total (%) */
    private double partEnLignePct;

    /** Part de la recette guichet sur le total (%) */
    private double partGuichetPct;

    /** Devise des montants (ex : "XAF") */
    @Builder.Default
    private String devise = "XAF";
}
