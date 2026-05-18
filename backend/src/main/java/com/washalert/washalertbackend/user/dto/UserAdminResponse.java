package com.washalert.washalertbackend.user.dto;

import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.UserStatus;

import java.time.LocalDateTime;

public record UserAdminResponse(
        Long id,
        String email,
        String fullName,
        Role role,
        UserStatus status,
        String branch,
        Long branchId,
        LocalDateTime invitedAt,
        LocalDateTime activatedAt,
        LocalDateTime createdAt,
        boolean mustChangePassword,
        String mobileNumber
) {}
