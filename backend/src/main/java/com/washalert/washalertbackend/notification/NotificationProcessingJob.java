package com.washalert.washalertbackend.notification;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class NotificationProcessingJob {

    private final NotificationService notificationService;

    public NotificationProcessingJob(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @Scheduled(fixedDelayString = "${washalert.notification.process-interval-ms:60000}")
    public void processQueue() {
        notificationService.processPendingMessages();
    }
}
