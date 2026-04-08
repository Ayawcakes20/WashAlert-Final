package com.washalert.washalertbackend.auth.dto;

public record MeResponse(
        Long id,
        String firebaseUid,
        String email,
        String fullName,
        String role,
        String status,
        Long branchId,
        String branch,
        boolean enabled,
        boolean mustChangePassword,
        String provider
) {}
