package com.njila.njila_payement_service.application.utilities;

import com.njila.njila_payement_service.application.dtos.requests.InitiatePaymentRequest;
import com.njila.njila_payement_service.application.dtos.responses.InitiatePaymentResponse;
import com.njila.njila_payement_service.domain.entities.Payment;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;

import com.njila.njila_payement_service.domain.exceptions.InvalidAmountException;
import com.njila.njila_payement_service.domain.exceptions.InvalidPhoneNumberException;
import com.njila.njila_payement_service.domain.exceptions.UnsupportedPaymentMethodException;
import lombok.RequiredArgsConstructor;


@RequiredArgsConstructor

public class Utilities {

    public static void verifyBeforeInitiateAPayment(InitiatePaymentRequest request){

        if(request == null){
            throw new IllegalArgumentException("request can't be null");
        }

        if(request.amount() < 0.0){
            throw new InvalidAmountException("Amount can't be negative");
        }

        if(request.paymentMethodType() == null){
            throw new IllegalArgumentException("paymentMethodType can't be null");
        }

        if(!request.paymentMethodType().name().equals(PaymentMethodType.CASH.name()) && !request.paymentMethodType().name().equals(PaymentMethodType.MOBILE_MONEY.name())){

            throw new UnsupportedPaymentMethodException("Unsupported PaymentMethodType");
        }

        if(request.bookingId() == 0
                || request.passengerId() == 0
                || request.amount() == 0
                || request.currency() == null
                || request.phoneNumber() == null
        ){
            throw new IllegalArgumentException("Missing required fields");
        }

    }

    public static InitiatePaymentResponse mapToInitiatePaymentResponse(Payment payment){

       return   InitiatePaymentResponse.builder()
                 .paymentId(payment.getPaymentId())
                 .amount(payment.getAmount())
                 .status(PaymentStatus.PENDING)
                 .paymentMethodType(payment.getPaymentMethodType())
                 .currency(payment.getCurrency())
               .build();

    }

    public static void verifyPhoneNumber(String phoneNumber){

        String start = "2376";

        if (phoneNumber.length() != 12 || !phoneNumber.startsWith(start)) {

            throw new InvalidPhoneNumberException("The provided phone number is invalid");
        }

    }

}
