package com.washalert.washalertbackend.booking.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record BookingSlotResponse(
        LocalDate date,
        LocalTime slotStartTime,
        LocalTime slotEndTime,
        long capacity,
        long bookedCount,
        long slotsRemaining,
        boolean available
) {
}
