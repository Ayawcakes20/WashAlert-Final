package com.washalert.washalertbackend.delivery.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Driver submits bag count + photo URL when completing customer pickup.
 * Transitions status: ARRIVED_CUSTOMER → PICKED_UP
 */
public record PickupCompleteRequest(
        @NotNull(message = "Bag count is required.")
        @Min(value = 1, message = "Bag count must be at least 1.")
        Integer bagCount,

        String pickupPhotoUrl
) {}
