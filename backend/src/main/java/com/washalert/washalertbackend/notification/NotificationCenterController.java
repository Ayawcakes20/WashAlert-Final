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
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return notificationCenterService.listPaged(principal, page, size);
    }
}
