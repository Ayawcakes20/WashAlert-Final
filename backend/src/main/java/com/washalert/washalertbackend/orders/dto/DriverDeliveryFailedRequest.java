package com.washalert.washalertbackend.orders.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DriverDeliveryFailedRequest(
        @NotBlank(message = "Reason is required.")
        @Size(max = 300, message = "Reason is too long.")
        String reason
) {}
