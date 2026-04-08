package com.washalert.washalertbackend.auth;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import com.washalert.washalertbackend.verification.MailService;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.rememberme.PersistentTokenRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;

@Service
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final PasswordResetProperties props;
    private final PersistentTokenRepository rememberMeTokenRepository;
    private final FirestoreSyncService firestoreSyncService;

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetTokenRepository tokenRepository,
            PasswordEncoder passwordEncoder,
            MailService mailService,
            PasswordResetProperties props,
            PersistentTokenRepository rememberMeTokenRepository,
            FirestoreSyncService firestoreSyncService
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.props = props;
        this.rememberMeTokenRepository = rememberMeTokenRepository;
        this.firestoreSyncService = firestoreSyncService;
    }

    @Transactional
    public void createAndSendResetToken(String email) {
        String clean = (email == null) ? "" : email.trim().toLowerCase();

        User user = userRepository.findByEmail(clean).orElse(null);
        if (user == null) return;
        if (!user.isEnabled()) return;

        tokenRepository.deleteByUser_Id(user.getId());

        String rawToken = generateRawToken(props.getTokenBytes());
        String tokenHash = sha256Hex(rawToken);

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expires = now.plusMinutes(props.getTtlMinutes());

        PasswordResetToken prt = PasswordResetToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .createdAt(now)
                .expiresAt(expires)
                .usedAt(null)
                .build();

        tokenRepository.save(prt);

        String base = trimTrailingSlash(props.getFrontendBaseUrl());
        String path = props.getResetPath().startsWith("/") ? props.getResetPath() : "/" + props.getResetPath();
        String link = base + path + "?token=" + rawToken;

        mailService.sendPasswordResetEmail(user.getEmail(), link);
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Invalid or expired reset token.");
        }

        String tokenHash = sha256Hex(rawToken);
        PasswordResetToken prt = tokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired reset token."));

        LocalDateTime now = LocalDateTime.now();

        if (prt.isUsed()) {
            throw new IllegalArgumentException("This reset link has already been used.");
        }
        if (prt.isExpired(now)) {
            throw new IllegalArgumentException("Reset link expired. Please request a new one.");
        }

        User user = prt.getUser();
        if (hasComparablePasswordHash(user.getPasswordHash()) && passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different from your current password.");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        User saved = userRepository.save(user);
        firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));

        prt.setUsedAt(now);
        tokenRepository.save(prt);
        tokenRepository.deleteByUser_Id(user.getId());

        rememberMeTokenRepository.removeUserTokens(user.getEmail());
    }

    @Transactional
    public long cleanupExpiredTokens() {
        return tokenRepository.deleteByExpiresAtBefore(LocalDateTime.now().minusDays(1));
    }

    private static String generateRawToken(int tokenBytes) {
        int bytesLen = (tokenBytes > 0) ? tokenBytes : 32;
        byte[] bytes = new byte[bytesLen];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private static String trimTrailingSlash(String s) {
        if (s == null) return "";
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    private static boolean hasComparablePasswordHash(String passwordHash) {
        return passwordHash != null && passwordHash.startsWith("$2");
    }
}
