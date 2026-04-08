package com.washalert.washalertbackend.dashboard.dto;

import com.washalert.washalertbackend.orders.dto.JobOrderResponse;

import java.util.List;

public record DashboardSummaryResponse(
        OrderSummary orders,
        MachineSummary machines,
        List<JobOrderResponse> recentOrders
) {
    public record OrderSummary(long pending, long washing, long drying, long ready) {}
    public record MachineSummary(long available, long inUse, long maintenance) {}
}
