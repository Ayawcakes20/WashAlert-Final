package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        // ✅ OPTIONAL for Google accounts
        String currentPassword,

        @NotBlank(message = "New password is required.")
        @Size(min = 8, max = 64, message = "Password must be 8-64 characters.")
        String newPassword
) {}
