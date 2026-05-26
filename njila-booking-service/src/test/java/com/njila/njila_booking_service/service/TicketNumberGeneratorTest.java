package com.njila.njila_booking_service.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TicketNumberGeneratorTest {

    @Mock
    private EntityManager entityManager;

    @Mock
    private Query createTableQuery;

    @Mock
    private Query selectQuery;

    @Mock
    private Query insertQuery;

    @Mock
    private Query updateQuery;

    @InjectMocks
    private TicketNumberGenerator generator;

    private String today;

    @BeforeEach
    void setUp() {
        today = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));

        // CREATE TABLE IF NOT EXISTS → toujours OK, pas de résultat utile
        when(entityManager.createNativeQuery(contains("CREATE TABLE IF NOT EXISTS")))
                .thenReturn(createTableQuery);
        when(createTableQuery.executeUpdate()).thenReturn(0);
    }

    // ─── Helpers pour simuler premier appel (INSERT) ──────────────────────────

    /**
     * Simule : aucune séquence existante → INSERT avec valeur 1.
     */
    private void stubPremierAppel(String keyContains) {
        when(entityManager.createNativeQuery(contains("SELECT sequence_value")))
                .thenReturn(selectQuery);
        when(selectQuery.setParameter(eq("key"), anyString())).thenReturn(selectQuery);
        // getSingleResult lève une exception → currentValue = null → INSERT
        when(selectQuery.getSingleResult())
                .thenThrow(new jakarta.persistence.NoResultException("no result"));

        when(entityManager.createNativeQuery(contains("INSERT INTO ticket_sequence")))
                .thenReturn(insertQuery);
        when(insertQuery.setParameter(anyString(), any())).thenReturn(insertQuery);
        when(insertQuery.executeUpdate()).thenReturn(1);
    }

    /**
     * Simule : séquence existante avec valeur {@code currentVal} → UPDATE.
     */
    private void stubNiemeAppel(int currentVal) {
        when(entityManager.createNativeQuery(contains("SELECT sequence_value")))
                .thenReturn(selectQuery);
        when(selectQuery.setParameter(eq("key"), anyString())).thenReturn(selectQuery);
        when(selectQuery.getSingleResult()).thenReturn(currentVal);

        when(entityManager.createNativeQuery(contains("UPDATE ticket_sequence")))
                .thenReturn(updateQuery);
        when(updateQuery.setParameter(anyString(), any())).thenReturn(updateQuery);
        when(updateQuery.executeUpdate()).thenReturn(1);
    }

    // ─── Format général ───────────────────────────────────────────────────────

    @Test
    void genererBilletElectronique_formatCorrect() {
        stubPremierAppel("GEN_WEB");

        String numero = generator.genererBilletElectronique("GEN", "BYDE");

        assertThat(numero).matches("GEN-WEB-\\d{8}-BYDE-\\d{6}");
    }

    @Test
    void genererBilletEmbarquement_formatCorrect() {
        stubPremierAppel("GEN_EMB");

        String numero = generator.genererBilletEmbarquement("GEN", "BYDE");

        assertThat(numero).matches("GEN-EMB-\\d{8}-BYDE-\\d{6}");
    }

    @Test
    void generer_contientDateDuJour() {
        stubPremierAppel("BNM_WEB");

        String numero = generator.genererBilletElectronique("BNM", "DKLA");

        assertThat(numero).contains(today);
    }

    // ─── Séquence au premier appel = 000001 ───────────────────────────────────

    @Test
    void generer_premierAppel_sequenceA000001() {
        stubPremierAppel("GEN_WEB");

        String numero = generator.genererBilletElectronique("GEN", "BYDE");

        String sequence = numero.split("-")[4];
        assertThat(sequence).isEqualTo("000001");
    }

    @Test
    void generer_sequencePaddeeSur6Chiffres() {
        stubPremierAppel("TXP_WEB");

        String numero = generator.genererBilletElectronique("TXP", "NGDE");

        String sequence = numero.split("-")[4];
        assertThat(sequence).hasSize(6);
        assertThat(sequence).isEqualTo("000001");
    }

    // ─── Séquence incrémentée au second appel ────────────────────────────────

    @Test
    void generer_secondAppel_sequenceA000002() {
        stubNiemeAppel(1); // DB contient déjà 1 → retourne 2

        String numero = generator.genererBilletElectronique("GEN", "BYDE");

        String sequence = numero.split("-")[4];
        assertThat(sequence).isEqualTo("000002");
    }

    @Test
    void generer_dixiemeAppel_sequenceA000010() {
        stubNiemeAppel(9); // DB contient 9 → retourne 10

        String numero = generator.genererBilletElectronique("GEN", "BYDE");

        String sequence = numero.split("-")[4];
        assertThat(sequence).isEqualTo("000010");
    }

    // ─── Code agence en majuscules ───────────────────────────────────────────

    @Test
    void generer_codeAgenceEnMajuscules() {
        stubPremierAppel("GEN_WEB");

        String numero = generator.genererBilletElectronique("gen", "byde");

        assertThat(numero).startsWith("GEN-WEB");
        assertThat(numero).contains("BYDE");
    }

    // ─── Type WEB vs EMB ─────────────────────────────────────────────────────

    @Test
    void genererBilletElectronique_contientWEB() {
        stubPremierAppel("GEN_WEB");

        String numero = generator.genererBilletElectronique("GEN", "BYDE");

        assertThat(numero).contains("-WEB-");
    }

    @Test
    void genererBilletEmbarquement_contientEMB() {
        stubPremierAppel("GEN_EMB");

        String numero = generator.genererBilletEmbarquement("GEN", "BYDE");

        assertThat(numero).contains("-EMB-");
    }

    // ─── Vérification des appels SQL ─────────────────────────────────────────

    @Test
    void generer_premierAppel_executeInsert() {
        stubPremierAppel("GEN_WEB");

        generator.genererBilletElectronique("GEN", "BYDE");

        verify(insertQuery).executeUpdate();
        verify(updateQuery, never()).executeUpdate();
    }

    @Test
    void generer_secondAppel_executeUpdate() {
        stubNiemeAppel(1);

        generator.genererBilletElectronique("GEN", "BYDE");

        verify(updateQuery).executeUpdate();
        verify(insertQuery, never()).executeUpdate();
    }

    @Test
    void generer_createTableAppeleeAvantSelectQuery() {
        stubPremierAppel("GEN_WEB");

        generator.genererBilletElectronique("GEN", "BYDE");

        InOrder inOrder = inOrder(createTableQuery, selectQuery);
        inOrder.verify(createTableQuery).executeUpdate();
        inOrder.verify(selectQuery).getSingleResult();
    }
}