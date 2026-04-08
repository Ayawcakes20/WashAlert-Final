package com.washalert.washalertbackend.delivery.dto;

import com.washalert.washalertbackend.delivery.DeliveryLeg;
import com.washalert.washalertbackend.delivery.DeliveryStatus;

import java.time.LocalDateTime;

public record DeliveryResponse(
        Long id,
        String trackingNumber,
        String branch,
        String customerName,
        String deliveryAddress,
        String driverName,
        String driverPhone,
        DeliveryLeg leg,
        DeliveryStatus status,
        Double currentLatitude,
        Double currentLongitude,
        LocalDateTime estimatedArrivalAt,
        String notes,
        LocalDateTime updatedAt,
        Double branchLatitude,
        Double branchLongitude,
        Double deliveryLatitude,
        Double deliveryLongitude
) {
}
