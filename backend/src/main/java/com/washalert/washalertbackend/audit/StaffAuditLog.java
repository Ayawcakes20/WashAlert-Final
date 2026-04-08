package com.washalert.washalertbackend.audit;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(
        name = "staff_audit_logs",
        indexes = {
                @Index(name = "idx_audit_staff_id", columnList = "staffId"),
                @Index(name = "idx_audit_actor_id", columnList = "actorId"),
                @Index(name = "idx_audit_created_at", columnList = "createdAt")
        }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class StaffAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // What happened
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private StaffAuditAction action;

    // Who was affected (staff)
    @Column(nullable = false)
    private Long staffId;

    @Column(nullable = false)
    private String staffEmail;

    // Who did it (admin actor)
    @Column(nullable = false)
    private Long actorId;

    @Column(nullable = false)
    private String actorEmail;

    @Column(nullable = false)
    private Instant createdAt;
}
