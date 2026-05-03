package com.washalert.washalertbackend.bootstrap;

import com.google.firebase.auth.UserRecord;
import com.washalert.washalertbackend.auth.FirebaseIdentityService;
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
import java.util.Optional;

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
            FirestoreSyncService firestoreSyncService,
            FirebaseIdentityService firebaseIdentityService
    ) {
        return args -> {
            seedAdmin(userRepository, passwordEncoder, firestoreSyncService, firebaseIdentityService,
                    "paulomiguelgarcia0420@gmail.com", "System Administrator", "Admin_123", "Makati Branch");

            seedAdmin(userRepository, passwordEncoder, firestoreSyncService, firebaseIdentityService,
                    "drifttt.44@gmail.com", "System Administrator", "Admin_123", "UP Branch");
        };
    }

    private void seedAdmin(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            FirestoreSyncService firestoreSyncService,
            FirebaseIdentityService firebaseIdentityService,
            String email, String fullName, String password, String branch
    ) {
        Optional<User> existing = userRepository.findByEmail(email);

        if (existing.isPresent()) {
            User user = existing.get();
            System.out.println("[Bootstrap] Admin found in MySQL: " + email + " | firebaseUid=" + user.getFirebaseUid());

            // Always attempt Firebase user creation to ensure the account exists.
            // If Firebase already has the email → catches IllegalArgumentException (no-op).
            // If Firebase doesn't have it (stale/missing UID) → creates it and updates MySQL.
            String newUid = createFirebaseUser(firebaseIdentityService, email, fullName, password);
            if (newUid != null) {
                // Firebase account was just created (it was missing) — update MySQL record
                user.setFirebaseUid(newUid);
                User saved = userRepository.save(user);
                firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));
                System.out.println("[Bootstrap] Firebase UID updated for: " + email + " uid=" + newUid);
            } else {
                System.out.println("[Bootstrap] Firebase account already exists for: " + email + " — no update needed.");
            }
            return;
        }

        // New user — create in both Firebase Auth and MySQL
        String firebaseUid = createFirebaseUser(firebaseIdentityService, email, fullName, password);
        User admin = User.builder()
                .email(email)
                .fullName(fullName)
                .passwordHash(passwordEncoder.encode(password))
                .firebaseUid(firebaseUid)
                .role(Role.ADMIN)
                .enabled(true)
                .verifiedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .mustChangePassword(false)
                .provider(AuthProvider.LOCAL)
                .branch(branch)
                .build();

        User saved = userRepository.save(admin);
        firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));
        System.out.println("[Bootstrap] Default ADMIN account created: " + email);
    }

    /**
     * Creates a Firebase Auth user and returns their UID.
     * If Firebase is disabled or the email already exists in Firebase, returns null safely.
     */
    private String createFirebaseUser(FirebaseIdentityService firebaseIdentityService,
                                      String email, String fullName, String password) {
        if (!firebaseIdentityService.isEnabled()) {
            System.out.println("[Bootstrap] Firebase is disabled, skipping Firebase user creation for: " + email);
            return null;
        }
        try {
            UserRecord record = firebaseIdentityService.createUser(email, fullName, password);
            System.out.println("[Bootstrap] Firebase Auth user created for: " + email + " uid=" + record.getUid());
            return record.getUid();
        } catch (IllegalArgumentException ex) {
            // Email already exists in Firebase
            System.out.println("[Bootstrap] Firebase user already exists for: " + email + " — skipping Firebase creation.");
            return null;
        } catch (Exception ex) {
            // Any other Firebase error (permissions, network, etc.) — log the real reason
            System.err.println("[Bootstrap] ERROR: Failed to create Firebase user for: " + email);
            System.err.println("[Bootstrap] ERROR cause: " + ex.getClass().getSimpleName() + " — " + ex.getMessage());
            return null;
        }
    }
}
