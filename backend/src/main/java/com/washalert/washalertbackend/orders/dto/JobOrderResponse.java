package com.washalert.washalertbackend.orders.dto;

import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.LoadSize;
import com.washalert.washalertbackend.orders.ServiceType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record JobOrderResponse(
        Long id,
        String trackingNumber,
        String customerName,
        String branch,
        JobOrderStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        ServiceType serviceType,
        LocalDate bookingDate,
        LocalTime slotStartTime,
        LocalTime slotEndTime,
        String detergentPreference,
        String fabricConditionerPreference,
        LoadSize loadSize,
        BigDecimal estimatedWeightKg,
        String specialInstructions,
        String customerPhone,
        String customerEmail,
        String deliveryAddress,
        BigDecimal servicePrice,
        BigDecimal suppliesPrice,
        BigDecimal deliveryPrice,
        BigDecimal totalPrice,
        boolean isPaid,
        String paymentMethod,
        Double deliveryLatitude,
        Double deliveryLongitude,
        Double branchLatitude,
        Double branchLongitude
) {}
