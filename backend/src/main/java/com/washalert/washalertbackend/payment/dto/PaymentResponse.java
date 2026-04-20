package com.washalert.washalertbackend.payment.dto;

import com.washalert.washalertbackend.payment.PaymentMethod;
import com.washalert.washalertbackend.payment.PaymentStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PaymentResponse(
        Long id,
        String trackingNumber,
        String branch,
        PaymentMethod method,
        BigDecimal amount,
        String referenceNumber,
        String proofUrl,
        PaymentStatus status,
        LocalDateTime submittedAt,
        LocalDateTime verifiedAt,
        String verifiedBy,
        String notes
) {
}
