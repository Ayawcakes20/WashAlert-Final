package com.washalert.washalertbackend.orders;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum JobOrderStatus {
    PENDING,
    AWAITING_PRICE_CONFIRMATION,
    WASHING,
    DRYING,
    READY,
    PICKED_UP,
    DELIVERED,
    CANCELLED;

    @JsonCreator
    public static JobOrderStatus fromJson(String raw) {
        if (raw == null) return null;
        return fromValueOrFallback(raw, null);
    }

    public static JobOrderStatus fromValueOrFallback(String raw, JobOrderStatus fallback) {
        if (raw == null) return fallback;
        String normalized = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        if (normalized.isBlank()) {
            return fallback;
        }
        if ("READY_FOR_PICKUP".equals(normalized)) {
            return READY;
        }
        if ("COMPLETED".equals(normalized)) {
            return DELIVERED;
        }
        try {
            return JobOrderStatus.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            return fallback;
        }
    }

    @JsonValue
    public String toJson() {
        return name();
    }
}
