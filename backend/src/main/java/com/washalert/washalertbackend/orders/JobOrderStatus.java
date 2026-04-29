package com.washalert.washalertbackend.orders;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum JobOrderStatus {
    PENDING,
    WASHING,
    DRYING,
    READY,
    PICKED_UP,
    DELIVERED,
    CANCELLED;

    @JsonCreator
    public static JobOrderStatus fromJson(String raw) {
        if (raw == null) return null;
        String normalized = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        if ("READY_FOR_PICKUP".equals(normalized)) {
            return READY;
        }
        if ("COMPLETED".equals(normalized)) {
            return DELIVERED;
        }
        return JobOrderStatus.valueOf(normalized);
    }

    @JsonValue
    public String toJson() {
        return name();
    }
}
