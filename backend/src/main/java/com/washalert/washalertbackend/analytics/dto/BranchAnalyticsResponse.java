package com.washalert.washalertbackend.analytics.dto;

import java.math.BigDecimal;

public record BranchAnalyticsResponse(
        String branch,
        long totalOrders,
        BigDecimal revenue
) {
}
