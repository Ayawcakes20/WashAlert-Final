package com.washalert.washalertbackend.auth;

import com.washalert.washalertbackend.auth.dto.AuthSessionResponse;
import com.washalert.washalertbackend.auth.dto.MobileCustomerProfileRequest;
import com.washalert.washalertbackend.auth.dto.OtpRequest;
import com.washalert.washalertbackend.common.ApiError;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserStatus;
import com.washalert.washalertbackend.verification.OtpService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AuthControllerOtpFlowTests {

    private AuthService authService;
    private OtpService otpService;
    private AuthController controller;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        otpService = mock(OtpService.class);
        controller = new AuthController(authService, otpService);
    }

    @Test
    void registerProfileReturns503WhenOtpDispatchFails() {
        User pendingUser = pendingUser();
        when(authService.upsertMobileCustomerProfile("id-token", "Pending User")).thenReturn(pendingUser);
        doThrow(new RuntimeException("SMTP down")).when(otpService).generateAndSend(pendingUser);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/auth/mobile/register-profile");

        ResponseEntity<?> response = controller.registerMobileProfile(
                new MobileCustomerProfileRequest("id-token", "Pending User"),
                request
        );

        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(response.getBody()).isInstanceOf(ApiError.class);
        ApiError error = (ApiError) response.getBody();
        assertThat(error.message()).contains("could not send the verification email");
    }

    @Test
    void registerProfileReturns201WhenOtpDispatchSucceeds() {
        User pendingUser = pendingUser();
        AuthSessionResponse sessionResponse = new AuthSessionResponse(
                pendingUser.getId(),
                pendingUser.getFirebaseUid(),
                pendingUser.getEmail(),
                pendingUser.getFullName(),
                pendingUser.getRole().name(),
                pendingUser.getStatus().name(),
                null,
                null,
                List.of("customer-booking", "customer-tracking", "customer-orders"),
                "MOBILE"
        );

        when(authService.upsertMobileCustomerProfile("id-token", "Pending User")).thenReturn(pendingUser);
        when(authService.toSessionResponse(pendingUser, "MOBILE")).thenReturn(sessionResponse);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/auth/mobile/register-profile");

        ResponseEntity<?> response = controller.registerMobileProfile(
                new MobileCustomerProfileRequest("id-token", "Pending User"),
                request
        );

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody()).isEqualTo(sessionResponse);
        verify(otpService).generateAndSend(pendingUser);
    }

    @Test
    void requestOtpReturns503WhenResendDispatchFails() {
        doThrow(new RuntimeException("SMTP timeout")).when(otpService).resend("customer@example.com");

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/auth/otp/request");

        ResponseEntity<?> response = controller.requestOtp(new OtpRequest("customer@example.com"), request);

        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(response.getBody()).isInstanceOf(ApiError.class);
        ApiError error = (ApiError) response.getBody();
        assertThat(error.message()).contains("Verification email could not be sent");
    }

    @Test
    void requestResetOtpReturns503WhenDispatchFails() {
        doThrow(new RuntimeException("SMTP timeout")).when(authService).requestPasswordResetOtp("customer@example.com");

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/auth/otp/forgot-password");

        ResponseEntity<?> response = controller.requestResetOtp(new OtpRequest("customer@example.com"), request);

        assertThat(response.getStatusCode().value()).isEqualTo(503);
        assertThat(response.getBody()).isInstanceOf(ApiError.class);
        ApiError error = (ApiError) response.getBody();
        assertThat(error.message()).contains("Reset code email could not be sent");
    }

    private User pendingUser() {
        LocalDateTime now = LocalDateTime.now();
        return User.builder()
                .id(1L)
                .firebaseUid("uid-1")
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
