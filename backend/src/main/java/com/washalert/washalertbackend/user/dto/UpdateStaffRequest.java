package com.washalert.washalertbackend.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UpdateStaffRequest(
        @NotBlank(message = "Name is required.")
        String fullName,

        @NotBlank(message = "Email is required.")
        @Email(message = "Email must be valid.")
        String email,

        // optional
        String branch,

        // admin can enable/disable staff account
        boolean enabled
) {}
