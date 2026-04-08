package com.washalert.washalertbackend.user.dto;

import com.washalert.washalertbackend.user.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateStaffRequest(
        @NotBlank(message = "Name is required.")
        String fullName,

        @NotBlank(message = "Email is required.")
        @Email(message = "Email must be valid.")
        String email,

        Role role,

        // optional — required for STAFF
        String branch,

        // optional — when set, Firebase account is immediately activated with this password
        // Used for DRIVER accounts so they can log in right away without clicking an invitation link
        String initialPassword
) {}
