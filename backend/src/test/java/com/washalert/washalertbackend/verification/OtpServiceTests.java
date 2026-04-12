package com.washalert.washalertbackend.verification;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import com.washalert.washalertbackend.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OtpServiceTests {

    private EmailOtpRepository otps;
    private UserRepository users;
    private PasswordEncoder encoder;
    private MailService mailService;
    private FirestoreSyncService firestoreSyncService;
    private OtpService otpService;

    @BeforeEach
    void setUp() {
        otps = mock(EmailOtpRepository.class);
        users = mock(UserRepository.class);
        encoder = mock(PasswordEncoder.class);
        mailService = mock(MailService.class);
        firestoreSyncService = mock(FirestoreSyncService.class);

        otpService = new OtpService(otps, users, encoder, mailService, firestoreSyncService);
        ReflectionTestUtils.setField(otpService, "otpLength", 6);
        ReflectionTestUtils.setField(otpService, "ttlMinutes", 15);
        ReflectionTestUtils.setField(otpService, "resendCooldownSeconds", 60);
        ReflectionTestUtils.setField(otpService, "maxAttempts", 5);
    }

    @Test
    void generateAndSendPersistsOtpBeforeMailDispatch() {
        User user = pendingUser();
        when(otps.findByUser(user)).thenReturn(Optional.empty());
        when(encoder.encode(anyString())).thenReturn("hashed-code");
        when(otps.save(any(EmailOtp.class))).thenAnswer(invocation -> {
            EmailOtp otp = invocation.getArgument(0);
            otp.setId(99L);
            return otp;
        });
        doThrow(new MailSendException("SMTP down")).when(mailService).sendOtpEmail(eq("customer@example.com"), anyString());

        assertThatThrownBy(() -> otpService.generateAndSend(user))
                .isInstanceOf(MailSendException.class);

        verify(otps, times(1)).save(any(EmailOtp.class));
        verify(mailService, times(1)).sendOtpEmail(eq("customer@example.com"), anyString());
    }

    @Test
    void resendRejectsAlreadyVerifiedUsers() {
        User user = pendingUser();
        user.setEnabled(true);
        when(users.findByEmail("customer@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> otpService.resend("customer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already verified");

        verify(mailService, never()).sendOtpEmail(anyString(), anyString());
    }

    @Test
    void sendForResetNormalizesEmailLookup() {
        User user = pendingUser();
        when(users.findByEmail("customer@example.com")).thenReturn(Optional.of(user));
        when(otps.findByUser(user)).thenReturn(Optional.empty());
        when(encoder.encode(anyString())).thenReturn("hashed-code");
        when(otps.save(any(EmailOtp.class))).thenAnswer(invocation -> invocation.getArgument(0));

        otpService.sendForReset("  CUSTOMER@EXAMPLE.COM ");

        verify(users).findByEmail("customer@example.com");
        verify(mailService).sendOtpEmail(eq("customer@example.com"), anyString());
    }

    @Test
    void verifyCodeOnlyIncrementsAttemptsOnInvalidCode() {
        User user = pendingUser();
        EmailOtp otp = EmailOtp.builder()
                .id(123L)
                .user(user)
                .codeHash("hashed")
                .attempts(1)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .lastSentAt(LocalDateTime.now().minusMinutes(1))
                .build();

        when(users.findByEmail("customer@example.com")).thenReturn(Optional.of(user));
        when(otps.findByUser(user)).thenReturn(Optional.of(otp));
        when(encoder.matches("000000", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> otpService.verifyCodeOnly("customer@example.com", "000000"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid code");

        assertThat(otp.getAttempts()).isEqualTo(2);
        verify(otps).save(otp);
    }

    @Test
    void verifyCodeOnlyDoesNotAllowBackdoorCode() {
        User user = pendingUser();
        when(users.findByEmail("customer@example.com")).thenReturn(Optional.of(user));
        when(otps.findByUser(user)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> otpService.verifyCodeOnly("customer@example.com", "888888"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No verification code found");
    }

    @Test
    void verifyAndActivateRejectsInvalidCodeWithoutActivatingUser() {
        User user = pendingUser();
        EmailOtp otp = EmailOtp.builder()
                .id(321L)
                .user(user)
                .codeHash("hashed")
                .attempts(0)
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .lastSentAt(LocalDateTime.now().minusMinutes(1))
                .build();

        when(users.findByEmail("customer@example.com")).thenReturn(Optional.of(user));
        when(otps.findByUser(user)).thenReturn(Optional.of(otp));
        when(encoder.matches("111111", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> otpService.verifyAndActivate("customer@example.com", "111111"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid code");

        verify(users, never()).save(any(User.class));
        verify(otps).save(otp);
        assertThat(user.isEnabled()).isFalse();
        assertThat(user.getStatus()).isEqualTo(UserStatus.PENDING);
    }

    private User pendingUser() {
        LocalDateTime now = LocalDateTime.now();
        return User.builder()
                .id(1L)
                .email("customer@example.com")
                .fullName("Pending User")
                .passwordHash("hash")
                .role(Role.CUSTOMER)
                .status(UserStatus.PENDING)
                .enabled(false)
                .mustChangePassword(false)
                .createdAt(now)
                .updatedAt(now)
                .provider(AuthProvider.LOCAL)
                .build();
    }
}
