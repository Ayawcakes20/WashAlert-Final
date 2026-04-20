package com.washalert.washalertbackend.verification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Component
public class OtpCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(OtpCleanupJob.class);

    private final EmailOtpRepository otps;

    public OtpCleanupJob(EmailOtpRepository otps) {
        this.otps = otps;
    }

    // Runs every 5 minutes
    @Transactional
    @Scheduled(fixedDelay = 5 * 60 * 1000)
    public void cleanupExpiredOtps() {
        LocalDateTime now = LocalDateTime.now();

        long before = otps.count();

        otps.deleteByExpiresAtBefore(now);

        long after = otps.count();
        long deleted = before - after;

        if (deleted > 0) {
            log.info("OTP cleanup: deleted {} expired OTP(s)", deleted);
        } else {
            log.debug("OTP cleanup: no expired OTPs found");
        }
    }
}
