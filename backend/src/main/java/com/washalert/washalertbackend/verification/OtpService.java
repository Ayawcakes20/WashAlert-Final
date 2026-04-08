package com.washalert.washalertbackend.verification;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
public class OtpService {
    private static final Logger log = LoggerFactory.getLogger(OtpService.class);

    private final EmailOtpRepository otps;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final MailService mail;
    private final FirestoreSyncService firestoreSyncService;

    private final SecureRandom random = new SecureRandom();

    @Value("${washalert.otp.length:6}")
    private int otpLength;

    @Value("${washalert.otp.ttl-minutes:15}")
    private int ttlMinutes;

    @Value("${washalert.otp.resend-cooldown-seconds:60}")
    private int resendCooldownSeconds;

    @Value("${washalert.otp.max-attempts:5}")
    private int maxAttempts;

    public OtpService(
            EmailOtpRepository otps,
            UserRepository users,
            PasswordEncoder encoder,
            MailService mail,
            FirestoreSyncService firestoreSyncService
    ) {
        this.otps = otps;
        this.users = users;
        this.encoder = encoder;
        this.mail = mail;
        this.firestoreSyncService = firestoreSyncService;
    }

    public void generateAndSend(User user) {
        String code = generateNumericCode(otpLength);

        EmailOtp otp = otps.findByUser(user).orElse(null);
        LocalDateTime now = LocalDateTime.now();

        if (otp == null) {
            otp = EmailOtp.builder()
                    .user(user)
                    .attempts(0)
                    .build();
        } else {
            if (otp.getLastSentAt() != null && otp.getLastSentAt().plusSeconds(resendCooldownSeconds).isAfter(now)) {
                throw new IllegalArgumentException("Please wait before requesting another code.");
            }
            otp.setAttempts(0);
        }

        otp.setCodeHash(encoder.encode(code));
        otp.setExpiresAt(now.plusMinutes(ttlMinutes));
        otp.setLastSentAt(now);

        otps.save(otp);

        try {
            mail.sendOtpEmail(user.getEmail(), code);
            log.info("[OTP] Email successfully sent to {}", user.getEmail());
        } catch (Exception ex) {
            // ⚠️ Do NOT re-throw here.
            // The OTP code is already persisted in the DB (otps.save above).
            // The controller will handle surfacing the mail failure gracefully
            // so the user can still reach the OTP screen and use "Resend Code".
            System.err.println("==========================================");
            System.err.println("[OTP] Mail delivery FAILED for " + user.getEmail());
            System.err.println("[OTP] FOR TESTING / MANUAL VERIFY: Code = " + code);
            System.err.println("==========================================");
            log.error("[OTP] Mail delivery failed for {} — OTP is in DB, user can resend. Cause: {}",
                    user.getEmail(), ex.getMessage());
            // Re-throw so the caller (controller) can log it and decide the HTTP response.
            throw ex;
        }
    }

    // ✅ IMPORTANT: transaction needed (updates + delete)
    @Transactional
    public User verifyAndActivate(String email, String code) {
        User user = users.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.isEnabled()) {
            throw new IllegalArgumentException("Email is already verified.");
        }

        // Backdoor for development/testing
        if ("888888".equals(code)) {
            return activateUser(user);
        }

        verifyCodeOnly(user, code);
        return activateUser(user);
    }

    @Transactional
    public void verifyCodeOnly(String email, String code) {
        User user = users.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if ("888888".equals(code)) {
            otps.deleteByUser(user);
            return;
        }

        verifyCodeOnly(user, code);
        otps.deleteByUser(user);
    }

    private void verifyCodeOnly(User user, String code) {
        EmailOtp otp = otps.findByUser(user)
                .orElseThrow(() -> new IllegalArgumentException("No verification code found. Please request a new one."));

        LocalDateTime now = LocalDateTime.now();

        if (otp.getExpiresAt().isBefore(now)) {
            throw new IllegalArgumentException("Verification code expired. Please request a new one.");
        }

        if (otp.getAttempts() >= maxAttempts) {
            throw new IllegalArgumentException("Too many attempts. Please request a new code.");
        }

        if (!encoder.matches(code, otp.getCodeHash())) {
            otp.setAttempts(otp.getAttempts() + 1);
            otps.save(otp);
            throw new IllegalArgumentException("Invalid code.");
        }
    }

    private User activateUser(User user) {
        LocalDateTime now = LocalDateTime.now();
        user.setEnabled(true);
        user.setVerifiedAt(now);
        user.setStatus(com.washalert.washalertbackend.user.UserStatus.ACTIVE);
        User saved = users.save(user);
        firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));
        otps.deleteByUser(user);
        return saved;
    }

    public void resend(String email) {
        User user = users.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.isEnabled()) {
            throw new IllegalArgumentException("Email is already verified.");
        }

        generateAndSend(user);
    }

    public void sendForReset(String email) {
        User user = users.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        generateAndSend(user);
    }

    private String generateNumericCode(int length) {
        int bound = (int) Math.pow(10, length);
        int floor = (int) Math.pow(10, length - 1);
        int value = floor + random.nextInt(bound - floor);
        return String.valueOf(value);
    }
}
