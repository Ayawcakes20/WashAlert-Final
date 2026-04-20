package com.washalert.washalertbackend.verification;

import com.washalert.washalertbackend.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "email_otps")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class EmailOtp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "last_sent_at", nullable = false)
    private LocalDateTime lastSentAt;
}
