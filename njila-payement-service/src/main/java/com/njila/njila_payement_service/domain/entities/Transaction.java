package com.njila.njila_payement_service.domain.entities;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.TransactionStatus;
import com.njila.njila_payement_service.domain.exceptions.InvalidPaymentTransitionException;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor

@Entity

public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID transactionId;

    private String providedReference;

    private BigDecimal amount;

    private String responseCode;

    @Enumerated(EnumType.STRING)
    private TransactionStatus status;

    @Enumerated(EnumType.STRING)
    private Currency currency;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;


    public void markSucceed(){

        if (this.status != TransactionStatus.AUTHORIZED){

            throw new InvalidPaymentTransitionException("Only authorized transactions can be captured");
        }

        this.status = TransactionStatus.CAPTURED;
        this.updatedAt = LocalDateTime.now();
    }


    public void markFailed(){

        if (this.status != TransactionStatus.INITIATED && this.status != TransactionStatus.CAPTURED){

            throw new InvalidPaymentTransitionException("Only initiated transactions or captured ones can failed");

        }

        this.status = TransactionStatus.FAILED;
        this.updatedAt = LocalDateTime.now();

    }


    public void complete(){

        if (this.status != TransactionStatus.AUTHORIZED){

            throw new InvalidPaymentTransitionException("Only authorized transactions can be captured");
        }

        this.status = TransactionStatus.CAPTURED;
        this.updatedAt = LocalDateTime.now();
    }

    public void authorize (){

        if (this.status != TransactionStatus.INITIATED) {

            throw new InvalidPaymentTransitionException("Only initiated transactions are authorized");
        }

        this.status = TransactionStatus.AUTHORIZED;
        this.updatedAt = LocalDateTime.now();
    }


    public void timeout (){

        if (this.status != TransactionStatus.AUTHORIZED){

            throw new InvalidPaymentTransitionException("Only authorized transactions can timeout");
        }
        this.status = TransactionStatus.TIMEOUT;
        this.updatedAt = LocalDateTime.now();
    }

}
