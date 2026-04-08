package com.washalert.washalertbackend.notification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationMessageRepository extends JpaRepository<NotificationMessage, Long> {
    List<NotificationMessage> findTop100ByStatusInAndNextAttemptAtBeforeOrderByCreatedAtAsc(
            List<NotificationStatus> statuses,
            LocalDateTime nextAttemptAt
    );
}
