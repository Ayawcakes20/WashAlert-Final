package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MobileCustomerProfileRequest(
        @NotBlank String idToken,

        @NotBlank
        @Size(min = 2, max = 80, message = "Full name must be 2 to 80 characters.")
        String fullName
) {}
