package com.washalert.washalertbackend.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record CompleteInvitationRequest(
        @NotBlank String idToken
) {}
