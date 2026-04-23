package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record FirebaseLoginOtpRequest(
        @NotBlank String idToken,
        @NotBlank String platform,
        String selectedBranch
) {}
