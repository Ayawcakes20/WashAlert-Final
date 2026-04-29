package com.washalert.washalertbackend.common;

import jakarta.servlet.http.HttpServletRequest;
import com.washalert.washalertbackend.orders.OrderNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.sql.SQLIntegrityConstraintViolationException;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> illegalArg(IllegalArgumentException ex, HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), req);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiError> illegalState(IllegalStateException ex, HttpServletRequest req) {
        return build(HttpStatus.CONFLICT, ex.getMessage(), req);
    }

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ApiError> notFound(OrderNotFoundException ex, HttpServletRequest req) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), req);
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<ApiError> security(SecurityException ex, HttpServletRequest req) {
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage(), req);
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ApiError> disabled(DisabledException ex, HttpServletRequest req) {
        return build(HttpStatus.FORBIDDEN, "Please verify your email first.", req);
    }

    @ExceptionHandler({
            BadCredentialsException.class,
            UsernameNotFoundException.class,
            InternalAuthenticationServiceException.class
    })
    public ResponseEntity<ApiError> badLogin(Exception ex, HttpServletRequest req) {
        return build(HttpStatus.UNAUTHORIZED, "Incorrect email or password.", req);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> auth(AuthenticationException ex, HttpServletRequest req) {
        String uri = req.getRequestURI();
        if (uri != null && uri.contains("/api/auth/login")) {
            return build(HttpStatus.UNAUTHORIZED, "Incorrect email or password.", req);
        }
        return build(HttpStatus.UNAUTHORIZED, "Unauthorized", req);
    }

    /**
     * ✅ Better validation messages:
     * - Pick ONE most helpful message (instead of joining many)
     * - Prioritize size errors for password (so user sees "at least 8 chars" first)
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex, HttpServletRequest req) {

        List<FieldError> fieldErrors = ex.getBindingResult().getFieldErrors();
        if (fieldErrors.isEmpty()) {
            return build(HttpStatus.BAD_REQUEST, "Invalid request.", req);
        }

        // Group by field
        Map<String, List<FieldError>> byField = fieldErrors.stream()
                .collect(java.util.stream.Collectors.groupingBy(FieldError::getField));

        // Prefer showing password-related issue first (if present)
        String message;
        if (byField.containsKey("password")) {
            message = bestFieldErrorMessage(byField.get("password"));
        } else {
            // Otherwise show the best error of the first field (stable)
            String firstField = byField.keySet().iterator().next();
            message = bestFieldErrorMessage(byField.get(firstField));
        }

        return build(HttpStatus.BAD_REQUEST, message, req);
    }

    /**
     * ✅ DB constraint errors (e.g., duplicate unique email) should NOT become 500.
     * This is the most common reason your "create staff" returns Internal server error.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> dataIntegrity(DataIntegrityViolationException ex, HttpServletRequest req) {

        String msg = "Invalid request.";

        Throwable root = ex.getMostSpecificCause();
        String rootMsg = root != null ? root.getMessage() : null;
        String lower = rootMsg != null ? rootMsg.toLowerCase() : "";

        // Detect duplicate email constraints (MySQL wording can vary)
        if (lower.contains("duplicate")
                || lower.contains("idx_users_email")
                || lower.contains("users.email")
                || lower.contains("for key")) {
            msg = "Email already exists.";
        } else if (lower.contains("delivery_orders")
                && (lower.contains("driver_name") || lower.contains("driver_phone"))) {
            msg = "Unable to set order status because delivery assignment data is incomplete.";
        } else {
            // fallback but still not a 500
            msg = "Request violates database constraints.";
        }

        return build(HttpStatus.BAD_REQUEST, msg, req);
    }

    // Some setups throw this directly (depends on driver / JPA / dialect)
    @ExceptionHandler(SQLIntegrityConstraintViolationException.class)
    public ResponseEntity<ApiError> sqlIntegrity(SQLIntegrityConstraintViolationException ex, HttpServletRequest req) {
        return build(HttpStatus.BAD_REQUEST, "Email already exists.", req);
    }

    private String bestFieldErrorMessage(List<FieldError> errors) {
        return errors.stream()
                .min(Comparator.comparingInt(this::priority))
                .map(FieldError::getDefaultMessage)
                .orElse("Invalid value.");
    }

    /**
     * Priority rule:
     * 1) NotBlank -> "required"
     * 2) Size -> "at least X chars" (best first for password)
     * 3) Pattern -> complexity rules
     * 4) Email -> email format
     * 99) fallback
     */
    private int priority(FieldError fe) {
        String code = fe.getCode(); // e.g. "NotBlank", "Size", "Pattern", "Email"
        if (code == null) return 99;

        return switch (code) {
            case "NotBlank", "NotNull" -> 1;
            case "Size" -> 2;
            case "Pattern" -> 3;
            case "Email" -> 4;
            default -> 99;
        };
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> fallback(Exception ex, HttpServletRequest req) {
        ex.printStackTrace();
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", req);
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String message, HttpServletRequest req) {
        ApiError err = new ApiError(
                Instant.now(),
                status.value(),
                message,
                req.getRequestURI()
        );
        return ResponseEntity.status(status).body(err);
    }
}
