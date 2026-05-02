package com.washalert.washalertbackend.orders;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

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
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return fromValueOrThrow(trimmed);
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

    public static JobOrderStatus fromValueOrThrow(String raw) {
        JobOrderStatus parsed = fromValueOrFallback(raw, null);
        if (parsed != null) {
            return parsed;
        }
        throw new IllegalArgumentException("Invalid job order status. Allowed values: " + allowedValuesCsv());
    }

    private static String allowedValuesCsv() {
        return Arrays.stream(values())
                .map(Enum::name)
                .collect(Collectors.joining(", "));
    }

    @JsonValue
    public String toJson() {
        return name();
    }
}
