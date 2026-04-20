package com.washalert.washalertbackend.booking.dto;

import java.math.BigDecimal;

public record EstimatePriceRequest(
        String branch,
        String serviceName,
        BigDecimal weightKg,
        boolean isRush,
        String detergent,
        String fabcon,
        BigDecimal distanceKm
) {}
