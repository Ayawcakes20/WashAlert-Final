package com.washalert.washalertbackend.bootstrap;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;

@Configuration
public class AdminBootstrap {

    @Bean
    CommandLineRunner createAdminIfNotExists(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            FirestoreSyncService firestoreSyncService
    ) {
        return args -> {
            String email = "paulomiguelgarcia0420@gmail.com";

            if (userRepository.findByEmail(email).isPresent()) {
                return;
            }

            User admin = User.builder()
                    .email(email)
                    .fullName("System Administrator")
                    .passwordHash(passwordEncoder.encode("Admin_123"))
                    .role(Role.ADMIN)
                    .enabled(true)
                    .verifiedAt(LocalDateTime.now())
                    .createdAt(LocalDateTime.now())
                    .mustChangePassword(false)
                    .provider(AuthProvider.LOCAL)
                    .branch("Main")
                    .build();

            User saved = userRepository.save(admin);
            firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));

            System.out.println("Default ADMIN account created: " + email);
        };
    }
}
