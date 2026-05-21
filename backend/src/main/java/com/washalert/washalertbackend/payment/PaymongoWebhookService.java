package com.washalert.washalertbackend.payment;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Slf4j
@Service
public class PaymongoWebhookService {

    private final PaymentRecordRepository paymentRepository;
    private final PaymentService paymentService;

    public PaymongoWebhookService(
            PaymentRecordRepository paymentRepository,
            PaymentService paymentService
    ) {
        this.paymentRepository = paymentRepository;
        this.paymentService = paymentService;
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

            if ("checkout_session.payment.paid".equals(eventType) || "checkout_session.payment_success".equals(eventType)) {
                @SuppressWarnings("unchecked")
                Map<String, Object> eventData = (Map<String, Object>) attributes.get("data");
                @SuppressWarnings("unchecked")
                Map<String, Object> sessionAttrs = (Map<String, Object>) eventData.get("attributes");
                
                String trackingNumber = (String) sessionAttrs.get("reference_number");
                if (trackingNumber == null) {
                    log.warn("Paymongo webhook missing reference_number (trackingNumber). Event: {}", eventType);
                    return;
                }

                // Use List variant + findFirst() to avoid IncorrectResultSizeDataAccessException
                // when multiple payment records exist for the same order (e.g. customer tapped GCash pay twice)
                PaymentRecord record = paymentRepository
                        .findByJobOrder_TrackingNumberOrderBySubmittedAtDesc(trackingNumber.toUpperCase())
                        .stream()
                        .findFirst()
                        .orElseThrow(() -> new IllegalStateException("Payment record not found for: " + trackingNumber));

                paymentService.confirmPayment(record, (String) eventData.get("id"), "Paymongo Webhook");
            } else {
                log.info("Ignored Paymongo event: {}", eventType);
            }
        } catch (Exception ex) {
            // Log the error but do NOT re-throw — rethrowing causes HTTP 500 which makes
            // PayMongo retry the webhook indefinitely. We return 200 from the controller
            // regardless, and rely on PayMongo's dashboard for manual inspection.
            log.error("Failed to process Paymongo webhook: {}", ex.getMessage(), ex);
        }
    }
}
