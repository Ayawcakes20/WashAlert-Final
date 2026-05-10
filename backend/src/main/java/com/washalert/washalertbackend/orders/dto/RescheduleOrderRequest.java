package com.washalert.washalertbackend.orders.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public record RescheduleOrderRequest(
        @NotNull LocalDate newDate,
        @NotNull LocalTime newSlotStartTime
) {}
