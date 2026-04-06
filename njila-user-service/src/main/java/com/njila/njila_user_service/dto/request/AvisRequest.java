package com.njila.njila_user_service.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class AvisRequest {

    @NotNull(message = "L'ID agence est obligatoire")
    private String agenceId;

    private String agenceNom;

    @NotNull(message = "La note est obligatoire")
    @Min(value = 1, message = "La note minimum est 1")
    @Max(value = 5, message = "La note maximum est 5")
    private Integer note;

    @Size(max = 2000, message = "Le commentaire ne peut dépasser 2000 caractères")
    private String commentaire;
}