package com.washalert.washalertbackend.orders.dto;

import com.washalert.washalertbackend.orders.ServiceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EditJobOrderRequest(
        @NotBlank(message = "Customer name is required.")
        @Size(max = 120, message = "Customer name is too long.")
        String customerName,

        @NotNull(message = "Service type is required.")
        ServiceType serviceType,

        @NotBlank(message = "Branch is required.")
        @Size(max = 80, message = "Branch is too long.")
        String branch
) {}
