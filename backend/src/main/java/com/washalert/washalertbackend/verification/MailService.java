package com.washalert.washalertbackend.verification;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private static final AtomicInteger LOGIN_OTP_WORKER_COUNTER = new AtomicInteger(1);
    private static final String RESEND_EMAILS_URL = "https://api.resend.com/emails";

    private final JavaMailSender mailSender;
    private final ThreadPoolExecutor loginOtpExecutor = new ThreadPoolExecutor(
            1,
            2,
            60L,
            TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(200),
            runnable -> {
                Thread worker = new Thread(runnable);
                worker.setName("washalert-login-otp-mail-" + LOGIN_OTP_WORKER_COUNTER.getAndIncrement());
                worker.setDaemon(true);
                return worker;
            },
            new ThreadPoolExecutor.AbortPolicy()
    );

    @Value("${washalert.mail.from}")
    private String from;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.port:}")
    private String mailPort;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${RESEND_API_KEY:}")
    private String resendApiKey;

    public MailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @PostConstruct
    void logMailConfiguration() {
        boolean resendConfigured = hasText(resolveResendApiKey());
        log.info(
                "[MAIL] Configuration loaded host={} port={} from={} authUserConfigured={} resendApiConfigured={}",
                display(mailHost),
                display(mailPort),
                display(from),
                hasText(mailUsername),
                resendConfigured
        );

        if (!hasText(from)) {
            log.error("[MAIL] Sender address is not configured. Set MAIL_FROM.");
        }
        if (!resendConfigured && !hasText(mailUsername)) {
            log.error("[MAIL] SMTP username is not configured. Set MAIL_USERNAME (Resend expects 'resend').");
        }
    }

    public void sendOtpEmail(String to, String code) {
        validateResendMailBasics();
        try {
            log.info("[MAIL][OTP] Dispatching OTP email to {}", maskEmail(to));
            String plainText = """
                    Your WashAlert verification code is:

                    %s

                    This code expires soon. If you did not request this, ignore this email.
                    """.formatted(code);
            String html = """
                    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
                      <p style="margin:0 0 12px 0;">Your WashAlert verification code is:</p>
                      <p style="margin:0 0 16px 0;font-size:28px;font-weight:700;letter-spacing:4px;">%s</p>
                      <p style="margin:0 0 8px 0;">This code expires soon.</p>
                      <p style="margin:0;">If you did not request this, ignore this email.</p>
                    </div>
                    """.formatted(code);
            sendViaResendApi(to, "WashAlert Email Verification Code", plainText, html);
            log.info("[MAIL][OTP] OTP email dispatch succeeded to {}", maskEmail(to));
        } catch (RuntimeException ex) {
            throw toMailDispatchException("OTP", to, ex);
        }
    }

    @PreDestroy
    void shutdownExecutors() {
        loginOtpExecutor.shutdown();
    }

    public void sendLoginOtpEmail(String to, String code) {
        validateResendMailBasics();
        sendLoginOtpEmailInternal(to, code);
    }

    public void queueLoginOtpEmail(String to, String code) {
        validateResendMailBasics();
        String masked = maskEmail(to);
        try {
            log.info("[MAIL][LOGIN_OTP] Queueing async login OTP email for {}", masked);
            loginOtpExecutor.execute(() -> {
                try {
                    sendLoginOtpEmailInternal(to, code);
                } catch (RuntimeException ex) {
                    log.error("[MAIL][LOGIN_OTP] Async login OTP email dispatch failed for {}", masked, ex);
                }
            });
            log.info("[MAIL][LOGIN_OTP] Async login OTP email queued for {}", masked);
        } catch (RejectedExecutionException ex) {
            throw new IllegalStateException("Login OTP email queue is busy. Please retry in a moment.", ex);
        }
    }

    private void sendLoginOtpEmailInternal(String to, String code) {
        try {
            log.info("[MAIL][LOGIN_OTP] Dispatching login OTP email to {}", maskEmail(to));
            String plainText = """
                    Your WashAlert login code is:

                    %s

                    This code expires soon and can only be used once.
                    If you did not attempt to sign in, ignore this email.
                    """.formatted(code);
            String html = """
                    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
                      <p style="margin:0 0 12px 0;">Your WashAlert login code is:</p>
                      <p style="margin:0 0 16px 0;font-size:28px;font-weight:700;letter-spacing:4px;">%s</p>
                      <p style="margin:0 0 8px 0;">This code expires soon and can only be used once.</p>
                      <p style="margin:0;">If you did not attempt to sign in, ignore this email.</p>
                    </div>
                    """.formatted(code);
            sendViaResendApi(to, "WashAlert Login Verification Code", plainText, html);
            log.info("[MAIL][LOGIN_OTP] Login OTP email dispatch succeeded to {}", maskEmail(to));
        } catch (RuntimeException ex) {
            throw toMailDispatchException("LOGIN_OTP", to, ex);
        } catch (Exception ex) {
            throw toMailDispatchException("LOGIN_OTP", to, ex);
        }
    }

    private void sendViaResendApi(String to, String subject, String plainText, String html) {
        String apiKey = resolveResendApiKey();
        if (!hasText(apiKey)) {
            log.warn("[MAIL] RESEND_API_KEY is missing. Skipping send for {}", maskEmail(to));
            return;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "from", from,
                "to", List.of(to),
                "subject", subject,
                "html", html,
                "text", plainText
        );

        try {
            RestTemplate restTemplate = new RestTemplate();
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(RESEND_EMAILS_URL, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("[MAIL] Resend API success");
            } else {
                log.error("[MAIL] Resend API failed: {}", response.getStatusCode().value());
                throw new IllegalStateException("Resend API returned non-success status.");
            }
        } catch (RestClientException ex) {
            log.error("[MAIL] Resend API failed: {}", ex.getMessage());
            throw new IllegalStateException("Resend API request failed.", ex);
        }
    }

    public void sendPasswordResetEmail(String to, String resetLink) {
        validateMailBasics();
        try {
            log.info("[MAIL][RESET] Dispatching password reset email to {}", maskEmail(to));
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject("WashAlert Password Reset");
            msg.setText("""
                    We received a request to reset your WashAlert password.

                    Reset your password using this link:
                    %s

                    This link expires soon. If you did not request this, you can ignore this email.
                    """.formatted(resetLink));

            mailSender.send(msg);
            log.info("[MAIL][RESET] Password reset email dispatch succeeded to {}", maskEmail(to));
        } catch (RuntimeException ex) {
            throw toMailDispatchException("RESET", to, ex);
        }
    }

    public void sendStaffInvitationEmail(String to, String fullName, String setPasswordLink) {
        validateMailBasics();
        try {
            log.info("[MAIL][INVITE] Dispatching invitation email to {}", maskEmail(to));
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject("WashAlert Staff Account Invitation");
            msg.setText("""
                    Hi %s,

                    Your administrator created a WashAlert staff account for you.

                    Set your password using this one-time link:
                    %s

                    This link expires soon and can only be used once.
                    If you were not expecting this invite, please contact your administrator.
                    """.formatted(fullName == null ? "there" : fullName, setPasswordLink));

            mailSender.send(msg);
            log.info("[MAIL][INVITE] Invitation email dispatch succeeded to {}", maskEmail(to));
        } catch (RuntimeException ex) {
            throw toMailDispatchException("INVITE", to, ex);
        }
    }

    public void sendGeneralEmail(String to, String subject, String body) {
        validateMailBasics();
        try {
            log.info("[MAIL][GENERAL] Dispatching email to {}", maskEmail(to));
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(body);
            mailSender.send(msg);
            log.info("[MAIL][GENERAL] Email dispatch succeeded to {}", maskEmail(to));
        } catch (RuntimeException ex) {
            throw toMailDispatchException("GENERAL", to, ex);
        }
    }

    private void validateMailBasics() {
        if (!hasText(from)) {
            throw new IllegalStateException("Mail sender is not configured. Set MAIL_FROM.");
        }
        if (!hasText(mailHost) || !hasText(mailPort)) {
            throw new IllegalStateException("Mail SMTP host/port is not configured. Set MAIL_HOST and MAIL_PORT.");
        }
        if (!hasText(mailUsername)) {
            throw new IllegalStateException("Mail SMTP username is missing. Set MAIL_USERNAME (Resend expects 'resend').");
        }

        String senderEmail = extractSenderEmail(from);
        if (!senderEmail.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalStateException("MAIL_FROM is invalid. Use a valid sender email, optionally as 'Name <email@domain>'.");
        }
        if (senderEmail.contains("your_verified_domain") || senderEmail.endsWith("@example.com")) {
            throw new IllegalStateException("MAIL_FROM is still using a placeholder domain. Use a verified Resend sender domain.");
        }
    }

    private void validateResendMailBasics() {
        if (!hasText(from)) {
            throw new IllegalStateException("Mail sender is not configured. Set MAIL_FROM.");
        }
        String senderEmail = extractSenderEmail(from);
        if (!senderEmail.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalStateException("MAIL_FROM is invalid. Use a valid sender email, optionally as 'Name <email@domain>'.");
        }
        if (senderEmail.contains("your_verified_domain") || senderEmail.endsWith("@example.com")) {
            throw new IllegalStateException("MAIL_FROM is still using a placeholder domain. Use a verified Resend sender domain.");
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String display(String value) {
        return hasText(value) ? value.trim() : "<unset>";
    }

    private String extractSenderEmail(String rawFrom) {
        String trimmed = rawFrom == null ? "" : rawFrom.trim().toLowerCase();
        int lt = trimmed.indexOf('<');
        int gt = trimmed.indexOf('>');
        if (lt >= 0 && gt > lt) {
            return trimmed.substring(lt + 1, gt).trim();
        }
        return trimmed;
    }

    private IllegalStateException toMailDispatchException(String flow, String to, Exception ex) {
        String reason = classifyMailFailure(ex);
        log.error("[MAIL][{}] Dispatch failed for {}: {}", flow, maskEmail(to), reason, ex);
        return new IllegalStateException(reason, ex);
    }

    private String classifyMailFailure(Exception ex) {
        String message = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();

        if (message.contains("resend api")
                || message.contains("resend")
                || message.contains("api.resend.com")) {
            return "Email dispatch failed at Resend API. Check RESEND_API_KEY and provider logs.";
        }

        if (ex instanceof MailAuthenticationException
                || message.contains("535")
                || (message.contains("auth") && message.contains("fail"))) {
            return "SMTP authentication failed. Check MAIL_USERNAME and MAIL_PASSWORD.";
        }

        if (message.contains("sender address rejected")
                || message.contains("from address rejected")
                || message.contains("5.7.1")
                || message.contains("550")
                || message.contains("554")) {
            return "MAIL_FROM was rejected by SMTP. Use a sender from a verified Resend domain.";
        }

        if (message.contains("unknownhost")
                || message.contains("connection refused")
                || message.contains("could not connect")) {
            return "SMTP connection failed. Check MAIL_HOST and MAIL_PORT.";
        }

        if (message.contains("timed out") || message.contains("timeout")) {
            return "SMTP connection timed out. Check network/firewall and MAIL_HOST/MAIL_PORT.";
        }

        return "Email dispatch failed at SMTP provider. Check mail configuration and provider logs.";
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

    private String resolveResendApiKey() {
        if (hasText(resendApiKey)) {
            return resendApiKey.trim();
        }
        String envApiKey = System.getenv("RESEND_API_KEY");
        return hasText(envApiKey) ? envApiKey.trim() : null;
    }
}
