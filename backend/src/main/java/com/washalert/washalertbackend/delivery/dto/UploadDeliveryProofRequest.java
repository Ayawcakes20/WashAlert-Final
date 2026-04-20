package com.washalert.washalertbackend.delivery.dto;

import com.washalert.washalertbackend.delivery.DeliveryProofType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UploadDeliveryProofRequest(
        @NotNull(message = "Proof type is required.")
        DeliveryProofType proofType,

        @NotNull(message = "Proof URL is required.")
        @Size(max = 1000, message = "Proof URL is too long.")
        String proofUrl
) {
}
