package com.washalert.washalertbackend.verification;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
        } catch (MailException ex) {
            log.error("[MAIL][OTP] SMTP dispatch failed for {}", maskEmail(to), ex);
            throw ex;
        } catch (RuntimeException ex) {
            log.error("[MAIL][OTP] Dispatch failed before SMTP send for {}", maskEmail(to), ex);
            throw ex;
        }
    }

    public void sendPasswordResetEmail(String to, String resetLink) {
        validateMailBasics();

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
    }

    public void sendStaffInvitationEmail(String to, String fullName, String setPasswordLink) {
        validateMailBasics();

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
    }

    public void sendGeneralEmail(String to, String subject, String body) {
        validateMailBasics();

        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(to);
        msg.setSubject(subject);
        msg.setText(body);
        mailSender.send(msg);
    }

    private void validateMailBasics() {
        if (!hasText(from)) {
            throw new IllegalStateException("Mail sender is not configured. Set MAIL_FROM.");
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String display(String value) {
        return hasText(value) ? value.trim() : "<unset>";
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
