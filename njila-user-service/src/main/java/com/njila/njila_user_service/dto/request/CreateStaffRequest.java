package com.njila.njila_user_service.dto.request;

import com.njila.njila_user_service.enums.Role;
import jakarta.validation.constraints.*;
import lombok.Data;

/**
 * @deprecated Cette classe est dépréciée. Utilisez les requêtes spécifiques :
 * - CreateManagerGlobalRequest pour MANAGER_GLOBAL
 * - CreateManagerLocalRequest pour MANAGER_LOCAL  
 * - CreateGuichetierRequest pour GUICHETIER
 * - CreateChauffeurRequest pour CHAUFFEUR
 */
@Deprecated
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

    @Size(max = 500, message = "L'adresse ne peut dépasser 500 caractères")
    private String adresse;

    private String filialeId;
    private String agenceId;
    private String numeroPermis;
    private String dateEmbauche;
    private String poste;
}