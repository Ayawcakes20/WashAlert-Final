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
import java.util.function.BiConsumer;

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
        generateAndSendInternal(user, "VERIFY", mail::sendOtpEmail);
    }

    public void sendForLogin(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User not found");
        }
        if (!user.isEnabled()) {
            throw new IllegalArgumentException("Your account is not active.");
        }
        generateAndSendInternal(user, "LOGIN", mail::sendLoginOtpEmail);
    }

    public void verifyLoginCode(String email, String code) {
        User user = users.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!user.isEnabled()) {
            throw new IllegalArgumentException("Your account is not active.");
        }

        verifyCodeOnly(user, code);
        otps.deleteByUser(user);
    }

    public int getTtlMinutes() {
        return ttlMinutes;
    }

    public int getResendCooldownSeconds() {
        return resendCooldownSeconds;
    }

    private void generateAndSendInternal(User user, String flow, BiConsumer<String, String> dispatcher) {
        String normalizedEmail = normalizeEmail(user.getEmail());
        log.info("[OTP][{}] Generating OTP for userId={} email={}", flow, user.getId(), maskEmail(normalizedEmail));

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

        EmailOtp savedOtp = otps.save(otp);
        log.info(
                "[OTP][{}] OTP persisted for userId={} otpId={} expiresAt={} lastSentAt={}",
                flow,
                user.getId(),
                savedOtp.getId(),
                savedOtp.getExpiresAt(),
                savedOtp.getLastSentAt()
        );

        try {
            dispatcher.accept(normalizedEmail, code);
            log.info("[OTP][{}] Email dispatch succeeded for userId={} email={}", flow, user.getId(), maskEmail(normalizedEmail));
        } catch (Exception ex) {
            log.error(
                    "[OTP][{}] Email dispatch failed for userId={} email={}. OTP remains persisted for retry.",
                    flow,
                    user.getId(),
                    maskEmail(normalizedEmail),
                    ex
            );
            throw ex;
        }
    }

    @Transactional
    public User verifyAndActivate(String email, String code) {
        User user = users.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.isEnabled()) {
            throw new IllegalArgumentException("Email is already verified.");
        }

        verifyCodeOnly(user, code);
        return activateUser(user);
    }

    @Transactional
    public void verifyCodeOnly(String email, String code) {
        User user = users.findByEmail(normalizeEmail(email))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

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
        String normalizedEmail = normalizeEmail(email);
        log.info("[OTP] Resend requested for {}", maskEmail(normalizedEmail));

        User user = users.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.isEnabled()) {
            throw new IllegalArgumentException("Email is already verified.");
        }

        generateAndSend(user);
    }

    public void sendForReset(String email) {
        String normalizedEmail = normalizeEmail(email);
        log.info("[OTP] Password reset OTP requested for {}", maskEmail(normalizedEmail));

        User user = users.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        generateAndSend(user);
    }

    private String generateNumericCode(int length) {
        int bound = (int) Math.pow(10, length);
        int floor = (int) Math.pow(10, length - 1);
        int value = floor + random.nextInt(bound - floor);
        return String.valueOf(value);
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
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
}
