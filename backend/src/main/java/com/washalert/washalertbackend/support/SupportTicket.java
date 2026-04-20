package com.washalert.washalertbackend.support;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "support_tickets",
        indexes = {
                @Index(name = "idx_support_tickets_session_created", columnList = "session_id,created_at"),
                @Index(name = "idx_support_tickets_branch_created", columnList = "branch,created_at"),
                @Index(name = "idx_support_tickets_number", columnList = "ticket_number", unique = true)
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_number", nullable = false, length = 40, unique = true)
    private String ticketNumber;

    @Column(name = "session_id", nullable = false, length = 80)
    private String sessionId;

    @Column(length = 80)
    private String branch;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String issue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SupportTicketStatus status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (status == null) status = SupportTicketStatus.OPEN;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
