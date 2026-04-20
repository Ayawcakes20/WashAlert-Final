package com.washalert.washalertbackend.inventory.dto;

import java.math.BigDecimal;
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
        LocalDateTime updatedAt
) {
}
