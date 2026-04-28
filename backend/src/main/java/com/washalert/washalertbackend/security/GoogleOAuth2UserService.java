package com.washalert.washalertbackend.security;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Service
public class GoogleOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final FirestoreSyncService firestoreSyncService;

    public GoogleOAuth2UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            FirestoreSyncService firestoreSyncService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.firestoreSyncService = firestoreSyncService;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauth = super.loadUser(userRequest);

        Map<String, Object> attrs = oauth.getAttributes();
        String email = attrs.get("email") == null ? null : String.valueOf(attrs.get("email")).trim().toLowerCase();
        String name = attrs.get("name") == null ? null : String.valueOf(attrs.get("name")).trim();

        if (email == null || email.isBlank()) {
            throw new OAuth2AuthenticationException("Missing email from Google profile");
        }

        User u = userRepository.findByEmail(email).orElseGet(() -> {
            LocalDateTime now = LocalDateTime.now();
            String random = UUID.randomUUID() + ":" + UUID.randomUUID();

            User created = User.builder()
                    .email(email)
                    .fullName((name == null || name.isBlank()) ? email : name)
                    .role(Role.STAFF)
                    .branch("Makati Branch")
                    .provider(AuthProvider.GOOGLE)
                    .enabled(true)
                    .verifiedAt(now)
                    .mustChangePassword(true)
                    .passwordHash(passwordEncoder.encode(random))
                    .createdAt(now)
                    .build();

            User saved = userRepository.save(created);
            firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));
            return saved;
        });

        return new AuthUserDetails(u, attrs);
    }
}
