package com.washalert.washalertbackend.inventory.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateInventoryItemRequest(
        @NotBlank(message = "Branch is required.")
        @Size(max = 80, message = "Branch is too long.")
        String branch,

        @NotBlank(message = "Item name is required.")
        @Size(max = 120, message = "Item name is too long.")
        String itemName,

        @NotBlank(message = "Category is required.")
        @Size(max = 50, message = "Category is too long.")
        String category,

        @NotBlank(message = "Unit is required.")
        @Size(max = 30, message = "Unit is too long.")
        String unit,

        @NotNull(message = "Current stock is required.")
        @DecimalMin(value = "0.00", message = "Current stock cannot be negative.")
        BigDecimal currentStock,

        @NotNull(message = "Reorder level is required.")
        @DecimalMin(value = "0.00", message = "Reorder level cannot be negative.")
        BigDecimal reorderLevel,

        String assetType,
        LocalDate purchaseDate,
        LocalDate lastServicedDate,
        Integer maintenanceIntervalDays,
        String assetStatus,
        Integer supplierLeadTimeDays
) {
}
