package com.washalert.washalertbackend.notification;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserDeviceTokenRepository;
import com.washalert.washalertbackend.user.UserDeviceTokenService;
import com.washalert.washalertbackend.user.UserRepository;
import com.washalert.washalertbackend.verification.MailService;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationMessageRepository notificationRepository;
    private final NotificationProperties properties;
    private final MailService mailService;
    private final FirebaseMessaging firebaseMessaging;
    private final UserRepository userRepository;
    private final UserDeviceTokenRepository userDeviceTokenRepository;
    private final UserDeviceTokenService userDeviceTokenService;

    public NotificationService(
            NotificationMessageRepository notificationRepository,
            NotificationProperties properties,
            MailService mailService,
            ObjectProvider<FirebaseMessaging> firebaseMessagingProvider,
            UserRepository userRepository,
            UserDeviceTokenRepository userDeviceTokenRepository,
            UserDeviceTokenService userDeviceTokenService
    ) {
        this.notificationRepository = notificationRepository;
        this.properties = properties;
        this.mailService = mailService;
        this.firebaseMessaging = firebaseMessagingProvider.getIfAvailable();
        this.userRepository = userRepository;
        this.userDeviceTokenRepository = userDeviceTokenRepository;
        this.userDeviceTokenService = userDeviceTokenService;
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

        String cleanToken = fcmToken.trim();
        String cleanRelatedType = blankToNull(relatedType);
        String cleanRelatedId = blankToNull(relatedId);

        if (cleanRelatedType != null && cleanRelatedId != null) {
            boolean alreadyQueued = notificationRepository.existsByChannelAndRecipientAndRelatedTypeAndRelatedIdAndStatusIn(
                    NotificationChannel.PUSH,
                    cleanToken,
                    cleanRelatedType,
                    cleanRelatedId,
                    List.of(NotificationStatus.PENDING, NotificationStatus.SENT)
            );
            if (alreadyQueued) {
                log.debug("Skipping duplicate push notification queue item type={} id={} token={}", cleanRelatedType, cleanRelatedId, cleanToken);
                return;
            }
        }

        NotificationMessage msg = NotificationMessage.builder()
                .channel(NotificationChannel.PUSH)
                .recipient(cleanToken)
                .subject(title)
                .body(body)
                .relatedType(cleanRelatedType)
                .relatedId(cleanRelatedId)
                .status(NotificationStatus.PENDING)
                .attempts(0)
                .nextAttemptAt(LocalDateTime.now())
                .build();

        notificationRepository.save(msg);
    }

    @Transactional
    public void enqueuePushToUser(User user, String title, String body, String relatedType, String relatedId) {
        if (user == null) return;
        collectTokensForUser(user).forEach(token ->
                enqueuePush(token, title, body, relatedType, relatedId)
        );
    }

    @Transactional
    public void enqueuePushToUserEmail(String email, String title, String body, String relatedType, String relatedId) {
        if (email == null || email.isBlank()) return;
        collectTokensForEmail(email).forEach(token ->
                enqueuePush(token, title, body, relatedType, relatedId)
        );
    }

    @Transactional
    public void enqueuePushToRoles(List<Role> roles, String branch, String title, String body, String relatedType, String relatedId) {
        if (roles == null || roles.isEmpty()) return;

        Set<String> allTokens = new LinkedHashSet<>();
        List<Role> roleList = roles.stream().distinct().toList();

        if (branch == null || branch.isBlank()) {
            userDeviceTokenRepository.findByUser_RoleInAndActiveTrueAndUser_EnabledTrue(roleList)
                    .forEach(token -> allTokens.add(token.getFcmToken()));
            userRepository.findByRoleIn(roleList).forEach(user -> addLegacyToken(allTokens, user));
        } else {
            String normalizedBranch = branch.trim();
            List<Role> branchScopedRoles = roleList.stream()
                    .filter(role -> role != Role.ADMIN)
                    .toList();
            if (!branchScopedRoles.isEmpty()) {
                userDeviceTokenRepository.findByUser_RoleInAndUser_BranchIgnoreCaseAndActiveTrueAndUser_EnabledTrue(
                        branchScopedRoles,
                        normalizedBranch
                ).forEach(token -> allTokens.add(token.getFcmToken()));
                branchScopedRoles.forEach(role ->
                        userRepository.findByRoleAndNormalizedBranch(role, normalizedBranch)
                                .forEach(user -> addLegacyToken(allTokens, user))
                );
            }

            if (roleList.contains(Role.ADMIN)) {
                userDeviceTokenRepository.findByUser_RoleInAndActiveTrueAndUser_EnabledTrue(List.of(Role.ADMIN))
                        .forEach(token -> allTokens.add(token.getFcmToken()));
                userRepository.findByRole(Role.ADMIN).forEach(user -> addLegacyToken(allTokens, user));
            }
        }

        allTokens.forEach(token -> enqueuePush(token, title, body, relatedType, relatedId));
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
            boolean permanentPushPermissionFailure =
                    msg.getChannel() == NotificationChannel.PUSH && isPushPermissionDenied(ex);
            if (msg.getChannel() == NotificationChannel.PUSH && isInvalidPushTokenError(ex)) {
                userDeviceTokenService.deactivateToken(msg.getRecipient());
            }

            int nextAttempts = msg.getAttempts() + 1;
            msg.setAttempts(nextAttempts);
            msg.setLastError(truncate(ex.getMessage(), 500));

            if (permanentPushPermissionFailure) {
                msg.setStatus(NotificationStatus.DEAD);
                msg.setNextAttemptAt(LocalDateTime.now());
                log.error(
                        "[PUSH] Permission denied while sending notifications. Marking message DEAD. " +
                                "Action required: grant Firebase service account Cloud Messaging Sender role and enable FCM API. error={}",
                        ex.getMessage()
                );
            } else if (nextAttempts >= properties.getMaxAttempts()) {
                msg.setStatus(NotificationStatus.DEAD);
                msg.setNextAttemptAt(LocalDateTime.now());
            } else {
                msg.setStatus(NotificationStatus.FAILED);
                msg.setNextAttemptAt(LocalDateTime.now().plusMinutes(properties.getRetryDelayMinutes()));
            }

            log.warn(
                    "Notification send failed channel={} recipient={} attempts={} error={}",
                    msg.getChannel(),
                    msg.getRecipient(),
                    nextAttempts,
                    ex.getMessage()
            );
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
        log.debug("Push sent type={} id={} token={}", msg.getRelatedType(), msg.getRelatedId(), msg.getRecipient());
    }

    private Set<String> collectTokensForUser(User user) {
        Set<String> tokens = new LinkedHashSet<>();
        if (user == null || user.getId() == null) return tokens;

        userDeviceTokenRepository.findByUser_IdAndActiveTrue(user.getId())
                .forEach(deviceToken -> addToken(tokens, deviceToken.getFcmToken()));
        addLegacyToken(tokens, user);
        return tokens;
    }

    private Set<String> collectTokensForEmail(String email) {
        Set<String> tokens = new LinkedHashSet<>();
        if (email == null || email.isBlank()) return tokens;

        userDeviceTokenRepository.findByUser_EmailIgnoreCaseAndActiveTrue(email.trim())
                .forEach(deviceToken -> addToken(tokens, deviceToken.getFcmToken()));
        userRepository.findByEmail(email.trim()).ifPresent(user -> addLegacyToken(tokens, user));
        return tokens;
    }

    private void addLegacyToken(Set<String> target, User user) {
        if (user == null) return;
        addToken(target, user.getFcmToken());
    }

    private void addToken(Set<String> target, String token) {
        if (token == null) return;
        String trimmed = token.trim();
        if (!trimmed.isEmpty()) {
            target.add(trimmed);
        }
    }

    private boolean isInvalidPushTokenError(Exception ex) {
        if (ex instanceof FirebaseMessagingException fme) {
            String code = fme.getMessagingErrorCode() != null
                    ? fme.getMessagingErrorCode().name()
                    : "";
            if ("UNREGISTERED".equals(code) || "INVALID_ARGUMENT".equals(code)) {
                return true;
            }
        }
        String msg = String.valueOf(ex.getMessage()).toLowerCase(Locale.ROOT);
        return msg.contains("registration token is not a valid")
                || msg.contains("requested entity was not found")
                || msg.contains("unregistered");
    }

    private boolean isPushPermissionDenied(Exception ex) {
        String msg = String.valueOf(ex.getMessage()).toLowerCase(Locale.ROOT);
        return msg.contains("permission") && msg.contains("cloudmessaging.messages.create")
                || msg.contains("permission denied")
                || msg.contains("sender id")
                || msg.contains("mismatched credential");
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
