package com.washalert.washalertbackend.orders.dto;

import com.washalert.washalertbackend.orders.JobOrderStatus;

import java.time.LocalDateTime;

public record OrderTrackingEventResponse(
        JobOrderStatus status,
        LocalDateTime changedAt,
        String changedBy,
        String notes
) {
}
