package com.washalert.washalertbackend.booking.dto;

import com.washalert.washalertbackend.orders.LoadSize;
import com.washalert.washalertbackend.orders.ServiceType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public record CreateBookingRequest(
        @NotBlank(message = "Customer name is required.")
        @Size(max = 120, message = "Customer name is too long.")
        String customerName,

        @NotBlank(message = "Branch is required.")
        @Size(max = 80, message = "Branch is too long.")
        String branch,

        Long branchId,

        @NotBlank(message = "Customer phone is required.")
        @Size(max = 30, message = "Customer phone is too long.")
        String customerPhone,

        @Email(message = "Customer email is invalid.")
        @Size(max = 120, message = "Customer email is too long.")
        String customerEmail,

        @NotNull(message = "Service type is required.")
        ServiceType serviceType,

        @FutureOrPresent(message = "Preferred date cannot be in the past.")
        @NotNull(message = "Preferred date is required.")
        LocalDate preferredDate,

        @NotNull(message = "Preferred slot start time is required.")
        LocalTime preferredSlotStartTime,

        @NotBlank(message = "Detergent preference is required.")
        @Size(max = 80, message = "Detergent preference is too long.")
        String detergentPreference,

        Integer detergentQuantity,

        @NotBlank(message = "Fabric conditioner preference is required.")
        @Size(max = 80, message = "Fabric conditioner preference is too long.")
        String fabricConditionerPreference,

        Integer conditionerQuantity,

        @NotNull(message = "Load size is required.")
        LoadSize loadSize,

        @DecimalMin(value = "1.00", message = "Estimated weight must be at least 1 kg.")
        @DecimalMax(value = "9.00", message = "Estimated weight must not exceed 9 kg.")
        @NotNull(message = "Estimated weight is required.")
        BigDecimal estimatedWeightKg,

        boolean containsBulkyItems,

        @Size(max = 500, message = "Special instructions are too long.")
        String specialInstructions,

        @Size(max = 255, message = "Delivery address is too long.")
        String deliveryAddress,

        @NotBlank(message = "Service name is required.")
        String serviceName,

        boolean isRush,

        BigDecimal distanceKm,

        @NotBlank(message = "Payment method is required.")
        String paymentMethod,

        Double deliveryLatitude,

        Double deliveryLongitude,

        String deliveryUnitFloor,

        String deliveryContactName,

        String deliveryContactPhone,

        Double branchLatitude,

        Double branchLongitude,

        BigDecimal servicePrice,

        BigDecimal suppliesPrice,

        BigDecimal rushPrice,

        BigDecimal deliveryPrice,

        BigDecimal total
) {
}
