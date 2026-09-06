package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record MobileCustomerProfileRequest(
        @NotBlank String idToken,

        @NotBlank
        @Size(min = 2, max = 80, message = "Full name must be 2 to 80 characters.")
        String fullName,

        @Pattern(
                regexp = "^$|^09\\d{9}$",
                message = "Mobile number must use format 09XXXXXXXXX."
        )
        String mobileNumber
) {}
