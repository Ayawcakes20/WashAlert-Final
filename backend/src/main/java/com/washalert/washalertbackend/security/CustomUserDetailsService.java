package com.washalert.washalertbackend.security;

import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository users;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;

    public CustomUserDetailsService(
            UserRepository users,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties
    ) {
        this.users = users;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        String normalized = (email == null) ? "" : email.trim().toLowerCase();

        if (!dataReadProperties.prefersFirestoreReads()) {
            return loadFromMysql(normalized);
        }

        Optional<FirestoreReadService.FirestoreUserRecord> firestoreUser = firestoreReadService.findUserByEmail(normalized);
        if (firestoreUser.isPresent() && hasPasswordHash(firestoreUser.get())) {
            return new AuthUserDetails(toUser(firestoreUser.get()));
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            return loadFromMysql(normalized);
        }

        throw new UsernameNotFoundException("User not found");
    }

    private UserDetails loadFromMysql(String normalizedEmail) {
        return users.findByEmail(normalizedEmail)
                .map(AuthUserDetails::new)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    private boolean hasPasswordHash(FirestoreReadService.FirestoreUserRecord record) {
        return record.passwordHash() != null && !record.passwordHash().isBlank();
    }

    private User toUser(FirestoreReadService.FirestoreUserRecord record) {
        return User.builder()
                .id(record.id())
                .email(record.email())
                .fullName(record.fullName())
                .passwordHash(record.passwordHash())
                .role(parseRole(record.role()))
                .enabled(Boolean.TRUE.equals(record.enabled()))
                .mustChangePassword(Boolean.TRUE.equals(record.mustChangePassword()))
                .verifiedAt(record.verifiedAt())
                .createdAt(record.createdAt())
                .branch(record.branch())
                .provider(parseProvider(record.provider()))
                .build();
    }

    private Role parseRole(String value) {
        try {
            return Role.valueOf(value);
        } catch (Exception ex) {
            return Role.STAFF;
        }
    }

    private AuthProvider parseProvider(String value) {
        try {
            return AuthProvider.valueOf(value);
        } catch (Exception ex) {
            return AuthProvider.LOCAL;
        }
    }
}
