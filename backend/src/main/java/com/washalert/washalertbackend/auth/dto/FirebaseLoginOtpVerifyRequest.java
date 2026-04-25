package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FirebaseLoginOtpVerifyRequest(
        @NotBlank String idToken,
        @NotBlank String platform,
        String selectedBranch,
        @NotBlank @Size(min = 6, max = 6) String code
) {}
