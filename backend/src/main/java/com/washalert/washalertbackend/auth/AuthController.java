package com.washalert.washalertbackend.auth;

import com.washalert.washalertbackend.auth.dto.*;
import com.washalert.washalertbackend.common.ApiError;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserStatus;
import com.washalert.washalertbackend.verification.OtpService;
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
                "Legacy email/password login is disabled. Use /api/auth/firebase-login-otp/request then /api/auth/firebase-login-otp/verify."
        ));
    }

    @PostMapping("/firebase-session")
    public ResponseEntity<?> firebaseSession(
            @Valid @RequestBody FirebaseSessionRequest req,
            Authentication authentication,
            HttpServletRequest request
    ) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserDetails principal)) {
            return ResponseEntity.status(401).body(apiError(
                    request,
                    401,
                    "Direct session creation is disabled. Complete login OTP verification first."
            ));
        }
        String platform = req.platform() == null ? "WEB" : req.platform().trim().toUpperCase();
        return ResponseEntity.ok(authService.toSessionResponse(principal.getUser(), platform));
    }

    @PostMapping({"/firebase-login-otp/request", "/firebase-login-otp/resend"})
    public ResponseEntity<?> requestFirebaseLoginOtp(
            @Valid @RequestBody FirebaseLoginOtpRequest req,
            HttpServletRequest request
    ) {
        String incomingToken = req.idToken();
        String tokenSnapshot = incomingToken == null ? "" : incomingToken.substring(0, Math.min(20, incomingToken.length()));
        log.info(
                "[AUTH][LOGIN][OTP] request received platform={} idTokenNull={} idTokenBlank={} idTokenLength={} idTokenPrefix20='{}'",
                req.platform(),
                incomingToken == null,
                incomingToken != null && incomingToken.isBlank(),
                incomingToken == null ? 0 : incomingToken.length(),
                tokenSnapshot
        );
        User user;
        try {
            user = authService.resolveFirebaseUserForLoginChallenge(req.idToken(), req.platform(), req.selectedBranch());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(403).body(apiError(request, 403, ex.getMessage()));
        }

        try {
            if (user.getRole() == com.washalert.washalertbackend.user.Role.DRIVER && user.isMustChangePassword()) {
                return ResponseEntity.ok(new FirebaseLoginOtpChallengeResponse(
                        maskEmail(user.getEmail()),
                        "Password update required before continuing.",
                        0,
                        0,
                        true
                ));
            }

            otpService.sendForLogin(user);
            return ResponseEntity.ok(new FirebaseLoginOtpChallengeResponse(
                    maskEmail(user.getEmail()),
                    "Login OTP sent to email.",
                    otpService.getTtlMinutes() * 60,
                    otpService.getResendCooldownSeconds(),
                    false
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        } catch (Exception mailEx) {
            return ResponseEntity.status(503).body(apiError(
                    request,
                    503,
                    mailFailureMessage(
                            mailEx,
                            "Login OTP email could not be sent. Please retry in a moment."
                    )
            ));
        }
    }

    @PostMapping("/firebase-login-otp/verify")
    public ResponseEntity<?> verifyFirebaseLoginOtp(
            @Valid @RequestBody FirebaseLoginOtpVerifyRequest req,
            HttpServletRequest request
    ) {
        User user;
        try {
            user = authService.resolveFirebaseUserForLoginChallenge(req.idToken(), req.platform(), req.selectedBranch());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(403).body(apiError(request, 403, ex.getMessage()));
        }

        if (user.getRole() == com.washalert.washalertbackend.user.Role.DRIVER && user.isMustChangePassword()) {
            return ResponseEntity.status(403).body(apiError(
                    request,
                    403,
                    "Password update required before OTP verification."
            ));
        }

        try {
            otpService.verifyLoginCode(user.getEmail(), req.code());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }

        User finalizedUser = authService.markLoginSuccess(user.getId());
        establishSession(finalizedUser, request);
        return ResponseEntity.ok(authService.toSessionResponse(finalizedUser, req.platform().trim().toUpperCase()));
    }

    @PostMapping("/firebase/complete-first-login-password")
    public ResponseEntity<?> completeFirstLoginPassword(
            @Valid @RequestBody CompleteFirstLoginPasswordRequest req,
            HttpServletRequest request
    ) {
        try {
            User finalizedUser = authService.completeMobileFirstLoginPasswordUpdate(req.idToken(), req.platform());
            establishSession(finalizedUser, request);
            return ResponseEntity.ok(authService.toSessionResponse(finalizedUser, req.platform().trim().toUpperCase()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }
    }

    @PostMapping("/mobile/register-profile")
    public ResponseEntity<?> registerMobileProfile(
            @Valid @RequestBody MobileCustomerProfileRequest req,
            HttpServletRequest request
    ) {
        log.info("[AUTH][REGISTER] Mobile customer registration requested");
        User user;
        try {
            user = authService.upsertMobileCustomerProfile(req.idToken(), req.fullName());
        } catch (IllegalArgumentException ex) {
            log.warn("[AUTH][REGISTER] Registration rejected: {}", ex.getMessage());
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }

        log.info(
                "[AUTH][REGISTER] Profile upserted for {} with status={} enabled={}",
                maskEmail(user.getEmail()),
                user.getStatus(),
                user.isEnabled()
        );

        if (user.getStatus() == UserStatus.PENDING) {
            try {
                log.info("[AUTH][REGISTER] Generating and dispatching OTP for {}", maskEmail(user.getEmail()));
                otpService.generateAndSend(user);
                log.info("[AUTH][REGISTER] OTP dispatch completed for {}", maskEmail(user.getEmail()));
            } catch (IllegalArgumentException ex) {
                log.warn("[AUTH][REGISTER] OTP generation rejected for {}: {}", maskEmail(user.getEmail()), ex.getMessage());
                return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
            } catch (Exception ex) {
                log.error("[AUTH][REGISTER] Registration completed but OTP email dispatch failed", ex);
                return ResponseEntity.status(503).body(apiError(
                        request,
                        503,
                        mailFailureMessage(
                                ex,
                                "Account created, but verification email delivery failed. Please retry in a moment."
                        )
                ));
            }
        }

        return ResponseEntity.status(201).body(authService.toSessionResponse(user, "MOBILE"));
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
        String normalizedEmail = req.email() == null ? "" : req.email().trim().toLowerCase();
        log.info("[OTP][RESEND] Resend requested for {}", maskEmail(normalizedEmail));
        try {
            otpService.resend(req.email());
            log.info("[OTP][RESEND] Resend dispatched for {}", maskEmail(normalizedEmail));
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            log.warn("[OTP][RESEND] Resend rejected for {}: {}", maskEmail(normalizedEmail), ex.getMessage());
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        } catch (Exception mailEx) {
            log.error("[OTP][RESEND] Email delivery failed for {}", maskEmail(normalizedEmail), mailEx);
            return ResponseEntity.status(503).body(apiError(
                    request,
                    503,
                    mailFailureMessage(
                            mailEx,
                            "Verification email could not be sent. Please retry in a moment."
                    )
            ));
        }
    }

    @PostMapping("/otp/verify")
    public ResponseEntity<?> verifyOtp(@Valid @RequestBody VerifyOtpRequest req, HttpServletRequest request) {
        String normalizedEmail = req.email() == null ? "" : req.email().trim().toLowerCase();
        log.info("[OTP][VERIFY] Verification requested for {} with codeLength={}",
                maskEmail(normalizedEmail),
                req.code() == null ? 0 : req.code().length());
        try {
            User user = otpService.verifyAndActivate(req.email(), req.code());
            log.info("[OTP][VERIFY] Account activated for {} role={} status={} enabled={}",
                    maskEmail(user.getEmail()),
                    user.getRole(),
                    user.getStatus(),
                    user.isEnabled());
            establishSession(user, request);
            return ResponseEntity.ok(authService.toSessionResponse(user, "MOBILE"));
        } catch (IllegalArgumentException ex) {
            log.warn("[OTP][VERIFY] Verification rejected for {}: {}", maskEmail(normalizedEmail), ex.getMessage());
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        }
    }

    @PostMapping("/otp/forgot-password")
    public ResponseEntity<?> requestResetOtp(@Valid @RequestBody OtpRequest req, HttpServletRequest request) {
        String normalizedEmail = req.email() == null ? "" : req.email().trim().toLowerCase();
        log.info("[OTP][RESET] Reset OTP requested for {}", maskEmail(normalizedEmail));
        try {
            authService.requestPasswordResetOtp(req.email());
            log.info("[OTP][RESET] Reset OTP dispatched for {}", maskEmail(normalizedEmail));
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            log.warn("[OTP][RESET] Reset OTP rejected for {}: {}", maskEmail(normalizedEmail), ex.getMessage());
            return ResponseEntity.status(400).body(apiError(request, 400, ex.getMessage()));
        } catch (Exception mailEx) {
            log.error("[OTP][RESET] Reset OTP email delivery failed for {}", maskEmail(normalizedEmail), mailEx);
            return ResponseEntity.status(503).body(apiError(
                    request,
                    503,
                    mailFailureMessage(
                            mailEx,
                            "Reset code email could not be sent. Please retry in a moment."
                    )
            ));
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

    private String mailFailureMessage(Exception ex, String fallbackMessage) {
        String message = ex == null || ex.getMessage() == null ? "" : ex.getMessage().trim();
        if (message.isBlank()) {
            return fallbackMessage;
        }

        String normalized = message.toLowerCase();
        if (normalized.contains("smtp")
                || normalized.contains("mail_")
                || normalized.contains("sender")
                || normalized.contains("email dispatch")) {
            return message;
        }

        return fallbackMessage;
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
