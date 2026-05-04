package com.washalert.washalertbackend.auth;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import com.washalert.washalertbackend.user.UserStatus;
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
public class StaffInvitationService {

    private final StaffInvitationTokenRepository invitationTokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final StaffInvitationProperties props;
    private final FirebaseIdentityService firebaseIdentityService;
    private final PersistentTokenRepository rememberMeTokenRepository;
    private final FirestoreSyncService firestoreSyncService;

    public StaffInvitationService(
            StaffInvitationTokenRepository invitationTokenRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            MailService mailService,
            StaffInvitationProperties props,
            FirebaseIdentityService firebaseIdentityService,
            PersistentTokenRepository rememberMeTokenRepository,
            FirestoreSyncService firestoreSyncService
    ) {
        this.invitationTokenRepository = invitationTokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.props = props;
        this.firebaseIdentityService = firebaseIdentityService;
        this.rememberMeTokenRepository = rememberMeTokenRepository;
        this.firestoreSyncService = firestoreSyncService;
    }

    @Transactional
    public void createAndSendInvitation(User user) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("Unable to send invitation.");
        }

        invitationTokenRepository.deleteByUser_Id(user.getId());

        String rawToken = generateRawToken(props.getTokenBytes());
        String tokenHash = sha256Hex(rawToken);

        LocalDateTime now = LocalDateTime.now();
        StaffInvitationToken token = StaffInvitationToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .createdAt(now)
                .expiresAt(now.plusMinutes(props.getTtlMinutes()))
                .usedAt(null)
                .build();

        invitationTokenRepository.save(token);

        String base = trimTrailingSlash(props.getFrontendBaseUrl());
        String path = props.getSetPasswordPath().startsWith("/")
                ? props.getSetPasswordPath()
                : "/" + props.getSetPasswordPath();
        String link = base + path + "?token=" + rawToken;

        mailService.sendStaffInvitationEmail(user.getEmail(), user.getFullName(), link);
    }

    @Transactional
    public void setInitialPassword(String rawToken, String newPassword) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Invalid or expired invitation token.");
        }

        StaffInvitationToken token = invitationTokenRepository.findByTokenHash(sha256Hex(rawToken))
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired invitation token."));

        LocalDateTime now = LocalDateTime.now();
        if (token.isUsed()) {
            throw new IllegalArgumentException("This invitation link has already been used.");
        }
        if (token.isExpired(now)) {
            throw new IllegalArgumentException("Invitation link expired. Please ask an admin to resend an invite.");
        }

        User user = token.getUser();
        if (hasComparablePasswordHash(user.getPasswordHash()) && passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Please choose a different password.");
        }

        if (user.getFirebaseUid() != null && !user.getFirebaseUid().isBlank()) {
            firebaseIdentityService.updateUserPassword(user.getFirebaseUid(), newPassword);
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setStatus(UserStatus.ACTIVE);
        user.setEnabled(true);
        user.setMustChangePassword(false);
        user.setActivatedAt(now);
        user.setVerifiedAt(now);
        User saved = userRepository.save(user);
        firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));

        token.setUsedAt(now);
        invitationTokenRepository.save(token);
        invitationTokenRepository.deleteByUser_Id(user.getId());
        rememberMeTokenRepository.removeUserTokens(user.getEmail());
    }

    @Transactional
    public long cleanupExpiredTokens() {
        LocalDateTime now = LocalDateTime.now();
        long expired = invitationTokenRepository.deleteByExpiresAtBefore(now.minusDays(1));
        long used = invitationTokenRepository.deleteByUsedAtIsNotNullAndUsedAtBefore(now.minusDays(1));
        return expired + used;
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
