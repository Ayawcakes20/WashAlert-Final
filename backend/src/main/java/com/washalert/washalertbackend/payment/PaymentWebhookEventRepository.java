package com.washalert.washalertbackend.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentWebhookEventRepository extends JpaRepository<PaymentWebhookEvent, Long> {
    Optional<PaymentWebhookEvent> findByExternalEventId(String externalEventId);

    List<PaymentWebhookEvent> findTop100ByProcessingStatusInAndNextRetryAtBeforeOrderByReceivedAtAsc(
            List<PaymentWebhookProcessingStatus> statuses,
            LocalDateTime nextRetryAt
    );
}
