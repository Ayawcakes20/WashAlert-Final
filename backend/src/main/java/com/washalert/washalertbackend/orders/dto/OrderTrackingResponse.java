package com.washalert.washalertbackend.orders.dto;

import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.ServiceType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public record OrderTrackingResponse(
        String trackingNumber,
        String customerName,
        String deliveryContactName,
        String deliveryContactPhone,
        String branch,
        ServiceType serviceType,
        JobOrderStatus currentStatus,
        LocalDate bookingDate,
        LocalTime slotStartTime,
        LocalTime slotEndTime,
        LocalDateTime lastUpdatedAt,
        String createdByName,
        List<OrderTrackingEventResponse> timeline
) {
}
