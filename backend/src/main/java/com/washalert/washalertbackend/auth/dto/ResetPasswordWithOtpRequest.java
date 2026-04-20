package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordWithOtpRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,

        @NotBlank(message = "New password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        String newPassword
) {}
