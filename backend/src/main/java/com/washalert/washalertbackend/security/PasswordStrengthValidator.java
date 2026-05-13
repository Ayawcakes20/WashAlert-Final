package com.washalert.washalertbackend.security;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Enforces password complexity rules at all password-setting points:
 * initial staff invitation, password reset via link, and OTP-based reset.
 */
@Component
public class PasswordStrengthValidator {

    private static final int MIN_LENGTH = 8;
    private static final Pattern UPPERCASE = Pattern.compile("[A-Z]");
    private static final Pattern LOWERCASE = Pattern.compile("[a-z]");
    private static final Pattern DIGIT     = Pattern.compile("[0-9]");
    private static final Pattern SPECIAL   = Pattern.compile("[^A-Za-z0-9]");

    public void validate(String password) {
        if (password == null || password.length() < MIN_LENGTH) {
            throw new IllegalArgumentException(
                    "Password must be at least " + MIN_LENGTH + " characters long.");
        }
        if (!UPPERCASE.matcher(password).find()) {
            throw new IllegalArgumentException(
                    "Password must contain at least one uppercase letter (A-Z).");
        }
        if (!LOWERCASE.matcher(password).find()) {
            throw new IllegalArgumentException(
                    "Password must contain at least one lowercase letter (a-z).");
        }
        if (!DIGIT.matcher(password).find()) {
            throw new IllegalArgumentException(
                    "Password must contain at least one digit (0-9).");
        }
        if (!SPECIAL.matcher(password).find()) {
            throw new IllegalArgumentException(
                    "Password must contain at least one special character (e.g. @, #, !, $).");
        }
    }
}
