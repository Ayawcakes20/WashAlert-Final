package com.washalert.washalertbackend.auth;

import com.washalert.washalertbackend.auth.dto.MeResponse;
import com.washalert.washalertbackend.common.DataReadMode;
import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserStatus;
import com.washalert.washalertbackend.user.UserRepository;
import com.washalert.washalertbackend.verification.MailService;
import com.washalert.washalertbackend.verification.OtpService;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthServiceTests {

    @Test
    void meUsesFirestoreWhenConfigured() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        FirestoreSyncService firestoreSyncService = mock(FirestoreSyncService.class);
        FirestoreReadService firestoreReadService = mock(FirestoreReadService.class);
        DataReadProperties dataReadProperties = new DataReadProperties();
        dataReadProperties.setReadMode(DataReadMode.FIRESTORE);
        FirebaseIdentityService firebaseIdentityService = mock(FirebaseIdentityService.class);
        MailService mailService = mock(MailService.class);
        OtpService otpService = mock(OtpService.class);
        PasswordResetProperties passwordResetProperties = new PasswordResetProperties();

        AuthService service = new AuthService(
                users,
                encoder,
                firestoreSyncService,
                firestoreReadService,
                dataReadProperties,
                firebaseIdentityService,
                mailService,
                otpService,
                passwordResetProperties
        );

        User principalUser = User.builder()
                .id(100L)
                .email("principal@example.com")
                .fullName("Principal")
                .passwordHash("x")
                .role(Role.STAFF)
                .status(UserStatus.ACTIVE)
                .provider(AuthProvider.LOCAL)
                .enabled(true)
                .mustChangePassword(false)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        FirestoreReadService.FirestoreUserRecord firestoreUser = new FirestoreReadService.FirestoreUserRecord(
                100L,
                "principal@example.com",
                "Firestore Principal",
                "STAFF",
                "Light Residences",
                true,
                true,
                "LOCAL",
                LocalDateTime.now(),
                LocalDateTime.now(),
                "hash"
        );
        when(firestoreReadService.findUserById(100L)).thenReturn(Optional.of(firestoreUser));

        MeResponse me = service.me(new AuthUserDetails(principalUser));

        assertThat(me.id()).isEqualTo(100L);
        assertThat(me.fullName()).isEqualTo("Firestore Principal");
        assertThat(me.mustChangePassword()).isTrue();
    }

    @Test
    void meFallsBackToMysqlWhenHybridAndFirestoreMisses() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        FirestoreSyncService firestoreSyncService = mock(FirestoreSyncService.class);
        FirestoreReadService firestoreReadService = mock(FirestoreReadService.class);
        DataReadProperties dataReadProperties = new DataReadProperties();
        dataReadProperties.setReadMode(DataReadMode.HYBRID);
        FirebaseIdentityService firebaseIdentityService = mock(FirebaseIdentityService.class);
        MailService mailService = mock(MailService.class);
        OtpService otpService = mock(OtpService.class);
        PasswordResetProperties passwordResetProperties = new PasswordResetProperties();

        AuthService service = new AuthService(
                users,
                encoder,
                firestoreSyncService,
                firestoreReadService,
                dataReadProperties,
                firebaseIdentityService,
                mailService,
                otpService,
                passwordResetProperties
        );

        User principalUser = User.builder()
                .id(200L)
                .email("principal2@example.com")
                .fullName("Principal 2")
                .passwordHash("x")
                .role(Role.STAFF)
                .status(UserStatus.ACTIVE)
                .provider(AuthProvider.LOCAL)
                .enabled(true)
                .mustChangePassword(false)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        User mysqlUser = User.builder()
                .id(200L)
                .email("principal2@example.com")
                .fullName("Mysql Principal")
                .passwordHash("x")
                .role(Role.ADMIN)
                .status(UserStatus.ACTIVE)
                .provider(AuthProvider.LOCAL)
                .enabled(true)
                .mustChangePassword(false)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        when(firestoreReadService.findUserById(200L)).thenReturn(Optional.empty());
        when(firestoreReadService.isAvailable()).thenReturn(true);
        when(users.findById(200L)).thenReturn(Optional.of(mysqlUser));

        MeResponse me = service.me(new AuthUserDetails(principalUser));

        assertThat(me.id()).isEqualTo(200L);
        assertThat(me.fullName()).isEqualTo("Mysql Principal");
        assertThat(me.role()).isEqualTo("ADMIN");
    }
}
