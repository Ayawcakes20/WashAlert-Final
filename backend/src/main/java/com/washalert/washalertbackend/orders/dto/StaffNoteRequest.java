package com.washalert.washalertbackend.orders.dto;

import jakarta.validation.constraints.Size;

public record StaffNoteRequest(
        @Size(max = 300) String note
) {}
