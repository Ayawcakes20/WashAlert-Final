package com.washalert.washalertbackend.support.dto;

import java.util.List;

public record ChatHistoryResponse(
        List<ChatHistoryMessageResponse> messages,
        List<SupportTicketResponse> tickets
) {
}
