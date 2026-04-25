package com.washalert.washalertbackend.orders.dto;

import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.LoadSize;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.payment.PaymentStatus;

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
        PaymentStatus paymentStatus,
        Double deliveryLatitude,
        Double deliveryLongitude,
        String deliveryUnitFloor,
        String deliveryContactName,
        String deliveryContactPhone,
        Double branchLatitude,
        Double branchLongitude
) {}
