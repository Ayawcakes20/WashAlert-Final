package com.washalert.washalertbackend.orders;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum JobOrderStatus {
    PENDING,
    ASSIGNED_FOR_PICKUP,
    EN_ROUTE_TO_CUSTOMER,
    LAUNDRY_COLLECTED,
    EN_ROUTE_TO_BRANCH,
    ORDER_RECEIVED,
    AWAITING_PRICE_CONFIRMATION,
    PRICE_CONFIRMED,
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
        if (raw == null) return null;
        String normalized = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        if ("READY_FOR_PICKUP".equals(normalized)) {
            return READY;
        }
        if ("COMPLETED".equals(normalized)) {
            return DELIVERED;
        }
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
    }

    @JsonValue
    public String toJson() {
        return name();
    }
}
