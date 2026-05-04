package com.washalert.washalertbackend.orders.dto;

import jakarta.validation.constraints.NotNull;

public record DriverConfirmDeliveryRequest(
        @NotNull(message = "COD collected status is required.")
        Boolean codCollected
) {}
