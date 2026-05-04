package com.washalert.washalertbackend.auth;

import com.google.firebase.auth.FirebaseToken;
import com.washalert.washalertbackend.auth.dto.AuthSessionResponse;
import com.washalert.washalertbackend.auth.dto.MeResponse;
import com.washalert.washalertbackend.auth.dto.RegisterRequest;
import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.*;
import com.washalert.washalertbackend.verification.OtpService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final FirestoreSyncService firestoreSyncService;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;
    private final FirebaseIdentityService firebaseIdentityService;
    private final OtpService otpService;
    private final PasswordResetService passwordResetService;

    public AuthService(
            UserRepository users,
            PasswordEncoder encoder,
            FirestoreSyncService firestoreSyncService,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties,
            FirebaseIdentityService firebaseIdentityService,
            OtpService otpService,
            PasswordResetService passwordResetService
    ) {
        this.users = users;
        this.encoder = encoder;
        this.firestoreSyncService = firestoreSyncService;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
        this.firebaseIdentityService = firebaseIdentityService;
        this.otpService = otpService;
        this.passwordResetService = passwordResetService;
    }

    public void register(RegisterRequest req) {
        throw new IllegalArgumentException("Internal web self-registration is disabled. Use the mobile app signup flow.");
    }

    public User upsertMobileCustomerProfile(String idToken, String fullName) {
        FirebaseToken token = firebaseIdentityService.verifyIdToken(idToken);
        String email = normalizeEmail(token.getEmail());
        log.info("[AUTH][REGISTER] upsertMobileCustomerProfile uid={} email={}", token.getUid(), maskEmail(email));
        if (email.isBlank()) {
            throw new IllegalArgumentException("Firebase token does not contain an email.");
        }

        User existing = users.findByFirebaseUid(token.getUid())
                .or(() -> users.findByEmail(email))
                .orElse(null);

        if (existing != null) {
            if (existing.getRole() != Role.CUSTOMER) {
                throw new IllegalArgumentException("This account is not allowed to use customer signup.");
            }
            if (existing.getStatus() == UserStatus.ACTIVE && existing.isEnabled()) {
                throw new IllegalArgumentException("This email is already registered and verified. Please log in.");
            }
            existing.setFirebaseUid(token.getUid());
            existing.setEmail(email);
            existing.setFullName(fullName.trim());
            // Transition back to PENDING if they were not ACTIVE
            if (existing.getStatus() != UserStatus.ACTIVE) {
                existing.setStatus(UserStatus.PENDING);
                existing.setEnabled(false);
            }
            User saved = users.save(existing);
            syncUserToFirestore(saved);
            log.info("[AUTH][REGISTER] Existing customer profile saved id={} role={} status={} enabled={}",
                    saved.getId(), saved.getRole(), saved.getStatus(), saved.isEnabled());
            return saved;
        }

        LocalDateTime now = LocalDateTime.now();
        User customer = User.builder()
                .firebaseUid(token.getUid())
                .email(email)
                .fullName(fullName.trim())
                .passwordHash(encoder.encode("firebase-managed-" + token.getUid()))
                .role(Role.CUSTOMER)
                .status(UserStatus.PENDING) // Must be PENDING to trigger OTP
                .enabled(false) // Must be false to trigger OTP
                .mustChangePassword(false)
                .provider(AuthProvider.LOCAL)
                .createdAt(now)
                .updatedAt(now)
                .build();

        User saved = users.save(customer);
        syncUserToFirestore(saved);
        log.info("[AUTH][REGISTER] New customer profile saved id={} role={} status={} enabled={}",
                saved.getId(), saved.getRole(), saved.getStatus(), saved.isEnabled());
        return saved;
    }

    public User authenticateWithFirebase(String idToken, String platform, String selectedBranch) {
        User resolved = resolveFirebaseUserForLoginChallenge(idToken, platform, selectedBranch);
        return markLoginSuccess(resolved.getId());
    }

    public User resolveFirebaseUserForLoginChallenge(String idToken, String platform, String selectedBranch) {
        FirebaseToken token = firebaseIdentityService.verifyIdToken(idToken);
        String email = normalizeEmail(token.getEmail());
        log.info("[AUTH][LOGIN] authenticateWithFirebase uid={} email={} platform={}",
                token.getUid(), maskEmail(email), platform);
        if (email.isBlank()) throw new IllegalArgumentException("Firebase token does not contain an email.");

        User user = users.findByFirebaseUid(token.getUid())
                .or(() -> users.findByEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Account profile not found."));

        if (user.getFirebaseUid() == null || user.getFirebaseUid().isBlank() || !user.getFirebaseUid().equals(token.getUid())) {
            log.info("Updating Firebase UID for {} from {} to {}", email, user.getFirebaseUid(), token.getUid());
            user.setFirebaseUid(token.getUid());
        }
        user.setEmail(email);

        // Internal accounts transition from PENDING to ACTIVE on first successful password setup/login.
        if ((user.getRole() == Role.STAFF || user.getRole() == Role.DRIVER || user.getRole() == Role.ADMIN)
                && user.getStatus() == UserStatus.PENDING) {
            LocalDateTime activatedAt = LocalDateTime.now();
            user.setStatus(UserStatus.ACTIVE);
            user.setActivatedAt(activatedAt);
            user.setVerifiedAt(user.getVerifiedAt() == null ? activatedAt : user.getVerifiedAt());
            user.setMustChangePassword(false);
        }

        enforceStatus(user);
        enforcePlatform(user, platform, selectedBranch);

        user.syncEnabledFromStatus();
        User saved = users.save(user);
        syncUserToFirestore(saved);
        log.info("[AUTH][LOGIN] Challenge profile resolved id={} role={} status={} enabled={}",
                saved.getId(), saved.getRole(), saved.getStatus(), saved.isEnabled());
        return saved;
    }

    public User markLoginSuccess(Long userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Account profile not found."));

        user.setLastLoginAt(LocalDateTime.now());
        user.syncEnabledFromStatus();
        User saved = users.save(user);
        syncUserToFirestore(saved);
        log.info("[AUTH][LOGIN] Login finalized id={} role={} status={} enabled={}",
                saved.getId(), saved.getRole(), saved.getStatus(), saved.isEnabled());
        return saved;
    }

    public void requestPasswordReset(String email) {
        String normalized = normalizeEmail(email);
        User user = users.findByEmail(normalized).orElse(null);
        if (user == null) {
            return;
        }

        try {
            passwordResetService.createAndSendResetToken(normalized);
            log.info("Password reset email dispatched for {}", normalized);
        } catch (Exception ex) {
            log.error("Failed to dispatch password reset email for {}", normalized, ex);
            throw new IllegalStateException(passwordResetFailureMessage(ex), ex);
        }
    }

    public void requestPasswordResetOtp(String email) {
        String normalized = normalizeEmail(email);
        users.findByEmail(normalized).orElseThrow(() -> new IllegalArgumentException("User not found."));

        log.info("Generating password reset OTP for {}", normalized);
        // This will reuse the verification infrastructure for resets
        otpService.sendForReset(normalized);
    }

    public void resetPasswordWithOtp(String email, String newPassword) {
        String normalized = normalizeEmail(email);
        User user = users.findByEmail(normalized)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        // 1. Update MySQL password hash (used for session validation fallback)
        user.setPasswordHash(encoder.encode(newPassword));
        user.setUpdatedAt(LocalDateTime.now());
        User saved = users.save(user);

        // 2. Update Firebase password so Firebase login works with the new credentials
        if (saved.getFirebaseUid() != null && !saved.getFirebaseUid().isBlank()) {
            try {
                firebaseIdentityService.updateUserPassword(saved.getFirebaseUid(), newPassword);
                log.info("Firebase password updated for {}", normalized);
            } catch (Exception ex) {
                // Log but don't fail — MySQL password is already updated
                log.error("Failed to update Firebase password for {} — user may need to use forgot-password again. Cause: {}", normalized, ex.getMessage());
            }
        } else {
            log.warn("User {} has no Firebase UID — Firebase password not updated. They must re-link their account.", normalized);
        }

        syncUserToFirestore(saved);
        log.info("Password successfully reset for {}", normalized);
    }

    public void completeInvitation(String idToken) {
        FirebaseToken token = firebaseIdentityService.verifyIdToken(idToken);
        String email = normalizeEmail(token.getEmail());

        User user = users.findByFirebaseUid(token.getUid())
                .or(() -> users.findByEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("Account profile not found."));

        if (!(user.getRole() == Role.STAFF || user.getRole() == Role.DRIVER || user.getRole() == Role.ADMIN)) {
            throw new IllegalArgumentException("Only internal accounts can complete invitation setup.");
        }

        if (user.getStatus() == UserStatus.PENDING) {
            LocalDateTime activatedAt = LocalDateTime.now();
            user.setStatus(UserStatus.ACTIVE);
            user.setActivatedAt(activatedAt);
            user.setVerifiedAt(user.getVerifiedAt() == null ? activatedAt : user.getVerifiedAt());
            user.setMustChangePassword(false);
            user.syncEnabledFromStatus();
            User saved = users.save(user);
            syncUserToFirestore(saved);
        }
    }

    public AuthSessionResponse toSessionResponse(User user, String platform) {
        return new AuthSessionResponse(
                user.getId(),
                user.getFirebaseUid(),
                user.getEmail(),
                user.getFullName(),
                user.getMobileNumber(),
                user.getProfileImageUrl(),
                user.getRole().name(),
                user.getStatus().name(),
                user.isMustChangePassword(),
                user.getBranchId(),
                user.getBranch(),
                allowedModules(user),
                platform
        );
    }

    public User completeMobileFirstLoginPasswordUpdate(String idToken, String platform) {
        User user = resolveFirebaseUserForLoginChallenge(idToken, platform, null);
        if (user.getRole() != Role.DRIVER) {
            throw new IllegalArgumentException("Only driver accounts can use first-login password completion.");
        }

        if (user.isMustChangePassword()) {
            user.setMustChangePassword(false);
            user.setUpdatedAt(LocalDateTime.now());
            User saved = users.save(user);
            syncUserToFirestore(saved);
            return markLoginSuccess(saved.getId());
        }

        return markLoginSuccess(user.getId());
    }

    public MeResponse me(AuthUserDetails principal) {
        Long id = principal.getUser().getId();

        if (!dataReadProperties.prefersFirestoreReads()) {
            User mysqlUser = users.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
            return toMeResponse(mysqlUser);
        }

        Optional<FirestoreReadService.FirestoreUserRecord> firestoreUser = firestoreReadService.findUserById(id);
        if (firestoreUser.isPresent()) {
            return toMeResponse(firestoreUser.get());
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            User mysqlUser = users.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
            return toMeResponse(mysqlUser);
        }

        throw new IllegalArgumentException("User not found");
    }

    public void syncUserToFirestore(User user) {
        firestoreSyncService.upsert("users", String.valueOf(user.getId()), FirestoreUserPayloadFactory.fromUser(user));
    }

    private void enforceStatus(User user) {
        if (user.getStatus() == UserStatus.PENDING) {
            throw new IllegalArgumentException("Your account is pending activation.");
        }
        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new IllegalArgumentException("Your account is suspended. Please contact admin.");
        }
        if (user.getStatus() == UserStatus.DEACTIVATED) {
            throw new IllegalArgumentException("Your account is deactivated. Please contact admin.");
        }
    }

    private void enforcePlatform(User user, String platform, String selectedBranch) {
        String normalized = platform == null ? "" : platform.trim().toUpperCase();

        if ("WEB".equals(normalized)) {
            if (!(user.getRole() == Role.ADMIN || user.getRole() == Role.STAFF)) {
                throw new IllegalArgumentException("This account is not allowed on web.");
            }
            enforceBranchAccessOnWeb(user, selectedBranch);
            return;
        }

        if ("MOBILE".equals(normalized)) {
            if (!(user.getRole() == Role.CUSTOMER || user.getRole() == Role.DRIVER)) {
                throw new IllegalArgumentException("This account is not allowed on mobile.");
            }
            return;
        }

        throw new IllegalArgumentException("Unsupported platform.");
    }

    private void enforceBranchAccessOnWeb(User user, String selectedBranch) {
        if (user.getRole() != Role.STAFF) {
            return;
        }

        String assignedBranch = normalizeBranch(user.getBranch());
        if (assignedBranch.isBlank()) {
            throw new IllegalArgumentException("Your staff account has no assigned branch. Please contact an administrator.");
        }
    }

    private List<String> allowedModules(User user) {
        return switch (user.getRole()) {
            case ADMIN -> List.of("dashboard", "users", "orders", "delivery", "inventory", "analytics", "machines");
            case STAFF -> List.of("dashboard", "orders", "delivery", "inventory", "analytics");
            case DRIVER -> List.of("driver-delivery");
            case CUSTOMER -> List.of("customer-booking", "customer-tracking", "customer-orders");
        };
    }

    private MeResponse toMeResponse(User u) {
        return new MeResponse(
                u.getId(),
                u.getFirebaseUid(),
                u.getEmail(),
                u.getFullName(),
                u.getMobileNumber(),
                u.getProfileImageUrl(),
                u.getRole().name(),
                u.getStatus().name(),
                u.getBranchId(),
                u.getBranch(),
                u.isEnabled(),
                u.isMustChangePassword(),
                u.getProvider().name()
        );
    }

    private MeResponse toMeResponse(FirestoreReadService.FirestoreUserRecord u) {
        return new MeResponse(
                u.id(),
                null,
                u.email(),
                u.fullName(),
                u.mobileNumber(),
                u.profileImageUrl(),
                u.role(),
                Boolean.TRUE.equals(u.enabled()) ? UserStatus.ACTIVE.name() : UserStatus.PENDING.name(),
                null,
                u.branch(),
                Boolean.TRUE.equals(u.enabled()),
                Boolean.TRUE.equals(u.mustChangePassword()),
                u.provider()
        );
    }

    private String normalizeEmail(String email) {
        return (email == null) ? "" : email.trim().toLowerCase();
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

    private String normalizeBranch(String branch) {
        return branch == null ? "" : branch.trim();
    }

    private String passwordResetFailureMessage(Exception ex) {
        return "We couldn't send the reset link right now. Please try again later.";
    }
}
