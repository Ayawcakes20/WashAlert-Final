package com.washalert.washalertbackend.auth;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.washalert.washalertbackend.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "staff_invitation_tokens",
        indexes = {
                @Index(name = "idx_sit_token_hash", columnList = "token_hash", unique = true),
                @Index(name = "idx_sit_expires_at", columnList = "expires_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaffInvitationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "user_id",
            nullable = false,
            foreignKey = @ForeignKey(name = "fk_sit_user")
    )
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public boolean isExpired(LocalDateTime now) {
        if (now == null) now = LocalDateTime.now();
        return expiresAt != null && expiresAt.isBefore(now);
    }

    public boolean isUsed() {
        return usedAt != null;
    }
}
