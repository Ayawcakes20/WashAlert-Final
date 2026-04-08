package com.washalert.washalertbackend.auth;

import com.washalert.washalertbackend.verification.OtpService;

import com.washalert.washalertbackend.auth.dto.*;
import com.washalert.washalertbackend.common.ApiError;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserStatus;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;
    private final OtpService otpService;

    public AuthController(AuthService authService, OtpService otpService) {
        this.authService = authService;
        this.otpService = otpService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(HttpServletRequest request) {
        return ResponseEntity.status(403).body(apiError(
                request,
                403,
                "Internal web self-registration is disabled. Customers must sign up through mobile."
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(HttpServletRequest request) {
        return ResponseEntity.status(400).body(apiError(
                request,
                400,
                "Legacy email/password login is disabled. Use Firebase login and /api/auth/firebase-session."
        ));
    }

    @PostMapping("/firebase-session")
    public ResponseEntity<?> firebaseSession(
            @Valid @RequestBody FirebaseSessionRequest req,
            HttpServletRequest request
    ) {
        try {
            User user = authService.authenticateWithFirebase(req.idToken(), req.platform(), req.selectedBranch());
            establishSession(user, request);
            return ResponseEntity.ok(authService.toSessionResponse(user, req.platform().trim().toUpperCase()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(403).body(apiError(request, 403, ex.getMessage()));
        }
    }

    @PostMapping("/mobile/register-profile")
    public ResponseEntity<?> registerMobileProfile(
            @Valid @RequestBody MobileCustomerProfileRequest req,
            HttpServletRequest request
    ) {
        try {
            User user = authService.upsertMobileCustomerProfile(req.idToken(), req.fullName());
            if (user.getStatus() == UserStatus.PENDING) {
                try {
                    otpService.generateAndSend(user);
                } catch (Exception mailEx) {
                    // ⚠️  SMTP failure must NOT abort registration.
                    // The user account is already saved in DB + Firebase.
                    // The OTP code is also already persisted in the DB.
                    // The mobile app will show the OTP screen where the user
                    // can tap "Resend Code" to get a fresh delivery attempt.
                    log.error("[OTP] Initial email delivery failed for {} — account created, user can resend. Cause: {}",
                            user.getEmail(), mailEx.getMessage());
                }
            }
            return ResponseEntity.status(201).body(authService.toSessionResponse(user, "MOBILE"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }
    }

    @PostMapping("/complete-invitation")
    public ResponseEntity<?> completeInvitation(
            @Valid @RequestBody CompleteInvitationRequest req,
            HttpServletRequest request
    ) {
        try {
            authService.completeInvitation(req.idToken());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication, HttpServletRequest request) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserDetails principal)) {
            return ResponseEntity.status(401).body(apiError(request, 401, "Unauthorized"));
        }
        return ResponseEntity.ok(authService.me(principal));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        return ResponseEntity.ok().build();
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        authService.requestPasswordReset(req.email());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(HttpServletRequest request) {
        return ResponseEntity.status(410).body(apiError(
                request,
                410,
                "Use Firebase password reset link flow directly from the client."
        ));
    }

    @PostMapping("/set-password")
    public ResponseEntity<?> setPassword(HttpServletRequest request) {
        return ResponseEntity.status(410).body(apiError(
                request,
                410,
                "Use Firebase invitation/password setup link flow directly from the client."
        ));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(HttpServletRequest request) {
        return ResponseEntity.status(410).body(apiError(
                request,
                410,
                "Use Firebase password update flow."
        ));
    }

    @PostMapping("/otp/request")
    public ResponseEntity<?> requestOtp(@Valid @RequestBody OtpRequest req, HttpServletRequest request) {
        try {
            otpService.resend(req.email());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        } catch (Exception mailEx) {
            // OTP was regenerated and saved; only the email delivery failed.
            // Surface a friendly message so the mobile app can tell the user.
            log.error("[OTP] Resend email delivery failed for {}: {}", req.email(), mailEx.getMessage());
            return ResponseEntity.status(503).body(apiError(request, 503,
                    "Verification email could not be sent. Please check your inbox or try again in a moment."));
        }
    }

    @PostMapping("/otp/verify")
    public ResponseEntity<?> verifyOtp(@Valid @RequestBody VerifyOtpRequest req, HttpServletRequest request) {
        try {
            User user = otpService.verifyAndActivate(req.email(), req.code());
            establishSession(user, request);
            return ResponseEntity.ok(authService.toSessionResponse(user, "MOBILE"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }
    }

    @PostMapping("/otp/forgot-password")
    public ResponseEntity<?> requestResetOtp(@Valid @RequestBody OtpRequest req, HttpServletRequest request) {
        try {
            authService.requestPasswordResetOtp(req.email());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }
    }

    @PostMapping("/otp/verify-reset")
    public ResponseEntity<?> verifyResetOtp(@Valid @RequestBody VerifyOtpRequest req, HttpServletRequest request) {
        try {
            otpService.verifyCodeOnly(req.email(), req.code());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }
    }

    @PostMapping("/otp/reset-password")
    public ResponseEntity<?> resetPasswordWithOtp(
            @Valid @RequestBody ResetPasswordWithOtpRequest req,
            HttpServletRequest request
    ) {
        try {
            authService.resetPasswordWithOtp(req.email(), req.newPassword());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }
    }

    private ApiError apiError(HttpServletRequest request, int status, String message) {
        return new ApiError(Instant.now(), status, message, request.getRequestURI());
    }

    private void establishSession(User user, HttpServletRequest request) {
        AuthUserDetails principal = new AuthUserDetails(user);
        Authentication sessionAuth = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities()
        );
        SecurityContextHolder.getContext().setAuthentication(sessionAuth);
        HttpSession session = request.getSession(true);
        session.setAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                SecurityContextHolder.getContext()
        );
    }
}
