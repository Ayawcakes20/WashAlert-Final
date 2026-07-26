package com.washalert.washalertbackend.orders.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateDriverLocationRequest(
        @NotNull(message = "Latitude is required.")
        Double latitude,

        @NotNull(message = "Longitude is required.")
        Double longitude
) {
}
