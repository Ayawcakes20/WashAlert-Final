package com.washalert.washalertbackend.support.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatSupportRequest(
        @NotBlank(message = "Message is required.")
        @Size(max = 1000, message = "Message is too long.")
        String message,
        @Size(max = 20, message = "Tracking number is too long.")
        String trackingNumber,
        @Size(max = 80, message = "Session id is too long.")
        String sessionId,
        @Size(max = 80, message = "Branch is too long.")
        String selectedBranch,
        @Size(max = 100, message = "Sender name is too long.")
        String senderName
) {
    public ChatSupportRequest(String message, String trackingNumber) {
        this(message, trackingNumber, null, null, null);
    }
}
