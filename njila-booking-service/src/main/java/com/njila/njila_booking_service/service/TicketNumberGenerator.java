package com.njila.njila_booking_service.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Slf4j
public class TicketNumberGenerator {

    @PersistenceContext
    private EntityManager entityManager;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int PADDING = 6;

    /**
     * Génère un numéro de ticket unique avec séquence stockée en base
     */
    @Transactional
    public String generer(String codeAgence, String type, String codeFiliale) {
        String date = LocalDate.now().format(DATE_FORMAT);
        String sequenceKey = String.format("%s_%s_%s_%s", codeAgence, type, date, codeFiliale);
        
        // Obtenir le prochain numéro de séquence depuis la base
        int sequence = getNextSequence(sequenceKey);
        
        String numero = String.format("%s-%s-%s-%s-%0" + PADDING + "d",
                codeAgence.toUpperCase(),
                type.toUpperCase(),
                date,
                codeFiliale.toUpperCase(),
                sequence);

        log.info("[TICKET] Numéro généré : {}", numero);
        return numero;
    }

    /**
     * Récupère et incrémente le compteur de séquence en base de données
     */
    private int getNextSequence(String key) {
        // Créer une table de séquence si elle n'existe pas
        createSequenceTableIfNotExists();
        
        // Récupérer et incrémenter la séquence
        Query selectQuery = entityManager.createNativeQuery(
            "SELECT sequence_value FROM ticket_sequence WHERE sequence_key = :key"
        );
        selectQuery.setParameter("key", key);
        
        Integer currentValue;
        try {
            currentValue = (Integer) selectQuery.getSingleResult();
        } catch (Exception e) {
            currentValue = null;
        }
        
        int nextValue;
        if (currentValue == null) {
            nextValue = 1;
            Query insertQuery = entityManager.createNativeQuery(
                "INSERT INTO ticket_sequence (sequence_key, sequence_value) VALUES (:key, :value)"
            );
            insertQuery.setParameter("key", key);
            insertQuery.setParameter("value", nextValue);
            insertQuery.executeUpdate();
        } else {
            nextValue = currentValue + 1;
            Query updateQuery = entityManager.createNativeQuery(
                "UPDATE ticket_sequence SET sequence_value = :value WHERE sequence_key = :key"
            );
            updateQuery.setParameter("value", nextValue);
            updateQuery.setParameter("key", key);
            updateQuery.executeUpdate();
        }
        
        return nextValue;
    }

    /**
     * Crée la table de séquence si elle n'existe pas
     */
    private void createSequenceTableIfNotExists() {
        try {
            Query createTableQuery = entityManager.createNativeQuery(
                "CREATE TABLE IF NOT EXISTS ticket_sequence (" +
                "    sequence_key VARCHAR(255) PRIMARY KEY," +
                "    sequence_value INTEGER NOT NULL DEFAULT 1," +
                "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")"
            );
            createTableQuery.executeUpdate();
        } catch (Exception e) {
            log.warn("Table ticket_sequence existe déjà ou erreur: {}", e.getMessage());
        }
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
