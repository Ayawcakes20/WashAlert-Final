package com.washalert.washalertbackend.inventory.dto;

public record OperationsKpiResponse(
        int ordersToday,
        int ordersThisWeek,
        double avgKgPerOrder30d,
        String peakDayOfWeek,
        int peakDayOrderCount
) {}
