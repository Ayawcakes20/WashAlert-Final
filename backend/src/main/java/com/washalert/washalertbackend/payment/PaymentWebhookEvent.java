package com.washalert.washalertbackend.payment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "payment_webhook_events",
        indexes = {
                @Index(name = "idx_payment_webhook_events_external", columnList = "external_event_id", unique = true),
                @Index(name = "idx_payment_webhook_events_status_next", columnList = "processing_status,next_retry_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentWebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_event_id", nullable = false, unique = true, length = 120)
    private String externalEventId;

    @Column(nullable = false, length = 50)
    private String provider;

    @Column(name = "tracking_number", nullable = false, length = 40)
    private String trackingNumber;

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "external_status", nullable = false, length = 30)
    private String externalStatus;

    @Column(name = "signature", length = 255)
    private String signature;

    @Column(name = "payload", columnDefinition = "TEXT")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(name = "processing_status", nullable = false, length = 20)
    private PaymentWebhookProcessingStatus processingStatus;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "last_error", length = 500)
    private String lastError;

    @Column(name = "next_retry_at")
    private LocalDateTime nextRetryAt;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (receivedAt == null) receivedAt = now;
        if (updatedAt == null) updatedAt = now;
        if (processingStatus == null) processingStatus = PaymentWebhookProcessingStatus.RECEIVED;
        if (nextRetryAt == null) nextRetryAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
