package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @Email @NotBlank String email,

        @NotBlank
        @Size(min = 2, max = 80, message = "Full name must be 2 to 80 characters.")
        String fullName,

        @NotBlank
        @Size(min = 8, max = 72, message = "Password must be 8 to 72 characters.")
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).+$",
                message = "Password must include an uppercase letter, a lowercase letter, a number, and a special character."
        )
        String password
) {}
