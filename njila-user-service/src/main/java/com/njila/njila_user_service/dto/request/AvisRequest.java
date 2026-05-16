package com.njila.njila_user_service.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
@Schema(description = "Requête de soumission d'avis")
public class AvisRequest {

    @Schema(description = "ID de l'agence cible", example = "123e4567-e89b-12d3-a456-426614174000", required = true)
    @NotNull(message = "L'ID agence est obligatoire")
    private String agenceId;

    @Schema(description = "Nom de l'agence (pour dénormalisation)", example = "Agence Dakar Centre")
    private String agenceNom;

    @Schema(description = "Note attribuée (1 à 5 étoiles)", example = "4", minimum = "1", maximum = "5", required = true)
    @NotNull(message = "La note est obligatoire")
    @Min(value = 1, message = "La note minimum est 1")
    @Max(value = 5, message = "La note maximum est 5")
    private Integer note;

    @Schema(description = "Commentaire optionnel", example = "Service excellent, personnel accueillant")
    @Size(max = 2000, message = "Le commentaire ne peut dépasser 2000 caractères")
    private String commentaire;
}