package com.washalert.washalertbackend.delivery.dto;

import jakarta.validation.constraints.Size;
import com.washalert.washalertbackend.delivery.DeliveryLeg;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record CreateDeliveryRequest(
        String trackingNumber,
        
        @NotNull(message = "Delivery leg must be provided.")
        DeliveryLeg leg,

        // Either provide driverId (links to a real driver account)
        // or provide driverName + driverPhone (legacy / manual entry)
        Long driverId,

        @Size(max = 120, message = "Driver name is too long.")
        String driverName,

        @Size(max = 30, message = "Driver phone is too long.")
        String driverPhone,

        LocalDateTime estimatedArrivalAt,

        @Size(max = 300, message = "Notes are too long.")
        String notes
) {
}
