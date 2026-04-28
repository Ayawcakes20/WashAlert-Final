package com.washalert.washalertbackend.auth.dto;

public record FirebaseLoginOtpChallengeResponse(
        String email,
        String message,
        int expiresInSeconds,
        int resendCooldownSeconds,
        boolean requiresPasswordUpdate
) {}
