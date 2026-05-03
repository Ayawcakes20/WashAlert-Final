package com.washalert.washalertbackend.support.dto;

import jakarta.validation.constraints.NotBlank;

public record ChatSupportRequest(
        @NotBlank(message = "Message is required.")
        String message,
        String trackingNumber,
        String sessionId,
        String selectedBranch,
        String senderName
) {
    public ChatSupportRequest(String message, String trackingNumber) {
        this(message, trackingNumber, null, null, null);
    }
}
