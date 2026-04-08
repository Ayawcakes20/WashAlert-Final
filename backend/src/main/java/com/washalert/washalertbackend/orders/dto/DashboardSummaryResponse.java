package com.washalert.washalertbackend.orders.dto;

import java.util.List;

public record DashboardSummaryResponse(
        long pending,
        long washing,
        long drying,
        long ready,
        List<JobOrderResponse> recent
) {}
