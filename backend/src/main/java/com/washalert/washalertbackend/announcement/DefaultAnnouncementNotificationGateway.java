package com.washalert.washalertbackend.announcement;

import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.user.User;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DefaultAnnouncementNotificationGateway implements AnnouncementNotificationGateway {

    private final NotificationService notificationService;

    public DefaultAnnouncementNotificationGateway(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @Override
    public void dispatchInApp(Announcement announcement, List<User> recipients) {
        // In-app delivery is handled by storing announcements in MySQL and exposing them via /api/notifications.
        // This method is intentionally explicit so we keep a channel abstraction for future extensions.
    }

    @Override
    public void dispatchPush(Announcement announcement, List<User> recipients) {
        if (announcement == null || recipients == null || recipients.isEmpty()) {
            return;
        }

        for (User recipient : recipients) {
            if (recipient == null || recipient.getFcmToken() == null || recipient.getFcmToken().isBlank()) {
                continue;
            }
            notificationService.enqueuePush(
                    recipient.getFcmToken(),
                    announcement.getTitle(),
                    announcement.getMessage(),
                    "ANNOUNCEMENT",
                    String.valueOf(announcement.getId())
            );
        }
    }

    @Override
    public void dispatchSms(Announcement announcement, List<User> recipients) {
        // Placeholder adapter for future SMS provider integration.
        // Intentionally no-op until SMS transport is configured.
    }
}
