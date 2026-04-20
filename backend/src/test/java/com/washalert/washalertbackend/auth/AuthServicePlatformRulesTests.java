package com.washalert.washalertbackend.auth;

import com.google.firebase.auth.FirebaseToken;
import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.user.*;
import com.washalert.washalertbackend.verification.MailService;
import com.washalert.washalertbackend.verification.OtpService;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AuthServicePlatformRulesTests {

    @Test
    void customerIsDeniedOnWeb() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        FirestoreSyncService firestoreSyncService = mock(FirestoreSyncService.class);
        FirestoreReadService firestoreReadService = mock(FirestoreReadService.class);
        DataReadProperties dataReadProperties = new DataReadProperties();
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

        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("uid-1");
        when(token.getEmail()).thenReturn("customer@washalert.ph");
        when(firebaseIdentityService.verifyIdToken("id-token")).thenReturn(token);

        User customer = User.builder()
                .id(1L)
                .firebaseUid("uid-1")
                .email("customer@washalert.ph")
                .fullName("Customer")
                .passwordHash("x")
                .role(Role.CUSTOMER)
                .status(UserStatus.ACTIVE)
                .enabled(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .provider(AuthProvider.LOCAL)
                .build();
        when(users.findByFirebaseUid("uid-1")).thenReturn(Optional.of(customer));

        assertThatThrownBy(() -> service.authenticateWithFirebase("id-token", "WEB", "SpeedyWash - Pasig"))
                .hasMessageContaining("not allowed on web");
    }

    @Test
    void suspendedUserIsDeniedOnMobile() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        FirestoreSyncService firestoreSyncService = mock(FirestoreSyncService.class);
        FirestoreReadService firestoreReadService = mock(FirestoreReadService.class);
        DataReadProperties dataReadProperties = new DataReadProperties();
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

        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("uid-2");
        when(token.getEmail()).thenReturn("driver@washalert.ph");
        when(firebaseIdentityService.verifyIdToken("id-token-2")).thenReturn(token);

        User suspendedDriver = User.builder()
                .id(2L)
                .firebaseUid("uid-2")
                .email("driver@washalert.ph")
                .fullName("Driver")
                .passwordHash("x")
                .role(Role.DRIVER)
                .status(UserStatus.SUSPENDED)
                .enabled(false)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .provider(AuthProvider.LOCAL)
                .build();
        when(users.findByFirebaseUid("uid-2")).thenReturn(Optional.of(suspendedDriver));

        assertThatThrownBy(() -> service.authenticateWithFirebase("id-token-2", "MOBILE", null))
                .hasMessageContaining("suspended");
    }

    @Test
    void staffIsDeniedWhenSelectedBranchDoesNotMatchAssignedBranch() {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        FirestoreSyncService firestoreSyncService = mock(FirestoreSyncService.class);
        FirestoreReadService firestoreReadService = mock(FirestoreReadService.class);
        DataReadProperties dataReadProperties = new DataReadProperties();
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

        FirebaseToken token = mock(FirebaseToken.class);
        when(token.getUid()).thenReturn("uid-3");
        when(token.getEmail()).thenReturn("staff@washalert.ph");
        when(firebaseIdentityService.verifyIdToken("id-token-3")).thenReturn(token);

        User staff = User.builder()
                .id(3L)
                .firebaseUid("uid-3")
                .email("staff@washalert.ph")
                .fullName("Staff")
                .passwordHash("x")
                .role(Role.STAFF)
                .status(UserStatus.ACTIVE)
                .enabled(true)
                .branch("SpeedyWash - Pasig")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .provider(AuthProvider.LOCAL)
                .build();
        when(users.findByFirebaseUid("uid-3")).thenReturn(Optional.of(staff));

        assertThatThrownBy(() -> service.authenticateWithFirebase("id-token-3", "WEB", "SpeedyWash - UP Diliman"))
                .hasMessageContaining("not assigned to this branch");
    }
}
