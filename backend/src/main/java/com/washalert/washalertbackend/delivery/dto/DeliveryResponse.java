package com.washalert.washalertbackend.delivery.dto;

import com.washalert.washalertbackend.delivery.DeliveryLeg;
import com.washalert.washalertbackend.delivery.DeliveryStatus;
import com.washalert.washalertbackend.delivery.DeliveryWorkflowStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record DeliveryResponse(
        Long id,
        Long orderId,
        String trackingNumber,
        Long branchId,
        String branch,
        String branchAddress,
        String customerName,
        String customerPhone,
        String deliveryAddress,
        String driverName,
        Long assignedDriverId,
        String driverPhone,
        String driverPhotoUrl,
        String driverVehicle,
        String paymentMethod,
        String paymentStatus,
        Boolean isPaid,
        BigDecimal amountToCollect,
        BigDecimal loadKg,
        Integer loadCount,
        DeliveryWorkflowStatus workflowStatus,
        DeliveryLeg leg,
        DeliveryStatus status,
        Double currentLatitude,
        Double currentLongitude,
        LocalDateTime estimatedArrivalAt,
        String pickupProofUrl,
        String dropoffProofUrl,
        String notes,
        LocalDateTime updatedAt,
        Double branchLatitude,
        Double branchLongitude,
        Double deliveryLatitude,
        Double deliveryLongitude,
        String deliveryUnitFloor,
        String deliveryContactName,
        String deliveryContactPhone,
        // ── State Machine Fields ────────────────────────────────────────────────
        Integer bagCount,
        String confirmationCode,
        String branchHandoverPhotoUrl,
        String finalDeliveryPhotoUrl,
        String createdByName
) {
}
