package com.washalert.washalertbackend.orders.dto;

import jakarta.validation.constraints.NotNull;

public record DriverConfirmDeliveryRequest(
        @NotNull(message = "COD collected status is required.")
        Boolean codCollected,

        @NotNull(message = "Latitude is required.")
        Double latitude,

        @NotNull(message = "Longitude is required.")
        Double longitude
) {}
