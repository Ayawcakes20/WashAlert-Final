package com.washalert.washalertbackend.inventory.dto;

import com.washalert.washalertbackend.inventory.StockDirection;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record AdjustInventoryRequest(
        @NotNull(message = "Quantity delta is required.")
        @DecimalMin(value = "0.01", message = "Quantity delta must be at least 0.01.")
        BigDecimal quantityDelta,

        @NotNull(message = "Direction is required.")
        StockDirection direction,

        @NotBlank(message = "Reason is required.")
        @Size(max = 120, message = "Reason is too long.")
        String reason
) {
}
