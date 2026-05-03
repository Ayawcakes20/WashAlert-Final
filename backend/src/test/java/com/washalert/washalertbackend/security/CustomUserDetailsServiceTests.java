package com.washalert.washalertbackend.security;

import com.washalert.washalertbackend.common.DataReadMode;
import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CustomUserDetailsServiceTests {

    @Test
    void usesFirestoreUserWhenReadModeIsFirestoreAndPasswordHashExists() {
        UserRepository userRepository = mock(UserRepository.class);
        FirestoreReadService firestoreReadService = mock(FirestoreReadService.class);
        DataReadProperties props = new DataReadProperties();
        props.setReadMode(DataReadMode.FIRESTORE);

        FirestoreReadService.FirestoreUserRecord firestoreUser = new FirestoreReadService.FirestoreUserRecord(
                10L,
                "staff@example.com",
                "Staff One",
                null,
                null,
                "STAFF",
                "Light Residences",
                true,
                false,
                "LOCAL",
                LocalDateTime.now(),
                LocalDateTime.now(),
                "encoded-password"
        );

        when(firestoreReadService.findUserByEmail("staff@example.com")).thenReturn(Optional.of(firestoreUser));

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository, firestoreReadService, props);
        AuthUserDetails details = (AuthUserDetails) service.loadUserByUsername("staff@example.com");

        assertThat(details.getUser().getEmail()).isEqualTo("staff@example.com");
        assertThat(details.getPassword()).isEqualTo("encoded-password");
        assertThat(details.getUser().getRole()).isEqualTo(Role.STAFF);
        assertThat(details.getUser().getProvider()).isEqualTo(AuthProvider.LOCAL);
    }

    @Test
    void fallsBackToMysqlWhenHybridAndFirestoreHasNoUsablePasswordHash() {
        UserRepository userRepository = mock(UserRepository.class);
        FirestoreReadService firestoreReadService = mock(FirestoreReadService.class);
        DataReadProperties props = new DataReadProperties();
        props.setReadMode(DataReadMode.HYBRID);

        FirestoreReadService.FirestoreUserRecord firestoreUser = new FirestoreReadService.FirestoreUserRecord(
                10L,
                "staff@example.com",
                "Staff One",
                null,
                null,
                "STAFF",
                "Light Residences",
                true,
                false,
                "LOCAL",
                LocalDateTime.now(),
                LocalDateTime.now(),
                null
        );
        when(firestoreReadService.findUserByEmail("staff@example.com")).thenReturn(Optional.of(firestoreUser));

        User mysqlUser = User.builder()
                .id(11L)
                .email("staff@example.com")
                .fullName("Mysql Staff")
                .passwordHash("mysql-hash")
                .role(Role.STAFF)
                .provider(AuthProvider.LOCAL)
                .enabled(true)
                .mustChangePassword(false)
                .createdAt(LocalDateTime.now())
                .build();
        when(userRepository.findByEmail("staff@example.com")).thenReturn(Optional.of(mysqlUser));

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository, firestoreReadService, props);
        AuthUserDetails details = (AuthUserDetails) service.loadUserByUsername("staff@example.com");

        assertThat(details.getUser().getId()).isEqualTo(11L);
        assertThat(details.getPassword()).isEqualTo("mysql-hash");
    }

    @Test
    void throwsWhenFirestoreStrictAndRecordMissing() {
        UserRepository userRepository = mock(UserRepository.class);
        FirestoreReadService firestoreReadService = mock(FirestoreReadService.class);
        DataReadProperties props = new DataReadProperties();
        props.setReadMode(DataReadMode.FIRESTORE);
        when(firestoreReadService.findUserByEmail("missing@example.com")).thenReturn(Optional.empty());

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository, firestoreReadService, props);

        assertThatThrownBy(() -> service.loadUserByUsername("missing@example.com"))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
