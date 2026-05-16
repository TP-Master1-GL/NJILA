package com.njila.njila_user_service.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class UpdateProfileRequest {

    @Size(max = 100, message = "Le prénom ne peut dépasser 100 caractères")
    private String name;

    @Size(max = 100, message = "Le nom ne peut dépasser 100 caractères")
    private String surname;

    @Email(message = "Format d'email invalide")
    @Size(max = 150, message = "L'email ne peut dépasser 150 caractères")
    private String email;

    @Pattern(regexp = "^[+]?[0-9\\s\\-]{7,20}$", message = "Numéro de téléphone invalide")
    private String phone;

    @Size(max = 500, message = "L'adresse ne peut dépasser 500 caractères")
    private String adresse;
}
