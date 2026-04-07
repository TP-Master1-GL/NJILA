package com.njila.njila_booking_service.service;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.njila.njila_booking_service.domain.entity.TicketElectronique;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
@Slf4j
public class PdfGeneratorService {

    @Value("${njila.booking.billets.repertoire:/tmp/njila/billets}")
    private String repertoireBillets;

    public byte[] genererBilletElectronique(TicketElectronique ticket) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            PdfWriter   writer   = new PdfWriter(baos);
            PdfDocument pdf      = new PdfDocument(writer);
            Document    document = new Document(pdf);

            // ─── En-tête ──────────────────────────────────────────────────────
            document.add(new Paragraph("NJILA")
                    .setFontSize(28).setBold()
                    .setFontColor(ColorConstants.BLUE)
                    .setTextAlignment(TextAlignment.CENTER));

            document.add(new Paragraph("BILLET ÉLECTRONIQUE")
                    .setFontSize(16).setBold()
                    .setTextAlignment(TextAlignment.CENTER));

            document.add(new Paragraph(" "));

            // ─── Numéro unique ────────────────────────────────────────────────
            document.add(new Paragraph("N° : " + ticket.getNumeroTicket())
                    .setFontSize(14).setBold()
                    .setBackgroundColor(ColorConstants.LIGHT_GRAY)
                    .setTextAlignment(TextAlignment.CENTER));

            document.add(new Paragraph(" "));

            // ─── Tableau détails ──────────────────────────────────────────────
            Table table = new Table(2).useAllAvailableWidth();

            ajouterLigne(table, "Voyageur",    ticket.getNomVoyageur());
            ajouterLigne(table, "Téléphone",   ticket.getTelephoneVoyageur());
            ajouterLigne(table, "Origine",     ticket.getOrigine());
            ajouterLigne(table, "Destination", ticket.getDestination());
            ajouterLigne(table, "Date départ", ticket.getDateDepart().toString());
            ajouterLigne(table, "Bus",         ticket.getImmatriculationBus());
            ajouterLigne(table, "Statut",      ticket.getStatut().name());

            document.add(table);

            document.add(new Paragraph(" "));
            document.add(new Paragraph(
                    "Présentez ce billet avec votre CNI au guichetier avant le départ.")
                    .setFontSize(10).setItalic()
                    .setTextAlignment(TextAlignment.CENTER));

            document.add(new Paragraph("Confidentiel — NJILA © 2026")
                    .setFontSize(8)
                    .setFontColor(ColorConstants.GRAY)
                    .setTextAlignment(TextAlignment.CENTER));

            document.close();

            byte[] pdfBytes = baos.toByteArray();

            // Sauvegarder sur disque
            sauvegarderSurDisque(ticket.getNumeroTicket(), pdfBytes);

            log.info("[PDF] Billet généré et sauvegardé : {}",
                    ticket.getNumeroTicket());
            return pdfBytes;

        } catch (Exception e) {
            log.error("[PDF] Erreur génération billet : {}", e.getMessage());
            throw new RuntimeException(
                    "Erreur génération PDF : " + e.getMessage(), e);
        }
    }

    public byte[] lirePdf(String numeroTicket) throws IOException {
        Path chemin = Paths.get(repertoireBillets, numeroTicket + ".pdf");
        if (!Files.exists(chemin)) {
            throw new RuntimeException(
                    "Billet PDF introuvable : " + numeroTicket);
        }
        return Files.readAllBytes(chemin);
    }

    public String getCheminComplet(String numeroTicket) {
        return Paths.get(repertoireBillets, numeroTicket + ".pdf").toString();
    }

    private void sauvegarderSurDisque(String numeroTicket, byte[] pdfBytes)
            throws IOException {
        Path repertoire = Paths.get(repertoireBillets);
        if (!Files.exists(repertoire)) {
            Files.createDirectories(repertoire);
            log.info("[PDF] Répertoire créé : {}", repertoire);
        }
        Path fichier = repertoire.resolve(numeroTicket + ".pdf");
        Files.write(fichier, pdfBytes);
        log.info("[PDF] Fichier sauvegardé : {}", fichier);
    }

    private void ajouterLigne(Table table, String label, String valeur) {
        table.addCell(new Cell().add(new Paragraph(label).setBold()));
        table.addCell(new Cell().add(
                new Paragraph(valeur != null ? valeur : "-")));
    }
}