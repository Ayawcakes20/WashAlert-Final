package com.washalert.washalertbackend.notification;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.washalert.washalertbackend.verification.MailService;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationMessageRepository notificationRepository;
    private final NotificationProperties properties;
    private final MailService mailService;
    private final FirebaseMessaging firebaseMessaging;

    public NotificationService(
            NotificationMessageRepository notificationRepository,
            NotificationProperties properties,
            MailService mailService,
            FirebaseMessaging firebaseMessaging
    ) {
        this.notificationRepository = notificationRepository;
        this.properties = properties;
        this.mailService = mailService;
        this.firebaseMessaging = firebaseMessaging;
    }

    @Transactional
    public void enqueueEmail(String recipient, String subject, String body, String relatedType, String relatedId) {
        if (recipient == null || recipient.isBlank()) return;

        NotificationMessage msg = NotificationMessage.builder()
                .channel(NotificationChannel.EMAIL)
                .recipient(recipient.trim())
                .subject(subject)
                .body(body)
                .relatedType(blankToNull(relatedType))
                .relatedId(blankToNull(relatedId))
                .status(NotificationStatus.PENDING)
                .attempts(0)
                .nextAttemptAt(LocalDateTime.now())
                .build();

        notificationRepository.save(msg);
    }

    @Transactional
    public void enqueuePush(String fcmToken, String title, String body, String relatedType, String relatedId) {
        if (fcmToken == null || fcmToken.isBlank()) return;

        NotificationMessage msg = NotificationMessage.builder()
                .channel(NotificationChannel.PUSH)
                .recipient(fcmToken.trim())
                .subject(title)
                .body(body)
                .relatedType(blankToNull(relatedType))
                .relatedId(blankToNull(relatedId))
                .status(NotificationStatus.PENDING)
                .attempts(0)
                .nextAttemptAt(LocalDateTime.now())
                .build();

        notificationRepository.save(msg);
    }

    @Transactional
    public void processPendingMessages() {
        List<NotificationMessage> batch = notificationRepository.findTop100ByStatusInAndNextAttemptAtBeforeOrderByCreatedAtAsc(
                List.of(NotificationStatus.PENDING, NotificationStatus.FAILED),
                LocalDateTime.now()
        );

        for (NotificationMessage msg : batch) {
            processOne(msg);
        }
    }

    private void processOne(NotificationMessage msg) {
        try {
            if (msg.getChannel() == NotificationChannel.EMAIL) {
                mailService.sendGeneralEmail(msg.getRecipient(), msg.getSubject(), msg.getBody());
            } else if (msg.getChannel() == NotificationChannel.PUSH) {
                sendPushMessage(msg);
            } else {
                throw new IllegalStateException("Unsupported notification channel: " + msg.getChannel());
            }

            msg.setStatus(NotificationStatus.SENT);
            msg.setSentAt(LocalDateTime.now());
            msg.setLastError(null);
            notificationRepository.save(msg);

        } catch (Exception ex) {
            int nextAttempts = msg.getAttempts() + 1;
            msg.setAttempts(nextAttempts);
            msg.setLastError(truncate(ex.getMessage(), 500));

            if (nextAttempts >= properties.getMaxAttempts()) {
                msg.setStatus(NotificationStatus.DEAD);
                msg.setNextAttemptAt(LocalDateTime.now());
            } else {
                msg.setStatus(NotificationStatus.FAILED);
                msg.setNextAttemptAt(LocalDateTime.now().plusMinutes(properties.getRetryDelayMinutes()));
            }

            notificationRepository.save(msg);
        }
    }

    private void sendPushMessage(NotificationMessage msg) throws Exception {
        if (firebaseMessaging == null) {
            throw new IllegalStateException("FirebaseMessaging not initialized");
        }

        Notification notification = Notification.builder()
                .setTitle(msg.getSubject())
                .setBody(msg.getBody())
                .build();

        Message message = Message.builder()
                .setToken(msg.getRecipient())
                .setNotification(notification)
                .putData("type", msg.getRelatedType() != null ? msg.getRelatedType() : "GENERAL")
                .putData("id", msg.getRelatedId() != null ? msg.getRelatedId() : "")
                .build();

        firebaseMessaging.send(message);
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
