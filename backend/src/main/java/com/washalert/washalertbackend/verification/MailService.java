package com.washalert.washalertbackend.verification;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender mailSender;

    @Value("${washalert.mail.from}")
    private String from;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${spring.mail.port:}")
    private String mailPort;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    public MailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @PostConstruct
    void logMailConfiguration() {
        log.info(
                "[MAIL] Configuration loaded host={} port={} from={} authUserConfigured={}",
                display(mailHost),
                display(mailPort),
                display(from),
                hasText(mailUsername)
        );

        if (!hasText(from)) {
            log.error("[MAIL] Sender address is not configured. Set MAIL_FROM.");
        }
        if (!hasText(mailUsername)) {
            log.error("[MAIL] SMTP username is not configured. Set MAIL_USERNAME (Resend expects 'resend').");
        }
    }

    public void sendOtpEmail(String to, String code) {
        validateMailBasics();
        try {
            log.info("[MAIL][OTP] Dispatching OTP email to {}", maskEmail(to));
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject("WashAlert Email Verification Code");
            msg.setText("""
                    Your WashAlert verification code is:

                    %s

                    This code expires soon. If you did not request this, ignore this email.
                    """.formatted(code));

            mailSender.send(msg);
            log.info("[MAIL][OTP] OTP email dispatch succeeded to {}", maskEmail(to));
        } catch (RuntimeException ex) {
            throw toMailDispatchException("OTP", to, ex);
        }
    }

    public void sendLoginOtpEmail(String to, String code) {
        validateMailBasics();
        try {
            log.info("[MAIL][LOGIN_OTP] Dispatching login OTP email to {}", maskEmail(to));
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(to);
            msg.setSubject("WashAlert Login Verification Code");
            msg.setText("""
                    Your WashAlert login code is:

                    %s

                    This code expires soon and can only be used once.
                    If you did not attempt to sign in, ignore this email.
                    """.formatted(code));

            mailSender.send(msg);
            log.info("[MAIL][LOGIN_OTP] Login OTP email dispatch succeeded to {}", maskEmail(to));
        } catch (RuntimeException ex) {
            throw toMailDispatchException("LOGIN_OTP", to, ex);
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
}
