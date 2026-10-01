package com.washalert.washalertbackend.auth.dto;

public record MeResponse(
        Long id,
        String firebaseUid,
        String email,
        String fullName,
        String mobileNumber,
        String profileImageUrl,
        String role,
        String status,
        Long branchId,
        String branch,
        boolean enabled,
        boolean mustChangePassword,
        String provider,
        String address,
        String addressLine1,
        String addressLine2
) {}
