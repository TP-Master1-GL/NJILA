package com.njila.njila_payement_service.domain.enumerations;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor

public enum Currency {
    XAF("XAF"),
    XOF("XOF");

    private final String value;

    @JsonValue
    public String toValue(){
        return value;
    }
}
