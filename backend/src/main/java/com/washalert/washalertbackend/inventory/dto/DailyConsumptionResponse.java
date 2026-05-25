package com.washalert.washalertbackend.inventory.dto;

import java.util.List;

public record DailyConsumptionResponse(
        String itemName,
        String branch,
        String unit,
        List<DailyUsage> days
) {
    public record DailyUsage(String date, double consumed) {}
}
