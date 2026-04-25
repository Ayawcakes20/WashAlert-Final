package com.washalert.washalertbackend.delivery.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Driver submits the confirmation code + photo proof to complete final delivery.
 * Transitions status: ARRIVED_DELIVERY → DELIVERED
 */
public record FinalHandoverRequest(
        @NotBlank(message = "Confirmation code is required.")
        String confirmationCode,

        String finalDeliveryPhotoUrl
) {}
