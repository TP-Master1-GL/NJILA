package com.njila.njila_booking_service.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import static org.assertj.core.api.Assertions.*;

class TicketNumberGeneratorTest {

    private TicketNumberGenerator generator;
    private String today;

    @BeforeEach
    void setUp() {
        generator = new TicketNumberGenerator();
        today = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
    }

    @Test
    void genererBilletElectronique_formatCorrect() {
        String numero = generator.genererBilletElectronique("GEN", "BYDE");
        assertThat(numero).matches("GEN-WEB-\\d{8}-BYDE-\\d{6}");
    }

    @Test
    void genererBilletEmbarquement_formatCorrect() {
        String numero = generator.genererBilletEmbarquement("GEN", "BYDE");
        assertThat(numero).matches("GEN-EMB-\\d{8}-BYDE-\\d{6}");
    }

    @Test
    void generer_contientDateDuJour() {
        String numero = generator.genererBilletElectronique("BNM", "DKLA");
        assertThat(numero).contains(today);
    }

    @Test
    void generer_sequenceIncrementee() {
        String numero1 = generator.genererBilletElectronique("GEN", "BYDE");
        String numero2 = generator.genererBilletElectronique("GEN", "BYDE");
        assertThat(numero1).isNotEqualTo(numero2);

        int seq1 = Integer.parseInt(numero1.split("-")[4]);
        int seq2 = Integer.parseInt(numero2.split("-")[4]);
        assertThat(seq2).isEqualTo(seq1 + 1);
    }

    @Test
    void generer_sequencesIndependantesParAgence() {
        String gen1 = generator.genererBilletElectronique("GEN", "BYDE");
        String bnm1 = generator.genererBilletElectronique("BNM", "DKLA");

        int seqGen = Integer.parseInt(gen1.split("-")[4]);
        int seqBnm = Integer.parseInt(bnm1.split("-")[4]);

        // Chaque agence a son propre compteur
        assertThat(seqGen).isEqualTo(1);
        assertThat(seqBnm).isEqualTo(1);
    }

    @Test
    void generer_codeAgenceEnMajuscules() {
        String numero = generator.genererBilletElectronique("gen", "byde");
        assertThat(numero).startsWith("GEN-WEB");
        assertThat(numero).contains("BYDE");
    }

    @Test
    void generer_sequencePaddeeSur6Chiffres() {
        String numero = generator.genererBilletElectronique("TXP", "NGDE");
        String sequence = numero.split("-")[4];
        assertThat(sequence).hasSize(6);
        assertThat(sequence).isEqualTo("000001");
    }
}