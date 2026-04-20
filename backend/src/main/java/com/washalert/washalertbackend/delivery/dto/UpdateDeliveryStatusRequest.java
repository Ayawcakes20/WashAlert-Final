package com.washalert.washalertbackend.delivery.dto;

import com.washalert.washalertbackend.delivery.DeliveryStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateDeliveryStatusRequest(
        @NotNull(message = "Delivery status is required.")
        DeliveryStatus status,

        @Size(max = 300, message = "Notes are too long.")
        String notes
) {
}
