package com.washalert.washalertbackend.payment.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * response DTO for Gcash checkout initiation.
 * Returns the checkout URL in a JSON object to match frontend expectations.
 */
public record GcashCheckoutResponse(
        @JsonProperty("checkout_url")
        String checkoutUrl
) {
}
