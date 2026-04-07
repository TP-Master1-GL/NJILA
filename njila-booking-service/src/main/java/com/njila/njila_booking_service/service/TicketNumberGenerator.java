package com.njila.njila_booking_service.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@Slf4j
public class TicketNumberGenerator {

    // Format : GEN-WEB-20260321-BYDE-000142
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int PADDING = 6;

    // Compteur par clé : {codeAgence}-{type}-{date}-{codeFiliale}
    private final ConcurrentHashMap<String, AtomicInteger> compteurs = new ConcurrentHashMap<>();

    public String generer(String codeAgence, String type, String codeFiliale) {
        String date = LocalDate.now().format(DATE_FORMAT);
        String cle  = String.format("%s-%s-%s-%s", codeAgence, type, date, codeFiliale);

        AtomicInteger compteur = compteurs.computeIfAbsent(cle, k -> new AtomicInteger(0));
        int sequence = compteur.incrementAndGet();

        String numero = String.format("%s-%s-%s-%s-%0" + PADDING + "d",
                codeAgence.toUpperCase(),
                type.toUpperCase(),
                date,
                codeFiliale.toUpperCase(),
                sequence);

        log.info("[TICKET] Numéro généré : {}", numero);
        return numero;
    }

    // Type WEB — billet électronique (réservation en ligne)
    public String genererBilletElectronique(String codeAgence, String codeFiliale) {
        return generer(codeAgence, "WEB", codeFiliale);
    }

    // Type EMB — billet d'embarquement (guichet ou conversion)
    public String genererBilletEmbarquement(String codeAgence, String codeFiliale) {
        return generer(codeAgence, "EMB", codeFiliale);
    }
}