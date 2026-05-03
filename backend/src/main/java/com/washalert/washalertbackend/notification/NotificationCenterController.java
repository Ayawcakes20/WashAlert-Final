package com.washalert.washalertbackend.notification;

import com.washalert.washalertbackend.notification.dto.AppNotificationResponse;
import com.washalert.washalertbackend.common.dto.PagedResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationCenterController {

    private final NotificationCenterService notificationCenterService;

    public NotificationCenterController(NotificationCenterService notificationCenterService) {
        this.notificationCenterService = notificationCenterService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','DRIVER','CUSTOMER')")
    public List<AppNotificationResponse> list(@AuthenticationPrincipal AuthUserDetails principal) {
        return notificationCenterService.list(principal);
    }

    @GetMapping("/paged")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','DRIVER','CUSTOMER')")
    public PagedResponse<AppNotificationResponse> listPaged(
            @RequestParam(required = false) String page,
            @RequestParam(required = false) String size,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return notificationCenterService.listPaged(
                principal,
                parseIntOrDefault(page, 0, 0, Integer.MAX_VALUE),
                parseIntOrDefault(size, 10, 1, 100)
        );
    }

    private int parseIntOrDefault(String value, int fallback, int min, int max) {
        int parsed = fallback;
        if (value != null && !value.trim().isEmpty()) {
            try {
                parsed = Integer.parseInt(value.trim());
            } catch (NumberFormatException ignored) {
                parsed = fallback;
            }
        }
        if (parsed < min) return min;
        return Math.min(parsed, max);
    }
}
