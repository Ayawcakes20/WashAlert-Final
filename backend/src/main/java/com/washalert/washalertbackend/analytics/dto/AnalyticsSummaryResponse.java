package com.washalert.washalertbackend.analytics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

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
        List<BranchAnalyticsResponse> branchBreakdown
) {
}
