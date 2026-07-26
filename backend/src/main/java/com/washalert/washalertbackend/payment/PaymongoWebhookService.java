package com.washalert.washalertbackend.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;

@Slf4j
@Service
public class PaymongoWebhookService {

    private final PaymentRecordRepository paymentRepository;
    private final PaymentService paymentService;
    private final PaymongoProperties properties;
    private final ObjectMapper objectMapper;

    public PaymongoWebhookService(
            PaymentRecordRepository paymentRepository,
            PaymentService paymentService,
            PaymongoProperties properties,
            ObjectMapper objectMapper
    ) {
        this.paymentRepository = paymentRepository;
        this.paymentService = paymentService;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * Verifies the PayMongo webhook signature over the RAW request body and, only if
     * valid, parses and processes the payload. PayMongo signs {@code "<timestamp>.<rawBody>"}
     * with HMAC-SHA256 using the webhook secret, and sends the header as
     * {@code t=<timestamp>,te=<test-mode-signature>,li=<live-mode-signature>}.
     *
     * @throws SecurityException if the signature is missing, malformed, or does not match.
     */
    @Transactional
    public void verifyAndHandleWebhook(String rawBody, String signatureHeader) {
        String secret = properties.getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            log.error("Paymongo webhook secret is not configured — rejecting webhook.");
            throw new SecurityException("Webhook verification is not configured.");
        }
        if (signatureHeader == null || signatureHeader.isBlank()) {
            throw new SecurityException("Missing webhook signature.");
        }

        Map<String, String> parts = parseSignatureHeader(signatureHeader);
        String timestamp = parts.get("t");
        // Prefer the live-mode signature; fall back to test-mode so sandbox testing keeps working.
        String providedSignature = parts.getOrDefault("li", parts.get("te"));

        if (timestamp == null || providedSignature == null) {
            throw new SecurityException("Malformed webhook signature header.");
        }

        String signedPayload = timestamp + "." + rawBody;
        String expected = hmacSha256Hex(signedPayload, secret);
        if (!constantTimeEquals(expected, providedSignature.trim().toLowerCase())) {
            throw new SecurityException("Invalid webhook signature.");
        }

        Map<String, Object> payload;
        try {
            payload = objectMapper.readValue(rawBody, Map.class);
        } catch (Exception ex) {
            throw new SecurityException("Malformed webhook payload.");
        }

        handleWebhook(payload);
    }

    private Map<String, String> parseSignatureHeader(String header) {
        Map<String, String> result = new java.util.HashMap<>();
        for (String segment : header.split(",")) {
            String[] kv = segment.split("=", 2);
            if (kv.length == 2) {
                result.put(kv[0].trim(), kv[1].trim());
            }
        }
        return result;
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

    private void handleWebhook(Map<String, Object> payload) {
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
