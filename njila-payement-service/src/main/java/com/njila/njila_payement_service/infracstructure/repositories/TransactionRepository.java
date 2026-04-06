package com.njila.njila_payement_service.infracstructure.repositories;

import com.njila.njila_payement_service.domain.entities.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {
}
