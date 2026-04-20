package com.washalert.washalertbackend.auth;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PasswordResetCleanupJob {

    private final PasswordResetService passwordResetService;
    private final PasswordResetProperties props;

    public PasswordResetCleanupJob(
            PasswordResetService passwordResetService,
            PasswordResetProperties props
    ) {
        this.passwordResetService = passwordResetService;
        this.props = props;
    }

    @Scheduled(cron = "${washalert.password-reset.cleanup.cron:0 */30 * * * *}")
    public void cleanup() {
        if (!props.getCleanup().isEnabled()) return;
        passwordResetService.cleanupExpiredTokens();
    }
}
