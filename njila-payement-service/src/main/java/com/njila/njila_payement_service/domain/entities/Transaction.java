package com.njila.njila_payement_service.domain.entities;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.TransactionStatus;
import com.njila.njila_payement_service.domain.exceptions.InvalidPaymentTransitionException;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


import java.time.LocalDateTime;



@Getter
@Setter
@AllArgsConstructor


@Entity

public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long transactionId;

    // provided by Campay
    @Column(nullable = false)
    private String providedReference;

    @Column(nullable = false)
    private Double amount;

    @Column(nullable = false)
    private String responseCode;

    @Enumerated(EnumType.STRING)
    private TransactionStatus status;

    @Enumerated(EnumType.STRING)
    private Currency currency;

    @Column(nullable = false)
    private String operator;

    //the one we give to Campay
    @Column(nullable = false)
    private String ExternalRessource;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;


    public Transaction(TransactionStatus transactionStatus) {

        this.status = transactionStatus;
    }

    protected Transaction() {}

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

        this.status = TransactionStatus.REVERSED;
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

    public static Transaction create(Payment payment,
                                     String providedReference,
                                     String externalReference,
                                     Double amount,
                                     Currency currency){

        Transaction t = new Transaction();

        t.payment = payment;
        t.providedReference = providedReference;
        t.ExternalRessource = externalReference;
        t.amount = amount;
        t.currency = currency;
        t.status = TransactionStatus.INITIATED;
        t.createdAt = LocalDateTime.now();
        t.updatedAt = LocalDateTime.now();

        return t;
    }

}
