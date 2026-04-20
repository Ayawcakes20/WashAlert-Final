package com.washalert.washalertbackend.support.dto;

import java.time.LocalDateTime;

public record ChatHistoryMessageResponse(
        Long id,
        String senderType,
        String message,
        String category,
        String escalationTicket,
        LocalDateTime createdAt
) {
}
