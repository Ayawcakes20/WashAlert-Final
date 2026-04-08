package com.washalert.washalertbackend.machines.dto;

public record MachineSummaryResponse(
        long available,
        long inUse,
        long maintenance
) {}
