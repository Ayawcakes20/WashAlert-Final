package com.washalert.washalertbackend.orders.dto;

import jakarta.validation.constraints.NotNull;

public record AssignDriverRequest(
        @NotNull(message = "Driver ID is required.")
        Long driverId
) {}
