package com.washalert.washalertbackend.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateStaffRequest(
        @NotBlank(message = "Name is required.")
        @Size(max = 120, message = "Name is too long.")
        String fullName,

        @NotBlank(message = "Email is required.")
        @Email(message = "Email must be valid.")
        @Size(max = 120, message = "Email is too long.")
        String email,

        // optional
        @Size(max = 80, message = "Branch is too long.")
        String branch,

        // admin can enable/disable staff account
        boolean enabled
) {}
