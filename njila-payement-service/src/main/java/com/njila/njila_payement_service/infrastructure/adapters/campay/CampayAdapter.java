package com.njila.njila_payement_service.infrastructure.adapters.campay;

import com.njila.njila_payement_service.application.dtos.responses.RefundResult;
import com.njila.njila_payement_service.domain.enumerations.Currency;

import com.njila.njila_payement_service.domain.exceptions.*;
import com.njila.njila_payement_service.infrastructure.adapters.PaymentMethod;
import com.njila.njila_payement_service.infrastructure.adapters.Refundable;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.requests.CollectRequest;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.requests.TokenRequest;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.requests.WithdrawRequest;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.CollectResponse;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.TokenResponse;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.TransactionStatusResponse;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.WithdrawResponse;
import feign.FeignException;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;


@Component

@RequiredArgsConstructor

public class CampayAdapter implements PaymentMethod, Refundable {

    @Value("${campay.app.username}")
    private String username;

    @Value("${campay.app.password}")
    private String password;

    private  final CamPayFeignClient camPayClient;

    private String getToken(){

        TokenResponse response = camPayClient.getToken(
                new TokenRequest(username, password)
        );

        if (response.getToken()==null ){

            throw new CamPayException("Could not get CamPay token");
        }
        return "Token: " + response.getToken();
    }

    @Override
    public String executePayment(Double amount, Currency currency, String phoneNumber, String externalReference) {

        String token = getToken();

        CollectRequest request = new CollectRequest(
                String.valueOf(amount.intValue()),
                currency.name(),
                phoneNumber,
                "booking payment",
                externalReference
        );

        try{

            CollectResponse response = camPayClient.collect(token, request);

            if(response == null ||response.getReference() == null){

                throw new CamPayException("CamPay response is invalid or blank");
            }

            return response.getReference();

        } catch (FeignException e){

            handleCamPayError(e.contentUTF8());
            throw new CamPayException("CamPay Error: " + e.getMessage());
        }

    }


    @Override
    public RefundResult executeRefund(String phoneNumber, Double amount, Currency currency) {

        String token = getToken();

        WithdrawRequest request = new WithdrawRequest(
            String.valueOf(amount.intValue()),
                phoneNumber,
                "Remboursement",
                UUID.randomUUID().toString()
        );


        try{

            WithdrawResponse response = camPayClient.withdraw(
                    token,
                    request
            );

            boolean success = response != null
                    && "PENDING".equals(response.getStatus());

            return  new RefundResult(success, amount, currency);

        } catch (FeignException e){

            handleCamPayError(e.contentUTF8());
            throw new CamPayException("CamPay Error: " + e.getMessage());
        }
    }


    public TransactionStatusResponse getTransactionStatus(String externalReference) {

        String token = getToken();

        try{

            TransactionStatusResponse response = camPayClient.getTransactionStatus(
                    token,
                    externalReference)
            ;

            if (response == null ||response.getStatus() == null){

                throw new CamPayException("Status not found for this: " + externalReference);
            }

            return response;
        } catch (FeignException e){

            handleCamPayError(e.contentUTF8());
            throw new CamPayException("CamPay Status Error: " + e.getMessage());
        }

       // return ;
    }


    public CollectResponse executePaymentWithDetails(Double amount, Currency currency, String phoneNumber, String externalReference) {

        String token = getToken();

        CollectRequest request = new CollectRequest(
                String.valueOf(amount.intValue()),
                currency.name(),
                phoneNumber,
                "booking payment",
                externalReference
        );

        try {

            CollectResponse response = camPayClient.collect(
                    token,
                    request
            );

            if(response == null ||response.getReference() == null){

                throw new CamPayException("CamPay response is invalid or blank");
            }

            return response;
        } catch (FeignException e){

            handleCamPayError(e.contentUTF8());

            throw new CamPayException("CamPay Error: " + e.getMessage());
        }
    }

    private void handleCamPayError(String responseBody){

        if (responseBody.contains(
                CamPayErrorCodes.INVALID_PHONE_NUMBER
        )){
            throw new CamPayInvalidPhoneNumberException(
                    "Invalid Phone Number - Pattern : 2376XXXXXXXX"
            );
        }

        if (responseBody.contains(
                CamPayErrorCodes.UNSUPPORTED_CARRIER))
        {
            throw new UnsupportedCarrierException(
                    "Unsupported Operator - MTN or Orange only"
            );
        }

        if (responseBody.contains(
                CamPayErrorCodes.INSUFFICIENT_BALANCE
        )){
            throw new CampayInsufficientBalanceException(
                    "Insufficient CamPay Balance"
            );
        }

        if (responseBody.contains(
                CamPayErrorCodes.INVALID_AMOUNT
        )){
            throw new CampayInvalidAmountException(
                    "Invalid amount"
            );
        }
    }


}
