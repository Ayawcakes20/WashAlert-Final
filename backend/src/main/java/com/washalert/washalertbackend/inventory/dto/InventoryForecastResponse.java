package com.washalert.washalertbackend.inventory.dto;

import java.math.BigDecimal;

public record InventoryForecastResponse(
        Long itemId,
        String branch,
        String itemName,
        BigDecimal currentStock,
        BigDecimal estimatedDailyUsage,
        BigDecimal projectedStockAfterDays,
        BigDecimal estimatedDaysUntilStockout,
        String narrative
) {
}
