package com.washalert.washalertbackend.delivery.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record DriverAvailableOrderResponse(
        Long orderId,
        String trackingNumber,
        String branch,
        String customerName,
        String customerPhone,
        String deliveryAddress,
        String paymentMethod,
        BigDecimal amountToCollect,
        LocalDateTime createdAt
) {
}
