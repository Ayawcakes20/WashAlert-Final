package com.washalert.washalertbackend.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface StaffInvitationTokenRepository extends JpaRepository<StaffInvitationToken, Long> {

    Optional<StaffInvitationToken> findByTokenHash(String tokenHash);

    long deleteByUser_Id(Long userId);

    long deleteByExpiresAtBefore(LocalDateTime cutoff);

    long deleteByUsedAtIsNotNullAndUsedAtBefore(LocalDateTime cutoff);
}
