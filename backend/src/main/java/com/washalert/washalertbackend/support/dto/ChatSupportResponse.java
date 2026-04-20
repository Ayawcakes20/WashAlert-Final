package com.washalert.washalertbackend.support.dto;

public record ChatSupportResponse(
        String category,
        String reply,
        boolean escalated,
        String escalationTicket,
        Object data
) {
}
