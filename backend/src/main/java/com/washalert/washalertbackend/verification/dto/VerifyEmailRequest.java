package com.washalert.washalertbackend.verification.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifyEmailRequest(
        @NotBlank @Email String email,

        // keep as String so leading zeros won't break
        @NotBlank
        @Pattern(regexp = "^[0-9]{6}$", message = "Code must be 6 digits")
        String code
) {}