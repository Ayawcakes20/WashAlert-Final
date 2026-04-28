package com.washalert.washalertbackend.auth.dto;

import java.util.List;

public record AuthSessionResponse(
        Long id,
        String firebaseUid,
        String email,
        String fullName,
        String mobileNumber,
        String profileImageUrl,
        String role,
        String status,
        boolean mustChangePassword,
        Long branchId,
        String branch,
        List<String> allowedModules,
        String platform
) {}
