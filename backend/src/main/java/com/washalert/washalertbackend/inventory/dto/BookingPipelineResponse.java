package com.washalert.washalertbackend.inventory.dto;

import java.util.List;

public record BookingPipelineResponse(
        String itemName,
        List<DailyDemand> upcoming
) {
    public record DailyDemand(String date, String dayLabel, double quantity) {}
}
