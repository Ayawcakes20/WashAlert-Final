package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record CompleteFirstLoginPasswordRequest(
        @NotBlank(message = "Firebase ID token is required.")
        String idToken,
        @NotBlank(message = "Platform is required.")
        String platform
) {}
