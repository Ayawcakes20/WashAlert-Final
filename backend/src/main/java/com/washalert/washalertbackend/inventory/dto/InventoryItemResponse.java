package com.washalert.washalertbackend.inventory.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record InventoryItemResponse(
        Long id,
        String branch,
        String itemName,
        String category,
        String unit,
        BigDecimal currentStock,
        BigDecimal reorderLevel,
        boolean lowStock,
        Integer projectedDaysRemaining,
        boolean lowStockWarning,
        LocalDateTime updatedAt,
        String assetType,
        LocalDate purchaseDate,
        LocalDate lastServicedDate,
        Integer maintenanceIntervalDays,
        String assetStatus,
        Integer supplierLeadTimeDays
) {
}
