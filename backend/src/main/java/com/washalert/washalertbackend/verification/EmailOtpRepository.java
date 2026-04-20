package com.washalert.washalertbackend.verification;

import com.washalert.washalertbackend.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

public interface EmailOtpRepository extends JpaRepository<EmailOtp, Long> {

    Optional<EmailOtp> findByUser(User user);

    @Modifying
    @Transactional
    void deleteByUser(User user);

    @Modifying
    @Transactional
    void deleteByExpiresAtBefore(LocalDateTime now);
}