package com.washalert.washalertbackend.payment.dto;

import com.washalert.washalertbackend.payment.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record SubmitPaymentProofRequest(
        @NotBlank(message = "Tracking number is required.")
        String trackingNumber,

        @NotNull(message = "Payment method is required.")
        PaymentMethod method,

        @NotNull(message = "Amount is required.")
        @DecimalMin(value = "0.01", message = "Amount must be at least 0.01.")
        BigDecimal amount,

        @NotBlank(message = "Reference number is required.")
        @Size(max = 100, message = "Reference number is too long.")
        String referenceNumber,

        @NotBlank(message = "Proof URL is required.")
        @Size(max = 255, message = "Proof URL is too long.")
        String proofUrl
) {
}
