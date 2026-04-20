package com.washalert.washalertbackend.payment.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record VerifyPaymentRequest(
        @NotNull(message = "Approved flag is required.")
        Boolean approved,

        @Size(max = 300, message = "Notes are too long.")
        String notes
) {
}
