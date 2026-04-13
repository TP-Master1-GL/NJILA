package com.njila.njila_payement_service.infrastructure.adapters.campay;

import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.requests.CollectRequest;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.requests.TokenRequest;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.requests.WithdrawRequest;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.CollectResponse;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.TokenResponse;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.TransactionStatusResponse;
import com.njila.njila_payement_service.infrastructure.adapters.campay.CamDtos.responses.WithdrawResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

@FeignClient(
        name="campay",
        url = "${campay.base.url}"
)

public interface CamPayFeignClient {

    @PostMapping("/token/")
    TokenResponse getToken(@RequestBody TokenRequest tokenRequest);


    @PostMapping("/collect/")
    CollectResponse collect(@RequestHeader("Authorization") String token, @RequestBody CollectRequest collectRequest);

    @GetMapping("/transaction/{reference}/")
    TransactionStatusResponse getTransactionStatus(@RequestHeader("Authorization") String token, @PathVariable("reference") String reference);

    @PostMapping("/withdraw/")
    WithdrawResponse withdraw(@RequestHeader("Authorization") String token, @RequestBody WithdrawRequest withdrawRequest);
}
