package com.washalert.washalertbackend.user.dto;

import java.time.LocalDateTime;

public record UserDto(
        Long id,
        String email,
        String fullName,
        String role,
        boolean enabled,
        String branch,
        LocalDateTime createdAt,
        LocalDateTime verifiedAt
) {}
