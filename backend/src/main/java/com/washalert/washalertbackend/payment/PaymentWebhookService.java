package com.washalert.washalertbackend.payment;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.payment.dto.PaymentWebhookRequest;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderTimelineService;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
public class PaymentWebhookService {

    private final PaymentWebhookEventRepository eventRepository;
    private final PaymentRecordRepository paymentRepository;
    private final JobOrderRepository jobOrderRepository;
    private final PaymentWebhookProperties properties;
    private final NotificationService notificationService;
    private final JobOrderTimelineService timelineService;
    private final FirestoreSyncService firestoreSyncService;

    public PaymentWebhookService(
            PaymentWebhookEventRepository eventRepository,
            PaymentRecordRepository paymentRepository,
            JobOrderRepository jobOrderRepository,
            PaymentWebhookProperties properties,
            NotificationService notificationService,
            JobOrderTimelineService timelineService,
            FirestoreSyncService firestoreSyncService
    ) {
        this.eventRepository = eventRepository;
        this.paymentRepository = paymentRepository;
        this.jobOrderRepository = jobOrderRepository;
        this.properties = properties;
        this.notificationService = notificationService;
        this.timelineService = timelineService;
        this.firestoreSyncService = firestoreSyncService;
    }

    @Transactional
    public void receiveWebhook(PaymentWebhookRequest req, String signature) {
        validateSignature(req, signature);

        var existing = eventRepository.findByExternalEventId(req.eventId()).orElse(null);
        if (existing != null && existing.getProcessingStatus() == PaymentWebhookProcessingStatus.PROCESSED) {
            return;
        }

        PaymentWebhookEvent event = (existing == null)
                ? PaymentWebhookEvent.builder().externalEventId(req.eventId().trim()).build()
                : existing;

        event.setProvider(req.provider().trim());
        event.setTrackingNumber(normalize(req.trackingNumber()));
        event.setReferenceNumber(blankToNull(req.referenceNumber()));
        event.setAmount(req.amount());
        event.setExternalStatus(req.status().trim().toUpperCase(Locale.ROOT));
        event.setSignature(signature);
        event.setPayload(canonicalPayload(req));

        if (event.getProcessingStatus() == null || event.getProcessingStatus() == PaymentWebhookProcessingStatus.DEAD) {
            event.setProcessingStatus(PaymentWebhookProcessingStatus.RECEIVED);
            event.setAttempts(0);
        }

        eventRepository.save(event);
        processEvent(event);
    }

    @Transactional
    public void retryPendingEvents() {
        var events = eventRepository.findTop100ByProcessingStatusInAndNextRetryAtBeforeOrderByReceivedAtAsc(
                List.of(PaymentWebhookProcessingStatus.RECEIVED, PaymentWebhookProcessingStatus.FAILED),
                LocalDateTime.now()
        );

        for (var event : events) {
            processEvent(event);
        }
    }

    private void processEvent(PaymentWebhookEvent event) {
        try {
            PaymentRecord payment = paymentRepository.findByJobOrder_TrackingNumber(event.getTrackingNumber())
                    .orElseThrow(() -> new IllegalStateException("Payment record not found for tracking number."));

            if (payment.getAmount() != null && event.getAmount() != null
                    && payment.getAmount().compareTo(event.getAmount()) != 0) {
                throw new IllegalStateException("Webhook amount does not match payment record.");
            }

            String externalStatus = event.getExternalStatus();
            if (isSuccessStatus(externalStatus)) {
                if (payment.getStatus() == PaymentStatus.REJECTED) {
                    throw new IllegalStateException("Cannot mark rejected payment as paid via webhook.");
                }
                payment.setStatus(PaymentStatus.PAID);
                payment.setVerifiedAt(LocalDateTime.now());
                payment.setVerifiedBy("webhook:" + event.getProvider());
                payment.setNotes("Auto-updated by payment webhook event " + event.getExternalEventId());
                JobOrder order = payment.getJobOrder();
                if (order != null) {
                    order.setPaid(true);
                    if (order.getStatus() == JobOrderStatus.PENDING || order.getStatus() == JobOrderStatus.PRICE_CONFIRMED) {
                        order.setStatus(JobOrderStatus.WASHING);
                        timelineService.log(order, order.getStatus(), "system", "Payment confirmed via webhook");
                    }
                    jobOrderRepository.save(order);
                    firestoreSyncService.upsert("orders", order.getTrackingNumber(), JobOrderResponse.from(order, PaymentStatus.PAID));
                }
            } else if (isFailureStatus(externalStatus)) {
                if (payment.getStatus() == PaymentStatus.PAID || payment.getStatus() == PaymentStatus.VERIFIED) {
                    throw new IllegalStateException("Cannot mark already paid/verified payment as failed.");
                }
                payment.setStatus(PaymentStatus.REJECTED);
                payment.setVerifiedAt(LocalDateTime.now());
                payment.setVerifiedBy("webhook:" + event.getProvider());
                payment.setNotes("Rejected by payment webhook event " + event.getExternalEventId());
            } else {
                throw new IllegalArgumentException("Unsupported payment webhook status: " + externalStatus);
            }

            paymentRepository.save(payment);
            notificationService.enqueueEmail(
                    payment.getJobOrder().getCustomerEmail(),
                    "WashAlert Payment Confirmation",
                    "Tracking Number: %s\nPayment status updated via gateway: %s"
                            .formatted(payment.getJobOrder().getTrackingNumber(), payment.getStatus()),
                    "PAYMENT_WEBHOOK",
                    String.valueOf(payment.getId())
            );
            notificationService.enqueuePushToUserEmail(
                    payment.getJobOrder().getCustomerEmail(),
                    payment.getStatus() == PaymentStatus.PAID ? "Payment Confirmed" : "Payment Update",
                    "Payment for order %s is now %s."
                            .formatted(payment.getJobOrder().getTrackingNumber(), payment.getStatus().name()),
                    "PAYMENT_WEBHOOK",
                    payment.getJobOrder().getTrackingNumber() + ":" + payment.getStatus().name()
            );

            event.setProcessingStatus(PaymentWebhookProcessingStatus.PROCESSED);
            event.setProcessedAt(LocalDateTime.now());
            event.setLastError(null);
            event.setNextRetryAt(LocalDateTime.now());
            eventRepository.save(event);

        } catch (Exception ex) {
            int nextAttempts = event.getAttempts() + 1;
            event.setAttempts(nextAttempts);
            event.setLastError(truncate(ex.getMessage(), 500));

            if (nextAttempts >= properties.getMaxAttempts()) {
                event.setProcessingStatus(PaymentWebhookProcessingStatus.DEAD);
                event.setNextRetryAt(LocalDateTime.now());
            } else {
                event.setProcessingStatus(PaymentWebhookProcessingStatus.FAILED);
                event.setNextRetryAt(LocalDateTime.now().plusMinutes(properties.getRetryDelayMinutes()));
            }

            eventRepository.save(event);
        }
    }

    private void validateSignature(PaymentWebhookRequest req, String signature) {
        if (signature == null || signature.isBlank()) {
            throw new SecurityException("Missing webhook signature.");
        }

        String expected = hmacSha256Hex(canonicalPayload(req), properties.getSecret());
        if (!constantTimeEquals(expected, signature.trim().toLowerCase(Locale.ROOT))) {
            throw new SecurityException("Invalid webhook signature.");
        }
    }

    private String canonicalPayload(PaymentWebhookRequest req) {
        return String.join("|",
                req.eventId().trim(),
                req.provider().trim(),
                normalize(req.trackingNumber()),
                blankToEmpty(req.referenceNumber()),
                req.amount().toPlainString(),
                req.status().trim().toUpperCase(Locale.ROOT)
        );
    }

    private boolean isSuccessStatus(String status) {
        return "PAID".equals(status) || "SUCCESS".equals(status) || "VERIFIED".equals(status);
    }

    private boolean isFailureStatus(String status) {
        return "FAILED".equals(status) || "REJECTED".equals(status) || "DECLINED".equals(status);
    }

    private String hmacSha256Hex(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(raw);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to compute webhook signature.", ex);
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        byte[] x = a.getBytes(StandardCharsets.UTF_8);
        byte[] y = b.getBytes(StandardCharsets.UTF_8);
        if (x.length != y.length) return false;
        int result = 0;
        for (int i = 0; i < x.length; i++) {
            result |= x[i] ^ y[i];
        }
        return result == 0;
    }

    private String normalize(String trackingNumber) {
        return trackingNumber.trim().toUpperCase(Locale.ROOT);
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String t = value.trim();
        return t.isEmpty() ? null : t;
    }

    private String blankToEmpty(String value) {
        if (value == null) return "";
        return value.trim();
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
