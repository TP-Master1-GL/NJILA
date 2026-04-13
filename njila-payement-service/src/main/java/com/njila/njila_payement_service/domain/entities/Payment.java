package com.njila.njila_payement_service.domain.entities;

import com.njila.njila_payement_service.domain.enumerations.Currency;
import com.njila.njila_payement_service.domain.enumerations.PaymentMethodType;
import com.njila.njila_payement_service.domain.enumerations.PaymentStatus;
import com.njila.njila_payement_service.domain.exceptions.InvalidPaymentTransitionException;

import jakarta.persistence.*;
import lombok.*;


import java.time.LocalDateTime;


@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor

@Builder

@Entity

public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long paymentId;

    private Double amount;

    @Enumerated(EnumType.STRING)
    private PaymentStatus status;

    @Enumerated(EnumType.STRING)
    private PaymentMethodType paymentMethodType;

    @Enumerated(EnumType.STRING)
    private Currency currency;

    @Column(updatable = false, nullable = false,  unique = true)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(updatable = false)
    private long bookingId;

    @Column(nullable = false)
    private long passengerId;

    @Column(nullable = false)
    private String phoneNumber;

    /*
    @OneToMany
    private List<Transaction> transactions;

    @OneToOne(cascade = CascadeType.PERSIST)*/

    @Column(nullable = false, unique = true)
    private String idempotencyKeyValue;

    public Payment(PaymentStatus paymentStatus) {
        this.status = paymentStatus;
    }


    //The following methods are written to ensure the state's transition


    public void cancel(){

        if (this.status != PaymentStatus.PENDING && this.status != PaymentStatus.PROCESSING) {

            throw new InvalidPaymentTransitionException("A payment with status " + this.status + " cannot be cancelled");
        }

        this.status = PaymentStatus.CANCELLED;
        this.updatedAt = LocalDateTime.now();
    }

    public void confirm(){

        if(this.status != PaymentStatus.PROCESSING){
            throw new InvalidPaymentTransitionException("A payment with status " + this.status + " cannot be confirmed");
        }

        this.status = PaymentStatus.COMPLETED;
        this.updatedAt = LocalDateTime.now();
    }

    public void initiate(){

        if(this.status != PaymentStatus.PENDING){
            throw new InvalidPaymentTransitionException("You can't initiate a payment with the status " + this.status);
        }

        this.status = PaymentStatus.PROCESSING;
        this.updatedAt = LocalDateTime.now();
    }

    public void fail(){

        if(this.status != PaymentStatus.PROCESSING){
            throw new InvalidPaymentTransitionException("A payment with the status " + this.status + "can't failed");
        }

        this.status = PaymentStatus.FAILED;
        this.updatedAt = LocalDateTime.now();
    }

    public void expire(){

        if(this.status != PaymentStatus.PROCESSING){

            throw new InvalidPaymentTransitionException("A payment with the status " + this.status + "can't expire");
        }
        this.status = PaymentStatus.EXPIRED;
        this.updatedAt = LocalDateTime.now();
    }

    public void refund (){

        if(this.status != PaymentStatus.COMPLETED){

            throw new InvalidPaymentTransitionException("A payment with the status " + this.status + "can't be refund");
        }
        this.status = PaymentStatus.REFUNDED;
        this.updatedAt = LocalDateTime.now();
    }

    public void partialRefund (){

        if(this.status != PaymentStatus.COMPLETED){

            throw new InvalidPaymentTransitionException("A payment with the status " + this.status + "can't be refund");
        }

        this.status = PaymentStatus.PARTIALLY_REFUNDED;
        this.updatedAt = LocalDateTime.now();
    }


}
