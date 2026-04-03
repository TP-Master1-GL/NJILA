package com.njila.njila_user_service.dto.request;

import com.njila.njila_user_service.enums.Role;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreateStaffRequest {

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

    @NotNull(message = "Le rôle est obligatoire")
    private Role role;

    // Pour ManagerLocal, ManagerGlobal, Guichetier, Chauffeur
    @NotBlank(message = "L'ID filiale est obligatoire pour ce rôle")
    private String filialeId;

    // Pour ManagerGlobal, ManagerLocal, Guichetier, Chauffeur (optionnel selon contexte)
    private String agenceId;

    // Chauffeur uniquement
    @Size(max = 50, message = "Le numéro de permis ne peut dépasser 50 caractères")
    private String numeroPermis;

    // Chauffeur uniquement (format ISO: 2025-01-15T00:00:00)
    @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}$", 
             message = "Format date invalide. Utilisez yyyy-MM-ddTHH:mm:ss")
    private String dateEmbauche;

    // Guichetier uniquement
    @Size(max = 100, message = "Le poste ne peut dépasser 100 caractères")
    private String poste;
}