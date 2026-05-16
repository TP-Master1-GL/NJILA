package com.njila.njila_user_service.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateGuichetierRequest {
    @NotBlank(message = "Le prénom est obligatoire")
    @Size(max = 100, message = "Le prénom ne peut dépasser 100 caractères")
    private String name;

    @NotBlank(message = "Le nom est obligatoire")
    @Size(max = 100, message = "Le nom ne peut dépasser 100 caractères")
    private String surname;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Email invalide")
    private String email;

    @NotBlank(message = "Le téléphone est obligatoire")
    @Pattern(regexp = "^[+]?[0-9\\s\\-]{7,20}$", message = "Numéro de téléphone invalide")
    private String phone;

    @Size(max = 500, message = "L'adresse ne peut dépasser 500 caractères")
    private String adresse;

    @Size(max = 100, message = "Le poste ne peut dépasser 100 caractères")
    private String poste;

    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$", 
             message = "Format date invalide. Utilisez yyyy-MM-ddTHH:mm:ss")
    private String dateEmbauche;
}