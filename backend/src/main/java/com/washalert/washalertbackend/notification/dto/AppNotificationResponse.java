package com.washalert.washalertbackend.notification.dto;

import java.time.LocalDateTime;

public record AppNotificationResponse(
        String id,
        String title,
        String message,
        String route,
        String severity,
        LocalDateTime createdAt
) {
}
