package com.washalert.washalertbackend.orders.dto;

import com.washalert.washalertbackend.orders.JobOrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateJobOrderRequest(
        @NotNull(message = "Status is required.")
        JobOrderStatus status,
        Boolean codCollected
) {}
