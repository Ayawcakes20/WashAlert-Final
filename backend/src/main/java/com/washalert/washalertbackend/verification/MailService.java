package com.washalert.washalertbackend.verification;

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

    public MailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendOtpEmail(String to, String code) {
        try {
            log.info("Preparing to send OTP email to {}", to);
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
            log.info("OTP email successfully dispatched to {}", to);
        } catch (MailException ex) {
            log.error("CRITICAL SMTP ERROR: Failed to send OTP email to {}. Message: {}", to, ex.getMessage());
            ex.printStackTrace();
            throw ex;
        }
    }

    // ✅ D2: password reset email
    public void sendPasswordResetEmail(String to, String resetLink) {
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
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(to);
        msg.setSubject(subject);
        msg.setText(body);
        mailSender.send(msg);
    }
}
