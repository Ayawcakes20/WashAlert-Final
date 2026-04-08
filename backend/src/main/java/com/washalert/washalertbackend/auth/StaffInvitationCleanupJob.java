package com.washalert.washalertbackend.auth;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class StaffInvitationCleanupJob {

    private final StaffInvitationService staffInvitationService;
    private final StaffInvitationProperties props;

    public StaffInvitationCleanupJob(
            StaffInvitationService staffInvitationService,
            StaffInvitationProperties props
    ) {
        this.staffInvitationService = staffInvitationService;
        this.props = props;
    }

    @Scheduled(cron = "${washalert.staff-invitation.cleanup.cron:0 */30 * * * *}")
    public void cleanup() {
        if (!props.getCleanup().isEnabled()) return;
        staffInvitationService.cleanupExpiredTokens();
    }
}
