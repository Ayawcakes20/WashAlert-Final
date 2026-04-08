package com.washalert.washalertbackend.delivery.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record UpdateDeliveryAssignmentRequest(
        @NotBlank(message = "Driver name is required.")
        @Size(max = 120, message = "Driver name is too long.")
        String driverName,

        @NotBlank(message = "Driver phone is required.")
        @Size(max = 30, message = "Driver phone is too long.")
        String driverPhone,

        LocalDateTime estimatedArrivalAt,

        @Size(max = 300, message = "Notes are too long.")
        String notes
) {
}
