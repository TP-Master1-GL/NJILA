package com.njila.njila_user_service.repository;

import com.njila.njila_user_service.entity.UserProfile;
import com.njila.njila_user_service.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<UserProfile, UUID> {

    Optional<UserProfile> findByEmail(String email);
    boolean existsByEmail(String email);
    List<UserProfile> findAllByRole(Role role);
    
    
}