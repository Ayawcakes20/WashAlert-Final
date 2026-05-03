package com.washalert.washalertbackend.bootstrap;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;

@Configuration
public class AdminBootstrap {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    @Value("${ADMIN_BOOTSTRAP_ENABLED:false}")
    private boolean adminBootstrapEnabled;

    @Value("${ADMIN_BOOTSTRAP_EMAIL:}")
    private String adminBootstrapEmail;

    @Value("${ADMIN_BOOTSTRAP_PASSWORD:}")
    private String adminBootstrapPassword;

    @Value("${ADMIN_BOOTSTRAP_FULL_NAME:System Administrator}")
    private String adminBootstrapFullName;

    @Value("${ADMIN_BOOTSTRAP_BRANCH:Makati Branch}")
    private String adminBootstrapBranch;

    @Bean
    CommandLineRunner createAdminIfNotExists(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            FirestoreSyncService firestoreSyncService
    ) {
        return args -> {
            if (!adminBootstrapEnabled) {
                log.info("[ADMIN_BOOTSTRAP] Disabled. Skipping admin bootstrap.");
                return;
            }

            String email = trimToNull(adminBootstrapEmail);
            String password = trimToNull(adminBootstrapPassword);

            if (email == null || password == null) {
                log.warn("[ADMIN_BOOTSTRAP] Missing ADMIN_BOOTSTRAP_EMAIL or ADMIN_BOOTSTRAP_PASSWORD. Skipping admin bootstrap.");
                return;
            }

            if (userRepository.findByEmail(email).isPresent()) {
                log.info("[ADMIN_BOOTSTRAP] Bootstrap admin already exists for {}. No changes applied.", maskEmail(email));
                return;
            }

            User admin = User.builder()
                    .email(email)
                    .fullName(trimToNull(adminBootstrapFullName) == null ? "System Administrator" : adminBootstrapFullName.trim())
                    .passwordHash(passwordEncoder.encode(password))
                    .role(Role.ADMIN)
                    .enabled(true)
                    .verifiedAt(LocalDateTime.now())
                    .createdAt(LocalDateTime.now())
                    .mustChangePassword(false)
                    .provider(AuthProvider.LOCAL)
                    .branch(trimToNull(adminBootstrapBranch))
                    .build();

            User saved = userRepository.save(admin);
            firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));

            log.info("[ADMIN_BOOTSTRAP] Created bootstrap admin account for {}", maskEmail(email));
        };
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String maskEmail(String email) {
        if (email == null || email.isBlank() || !email.contains("@")) {
            return "<unknown-email>";
        }
        int at = email.indexOf('@');
        String local = email.substring(0, at);
        if (local.length() <= 2) {
            return "*@" + email.substring(at + 1);
        }
        return local.substring(0, 2) + "***@" + email.substring(at + 1);
    }
}
