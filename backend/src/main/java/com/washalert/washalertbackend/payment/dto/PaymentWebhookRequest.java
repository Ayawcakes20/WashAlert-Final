package com.washalert.washalertbackend.payment.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PaymentWebhookRequest(
        @NotBlank(message = "Event ID is required.")
        @Size(max = 120, message = "Event ID is too long.")
        String eventId,

        @NotBlank(message = "Provider is required.")
        @Size(max = 50, message = "Provider is too long.")
        String provider,

        @NotBlank(message = "Tracking number is required.")
        @Size(max = 40, message = "Tracking number is too long.")
        String trackingNumber,

        @Size(max = 100, message = "Reference number is too long.")
        String referenceNumber,

        @NotNull(message = "Amount is required.")
        @DecimalMin(value = "0.01", message = "Amount must be at least 0.01.")
        BigDecimal amount,

        @NotBlank(message = "Status is required.")
        @Size(max = 30, message = "Status is too long.")
        String status
) {
}
