package com.washalert.washalertbackend.payment;

import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.JobOrderTimelineService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Service
public class PaymongoWebhookService {

    private final PaymentRecordRepository paymentRepository;
    private final JobOrderRepository jobOrderRepository;
    private final NotificationService notificationService;
    private final JobOrderTimelineService timelineService;

    public PaymongoWebhookService(
            PaymentRecordRepository paymentRepository,
            JobOrderRepository jobOrderRepository,
            NotificationService notificationService,
            JobOrderTimelineService timelineService
    ) {
        this.paymentRepository = paymentRepository;
        this.jobOrderRepository = jobOrderRepository;
        this.notificationService = notificationService;
        this.timelineService = timelineService;
    }

    @Transactional
    public void handleWebhook(Map<String, Object> payload) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) payload.get("data");
            @SuppressWarnings("unchecked")
            Map<String, Object> attributes = (Map<String, Object>) data.get("attributes");
            
            String eventType = (String) attributes.get("type");
            log.info("Processing Paymongo Webhook Event: {}", eventType);

            if ("checkout_session.payment.paid".equals(eventType)) {
                @SuppressWarnings("unchecked")
                Map<String, Object> eventData = (Map<String, Object>) attributes.get("data");
                @SuppressWarnings("unchecked")
                Map<String, Object> sessionAttrs = (Map<String, Object>) eventData.get("attributes");
                
                String trackingNumber = (String) sessionAttrs.get("reference_number");
                if (trackingNumber == null) {
                    log.warn("Paymongo webhook missing reference_number (trackingNumber).");
                    return;
                }

                PaymentRecord record = paymentRepository.findByJobOrder_TrackingNumber(trackingNumber.toUpperCase())
                        .orElseThrow(() -> new IllegalStateException("Payment record not found for: " + trackingNumber));

                if (record.getStatus() != PaymentStatus.PAID) {
                    record.setStatus(PaymentStatus.PAID);
                    record.setVerifiedAt(LocalDateTime.now());
                    record.setVerifiedBy("Paymongo Webhook");
                    record.setReferenceNumber((String) eventData.get("id")); // Session ID or similar
                    paymentRepository.save(record);

                    JobOrder jobOrder = record.getJobOrder();
                    jobOrder.setPaid(true);
                    if (jobOrder.getStatus() == JobOrderStatus.PENDING) {
                        jobOrder.setStatus(JobOrderStatus.WASHING);
                        timelineService.log(jobOrder, jobOrder.getStatus(), "system", "Payment confirmed via PayMongo webhook");
                    }
                    jobOrderRepository.save(jobOrder);

                    notificationService.enqueueEmail(
                            jobOrder.getCustomerEmail(),
                            "WashAlert Payment Received!",
                            "Your payment for order %s has been confirmed. We are now processing your laundry.".formatted(trackingNumber),
                            "PAYMENT_PAID",
                            String.valueOf(record.getId())
                    );
                    notificationService.enqueuePushToUserEmail(
                            jobOrder.getCustomerEmail(),
                            "Payment Confirmed",
                            "Payment for order %s has been confirmed.".formatted(trackingNumber),
                            "PAYMENT_PAID",
                            trackingNumber.toUpperCase() + ":paid"
                    );
                }
            }
        } catch (Exception ex) {
            log.error("Failed to process Paymongo webhook: {}", ex.getMessage(), ex);
            throw new RuntimeException("Webhook processing error");
        }
    }
}
