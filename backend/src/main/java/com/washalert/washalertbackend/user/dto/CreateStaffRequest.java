package com.washalert.washalertbackend.user.dto;

import com.washalert.washalertbackend.user.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateStaffRequest(
        @NotBlank(message = "Name is required.")
        @Size(max = 120, message = "Name is too long.")
        String fullName,

        @NotBlank(message = "Email is required.")
        @Email(message = "Email must be valid.")
        @Size(max = 120, message = "Email is too long.")
        String email,

        Role role,

        // optional — required for STAFF
        @Size(max = 80, message = "Branch is too long.")
        String branch,

        // optional contact number saved to user profile on creation
        @Size(max = 30, message = "Mobile number is too long.")
        String mobileNumber,

        // optional — when set, Firebase account is immediately activated with this password
        // Used for DRIVER accounts so they can log in right away without clicking an invitation link
        @Size(min = 8, max = 64, message = "Initial password must be 8-64 characters.")
        @Pattern(
                regexp = "^(?=.*[A-Za-z])(?=.*\\d).*$",
                message = "Initial password must include at least one letter and one number."
        )
        String initialPassword
) {}
