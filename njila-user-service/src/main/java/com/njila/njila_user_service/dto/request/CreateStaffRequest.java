package com.njila.njila_user_service.dto.request;

import com.njila.njila_user_service.enums.Role;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateStaffRequest {

    @NotBlank(message = "Le prénom est obligatoire")
    @Size(max = 100)
    private String name;

    @NotBlank(message = "Le nom est obligatoire")
    @Size(max = 100)
    private String surname;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Email invalide")
    private String email;

    @NotBlank(message = "Le téléphone est obligatoire")
    private String phone;

    @NotNull(message = "Le rôle est obligatoire")
    private Role role;

    @NotBlank(message = "L'ID filiale est obligatoire")
    private String filialeId;

    private String agenceId;
    private String numeroPermis;   // Chauffeur
    private String dateEmbauche;   // Chauffeur
    private String poste;          // Guichetier
}