package com.washalert.washalertbackend.orders.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record SetPriceRequest(

        @NotNull(message = "Actual weight is required.")
        @DecimalMin(value = "0.1", message = "Weight must be at least 0.1 kg.")
        BigDecimal actualWeightKg,

        @NotNull(message = "Final price is required.")
        @DecimalMin(value = "0.0", inclusive = false, message = "Final price must be positive.")
        BigDecimal finalPrice,

        BigDecimal deliveryFee
) {}
