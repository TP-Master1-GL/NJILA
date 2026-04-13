package com.njila.njila_booking_service.repository.projection;

import com.njila.njila_booking_service.domain.entity.projection.UserData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserDataRepository extends JpaRepository<UserData, Long> {
}
