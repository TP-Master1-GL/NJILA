package com.njila.njila_payement_service.infrastructure.adapters.campay;

public final class CamPayErrorCodes {

    private CamPayErrorCodes() {}

    public static final String INVALID_PHONE_NUMBER = "ER101";

    public static final String UNSUPPORTED_CARRIER = "ER102";

    public static final String INVALID_AMOUNT = "ER201";

    public static final String INSUFFICIENT_BALANCE = "ER301";
}
