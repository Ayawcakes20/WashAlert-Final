package com.washalert.washalertbackend.inventory.dto;

public record DailyOrderVolumeResponse(
        String date,
        String dateLabel,
        int orderCount,
        double rollingAvg7d
) {}
