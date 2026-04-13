package com.njila.njila_booking_service.service;

import com.njila.njila_booking_service.domain.entity.CompteurFidelite;
import com.njila.njila_booking_service.repository.CompteurFideliteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.Duration;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class FideliteService {

    private final CompteurFideliteRepository compteurRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final RabbitTemplate rabbitTemplate;

    // Seuil pour obtenir un voyage gratuit
    private static final int    SEUIL_VOYAGE_GRATUIT = 10;

    // Convention NJILA : njila:booking:fidelite:{idVoyageur}:{codeAgence}:{annee}
    private static final String KEY_TEMPLATE =
            "njila:booking:fidelite:%d:%s:%d";

    // ─── Incrémenter après chaque réservation confirmée ───────────────────────

    @Transactional
    public void incrementer(Long idVoyageur, String codeAgence) {
        int annee = LocalDate.now().getYear();

        // 1. Mettre à jour PostgreSQL
        CompteurFidelite compteur = compteurRepository
                .findByIdVoyageurAndCodeAgenceAndAnnee(idVoyageur, codeAgence, annee)
                .orElseGet(() -> CompteurFidelite.builder()
                        .idVoyageur(idVoyageur)
                        .codeAgence(codeAgence)
                        .annee(annee)
                        .nombreVoyages(0)
                        .voyagesGratuitsUtilises(0)
                        .build());

        compteur.setNombreVoyages(compteur.getNombreVoyages() + 1);
        compteur.setDerniereReservation(LocalDate.now());
        compteurRepository.save(compteur);

        // 2. Mettre à jour Redis
        String cle    = getCleRedis(idVoyageur, codeAgence, annee);
        String valeur = String.valueOf(compteur.getNombreVoyages());
        // TTL jusqu'à fin d'année
        long joursRestants = LocalDate.now().lengthOfYear()
                        - LocalDate.now().getDayOfYear();
        redisTemplate.opsForValue().set(cle, valeur,
                Duration.ofDays(joursRestants + 1));

        log.info("[FIDELITE] Voyageur={} agence={} compteur={}",
                idVoyageur, codeAgence, compteur.getNombreVoyages());

        // 3. Vérifier si seuil atteint
        if (compteur.getNombreVoyages() % SEUIL_VOYAGE_GRATUIT == 0) {
            notifierVoyageGratuit(idVoyageur, codeAgence,
                                compteur.getNombreVoyages());
        }
    }

    // ─── Vérifier si le prochain voyage est gratuit (lecture rapide Redis) ────

    public boolean estVoyageGratuit(Long idVoyageur, String codeAgence) {
        int    annee = LocalDate.now().getYear();
        String cle   = getCleRedis(idVoyageur, codeAgence, annee);
        String val   = redisTemplate.opsForValue().get(cle);

        if (val == null) {
            // Cache miss → lire en base
            return compteurRepository
                    .findByIdVoyageurAndCodeAgenceAndAnnee(
                            idVoyageur, codeAgence, annee)
                    .map(c -> c.getNombreVoyages() % SEUIL_VOYAGE_GRATUIT == 0
                            && c.getNombreVoyages() > 0)
                    .orElse(false);
        }
        int nb = Integer.parseInt(val);
        return nb % SEUIL_VOYAGE_GRATUIT == 0 && nb > 0;
    }

    public int getNombreVoyages(Long idVoyageur, String codeAgence) {
        int    annee = LocalDate.now().getYear();
        String cle   = getCleRedis(idVoyageur, codeAgence, annee);
        String val   = redisTemplate.opsForValue().get(cle);
        if (val != null) return Integer.parseInt(val);
        return compteurRepository
                .findByIdVoyageurAndCodeAgenceAndAnnee(idVoyageur, codeAgence, annee)
                .map(CompteurFidelite::getNombreVoyages)
                .orElse(0);
    }

    // ─── Notifier via RabbitMQ → notification-service ─────────────────────────

    private void notifierVoyageGratuit(Long idVoyageur,
                                        String codeAgence,
                                        int nombreVoyages) {
        Map<String, Object> payload = Map.of(
                "idVoyageur",    idVoyageur,
                "codeAgence",    codeAgence,
                "nombreVoyages", nombreVoyages,
                "message",       "Félicitations ! Vous avez effectué "
                                + nombreVoyages
                                + " voyages avec " + codeAgence
                                + ". Votre prochain voyage est GRATUIT !"
        );
        rabbitTemplate.convertAndSend(
                "njila.booking.exchange",
                "booking.fidelite.reward",
                payload
        );
        log.info("[FIDELITE] Voyage gratuit notifié → voyageur={} agence={}",
                idVoyageur, codeAgence);
    }

    private String getCleRedis(Long idVoyageur, String codeAgence, int annee) {
        return String.format(KEY_TEMPLATE, idVoyageur, codeAgence, annee);
    }
}