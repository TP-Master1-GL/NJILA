package com.njila.njila_user_service.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;


@Data
public class UpdatePhotoRequest {

    @NotBlank(message = "L'URL de la photo est obligatoire")
    @Pattern(
        regexp  = "^https://.*",
        message = "L'URL de la photo doit utiliser HTTPS"
    )
    @Size(max = 500, message = "L'URL ne peut dépasser 500 caractères")
    private String photoProfil;
}