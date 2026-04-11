package com.washalert.washalertbackend.analytics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record AnalyticsSummaryResponse(
        LocalDate fromDate,
        LocalDate toDate,
        long totalOrders,
        long pending,
        long washing,
        long drying,
        long ready,
        BigDecimal totalRevenue,
        Integer peakHour,
        List<BranchAnalyticsResponse> branchBreakdown,
        Map<String, Long> hourlyBreakdown,
        Map<String, Long> paymentMethodBreakdown
) {
}
