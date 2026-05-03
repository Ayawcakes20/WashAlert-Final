package com.washalert.washalertbackend.orders;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

public enum JobOrderStatus {
    PENDING, <<<<<<<HEAD
    ASSIGNED_FOR_PICKUP,
    EN_ROUTE_TO_CUSTOMER,
    LAUNDRY_COLLECTED,
    EN_ROUTE_TO_BRANCH,
    ORDER_RECEIVED,
    AWAITING_PRICE_CONFIRMATION,
    PRICE_CONFIRMED, =======
    AWAITING_PRICE_CONFIRMATION, >>>>>>>6 c38a50ed45ad393e9b6df90b2245ac750cada53
    WASHING,
    DRYING,
    READY,
    ASSIGNED_FOR_DELIVERY,
    OUT_FOR_DELIVERY,
    DELIVERED,
    COLLECTION_FAILED,
    FAILED,
    CANCELLED;

    @JsonCreator
    public static JobOrderStatus fromJson(String raw) {
        if (raw == null)
            return null;
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
<<<<<<< HEAD
        if ("AWAITING_CONFIRMATION".equals(normalized) || "AWAITING_PRICE_CONFIRMATION".equals(normalized) || "PRICE_CONFIRMATION".equals(normalized)) {
            return AWAITING_PRICE_CONFIRMATION;
        }
        if ("ORDER_RECEIVED".equals(normalized) || "PICKED_UP".equals(normalized)) {
            return ORDER_RECEIVED;
        }
        if ("PRICE_CONFIRMED".equals(normalized)) {
            return PRICE_CONFIRMED;
        }
        return JobOrderStatus.valueOf(normalized);
=======
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
>>>>>>> 6c38a50ed45ad393e9b6df90b2245ac750cada53
    }

    @JsonValue
    public String toJson() {
        return name();
    }
}
