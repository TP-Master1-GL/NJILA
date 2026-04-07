package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.domain.entity.Reservation;
import com.njila.njila_booking_service.domain.enums.CanalReservation;
import com.njila.njila_booking_service.service.pricing.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PricingStrategyTest {

    private PrixStandardStrategy standard;
    private PrixGroupeStrategy   groupe;

    @Mock
    private FideliteService fideliteService;

    private PrixPromoStrategy promo;

    private Reservation reservation;

    @BeforeEach
    void setUp() {
        standard = new PrixStandardStrategy();
        groupe   = new PrixGroupeStrategy();
        promo    = new PrixPromoStrategy(fideliteService);

        reservation = Reservation.builder()
                .idVoyageur(1L)
                .codeAgence("GEN")
                .canal(CanalReservation.WEB)
                .build();
    }

    // ─── Standard ─────────────────────────────────────────────────────────────

    @Test
    void standard_1Place_retournePrixBase() {
        double result = standard.calculerPrix(reservation, 5000.0, 1);
        assertThat(result).isEqualTo(5000.0);
    }

    @Test
    void standard_3Places_retournePrixMultiplie() {
        double result = standard.calculerPrix(reservation, 5000.0, 3);
        assertThat(result).isEqualTo(15000.0);
    }

    @Test
    void standard_prixZero_retourneZero() {
        double result = standard.calculerPrix(reservation, 0.0, 5);
        assertThat(result).isEqualTo(0.0);
    }

    // ─── Groupe ───────────────────────────────────────────────────────────────

    @Test
    void groupe_4Places_sansReduction_prixUnitaireXPlaces() {
        double result = groupe.calculerPrix(reservation, 5000.0, 4);
        assertThat(result).isEqualTo(20000.0);
    }

    @Test
    void groupe_1Place_memeResultatQueStandard() {
        double resultGroupe   = groupe.calculerPrix(reservation, 5000.0, 1);
        double resultStandard = standard.calculerPrix(reservation, 5000.0, 1);
        assertThat(resultGroupe).isEqualTo(resultStandard);
    }

    // ─── Promo — Voyage gratuit ───────────────────────────────────────────────

    @Test
    void promo_voyageGratuit_retourneZero() {
        when(fideliteService.estVoyageGratuit(1L, "GEN")).thenReturn(true);
        double result = promo.calculerPrix(reservation, 5000.0, 1);
        assertThat(result).isEqualTo(0.0);
    }

    @Test
    void promo_pasVoyageGratuit_retournePrixNormal() {
        when(fideliteService.estVoyageGratuit(1L, "GEN")).thenReturn(false);
        double result = promo.calculerPrix(reservation, 5000.0, 2);
        assertThat(result).isEqualTo(10000.0);
    }

    @Test
    void promo_appelFideliteService() {
        when(fideliteService.estVoyageGratuit(1L, "GEN")).thenReturn(false);
        promo.calculerPrix(reservation, 5000.0, 1);
        verify(fideliteService).estVoyageGratuit(1L, "GEN");
    }
}