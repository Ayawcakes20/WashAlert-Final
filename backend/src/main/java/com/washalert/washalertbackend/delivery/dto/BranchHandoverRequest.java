package com.washalert.washalertbackend.delivery.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Driver submits photo proof of bags on the branch counter.
 * Transitions status: ARRIVED_BRANCH → HANDED_TO_BRANCH
 */
public record BranchHandoverRequest(
        @NotBlank(message = "Handover photo URL is required.")
        String branchHandoverPhotoUrl
) {}
