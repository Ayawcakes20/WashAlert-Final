package com.washalert.washalertbackend.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    long deleteByUser_Id(Long userId);

    // Existing: deletes expired tokens
    long deleteByExpiresAtBefore(LocalDateTime cutoff);

    // ✅ NEW (D3.3): deletes already-used tokens older than cutoff
    long deleteByUsedAtIsNotNullAndUsedAtBefore(LocalDateTime cutoff);

    // ✅ Optional (D3.3): deletes tokens created long ago (safety net)
    long deleteByCreatedAtBefore(LocalDateTime cutoff);
}
