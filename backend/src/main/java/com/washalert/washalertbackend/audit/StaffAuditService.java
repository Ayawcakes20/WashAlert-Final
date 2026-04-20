package com.washalert.washalertbackend.audit;

import com.washalert.washalertbackend.user.User;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class StaffAuditService {

    private final StaffAuditLogRepository repo;

    public StaffAuditService(StaffAuditLogRepository repo) {
        this.repo = repo;
    }

    public void logCreateStaff(User actor, User staff) {
        log(actor, staff, StaffAuditAction.CREATE_STAFF);
    }

    public void logDeleteStaff(User actor, User staff) {
        log(actor, staff, StaffAuditAction.DELETE_STAFF);
    }

    private void log(User actor, User staff, StaffAuditAction action) {
        if (actor == null || staff == null) return;

        StaffAuditLog row = StaffAuditLog.builder()
                .action(action)
                .staffId(staff.getId())
                .staffEmail(staff.getEmail())
                .actorId(actor.getId())
                .actorEmail(actor.getEmail())
                .createdAt(Instant.now())
                .build();

        repo.save(row);
    }
}
