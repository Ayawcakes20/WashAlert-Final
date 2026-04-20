package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @Email @NotBlank String email,
        @NotBlank String password,
        Boolean rememberMe // ✅ NEW (optional)
) {}
