package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.domain.entity.TicketElectronique;
import com.njila.njila_booking_service.domain.enums.StatutTicket;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;
import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.*;

class PdfGeneratorServiceTest {

    private PdfGeneratorService pdfGeneratorService;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        pdfGeneratorService = new PdfGeneratorService();
        ReflectionTestUtils.setField(
                pdfGeneratorService,
                "repertoireBillets",
                tempDir.toString()
        );
    }

    private TicketElectronique buildTicket() {
        TicketElectronique ticket = new TicketElectronique();
        ticket.setNumeroTicket("GEN-WEB-20260321-BYDE-000001");
        ticket.setNomVoyageur("NGUEMBU John");
        ticket.setTelephoneVoyageur("+237699000001");
        ticket.setOrigine("Yaoundé");
        ticket.setDestination("Douala");
        ticket.setDateDepart(LocalDate.of(2026, 4, 1));
        ticket.setImmatriculationBus("LT-1234-A");
        ticket.setStatut(StatutTicket.ACTIF);
        ticket.setUtilise(false);
        ticket.setConverti(false);
        return ticket;
    }

    @Test
    void genererBilletElectronique_retourneByteArrayNonVide() {
        byte[] pdf = pdfGeneratorService.genererBilletElectronique(buildTicket());
        assertThat(pdf).isNotNull();
        assertThat(pdf.length).isGreaterThan(0);
    }

    @Test
    void genererBilletElectronique_estUnVraiPdf() {
        byte[] pdf = pdfGeneratorService.genererBilletElectronique(buildTicket());
        // PDF commence toujours par %PDF
        String header = new String(pdf, 0, 4);
        assertThat(header).isEqualTo("%PDF");
    }

    @Test
    void genererBilletElectronique_creeLefichiersurDisque() {
        pdfGeneratorService.genererBilletElectronique(buildTicket());
        Path fichier = tempDir.resolve(
                "GEN-WEB-20260321-BYDE-000001.pdf");
        assertThat(fichier).exists();
        assertThat(fichier).isNotEmptyFile();
    }

    @Test
    void lirePdf_fichierExistant_retourneContenu() throws IOException {
        pdfGeneratorService.genererBilletElectronique(buildTicket());
        byte[] lu = pdfGeneratorService.lirePdf(
                "GEN-WEB-20260321-BYDE-000001");
        assertThat(lu).isNotNull();
        assertThat(lu.length).isGreaterThan(0);
    }

    @Test
    void lirePdf_fichierInexistant_leveException() {
        assertThatThrownBy(() ->
                pdfGeneratorService.lirePdf("TICKET-INEXISTANT"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("introuvable");
    }

    @Test
    void getCheminComplet_formatCorrect() {
        String chemin = pdfGeneratorService
                .getCheminComplet("GEN-WEB-20260321-BYDE-000001");
        assertThat(chemin).endsWith(
                "GEN-WEB-20260321-BYDE-000001.pdf");
    }
}