package com.washalert.washalertbackend.delivery.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record UpdateDeliveryLocationRequest(
        @DecimalMin(value = "-90.0", message = "Latitude must be at least -90.")
        @DecimalMax(value = "90.0", message = "Latitude must be at most 90.")
        Double latitude,

        @DecimalMin(value = "-180.0", message = "Longitude must be at least -180.")
        @DecimalMax(value = "180.0", message = "Longitude must be at most 180.")
        Double longitude,

        LocalDateTime estimatedArrivalAt,

        @Size(max = 300, message = "Notes are too long.")
        String notes
) {
}
