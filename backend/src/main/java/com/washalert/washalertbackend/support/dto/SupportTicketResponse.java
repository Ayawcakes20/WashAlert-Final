package com.washalert.washalertbackend.support.dto;

import java.time.LocalDateTime;

public record SupportTicketResponse(
                String ticketNumber,
                String sessionId,
                String issue,
                String status,
                String branch,
                LocalDateTime createdAt,
                LocalDateTime updatedAt) {
}
