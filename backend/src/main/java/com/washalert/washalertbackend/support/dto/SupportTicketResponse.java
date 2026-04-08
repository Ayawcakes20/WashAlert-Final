package com.washalert.washalertbackend.support.dto;

import java.time.LocalDateTime;

public record SupportTicketResponse(
        String ticketNumber,
        String issue,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
