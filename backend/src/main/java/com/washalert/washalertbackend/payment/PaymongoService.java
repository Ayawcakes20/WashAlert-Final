package com.washalert.washalertbackend.payment;

import com.washalert.washalertbackend.orders.JobOrder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class PaymongoService {
    private static final Logger log = LoggerFactory.getLogger(PaymongoService.class);

    private final PaymongoProperties properties;
    private final RestTemplate restTemplate;

    public PaymongoService(PaymongoProperties properties, RestTemplate restTemplate) {
        this.properties = properties;
        this.restTemplate = restTemplate;
    }

    private String getSecretKey() {
        return (properties.getSecretKey() != null) ? properties.getSecretKey().trim() : null;
    }

    @SuppressWarnings("unchecked")
    public CheckoutSessionResult createCheckoutSession(JobOrder order) {
        String secretKey = getSecretKey();
        if (secretKey == null || secretKey.isBlank()) {
            log.error("[PAYMONGO] Missing secret key configuration for tracking={}", order.getTrackingNumber());
            throw new IllegalStateException("PayMongo secret key is not configured. Set PAYMONGO_SECRET_KEY.");
        }

        // Resolve amount: finalPrice (staff-confirmed) wins over totalPrice (estimated at booking).
        java.math.BigDecimal amount = order.getFinalPrice();
        if (amount == null || amount.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            amount = order.getTotalPrice();
        }
        if (amount == null || amount.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            amount = order.getServicePrice();
        }
        if (amount == null || amount.compareTo(java.math.BigDecimal.ZERO) <= 0) {
            log.error("[PAYMONGO] Order has no price set tracking={}", order.getTrackingNumber());
            throw new IllegalStateException(
                    "Cannot process payment: the order price has not been set yet. Please wait for staff to confirm the weight and price.");
        }

        String url = "https://api.paymongo.com/v1/checkout_sessions";

        // Paymongo amount is in centavos (PHP 1.00 = 100)
        long amountCentavos = amount.multiply(new java.math.BigDecimal("100")).longValue();
        log.info("[PAYMONGO] Creating checkout session for tracking={} amountCentavos={}", 
                order.getTrackingNumber(), amountCentavos);

        Map<String, Object> lineItem = new HashMap<>();
        lineItem.put("currency", "PHP");
        lineItem.put("amount", amountCentavos);
        lineItem.put("description", "Laundry Service: " + String.valueOf(order.getServiceType()));
        lineItem.put("name", "WashAlert Order " + order.getTrackingNumber());
        lineItem.put("quantity", 1);

        Map<String, Object> attributes = new HashMap<>();
        attributes.put("send_email_receipt", true);
        attributes.put("show_description", true);
        attributes.put("show_line_items", true);
        attributes.put("line_items", List.of(lineItem));
        attributes.put("payment_method_types", List.of("gcash"));
        attributes.put("description", "Laundry Order Payment for " + order.getTrackingNumber());
        attributes.put("reference_number", order.getTrackingNumber());
        attributes.put("success_url", "washalertmobile://payment-success?tracking=" + order.getTrackingNumber());
        attributes.put("cancel_url", "washalertmobile://payment-cancel?tracking=" + order.getTrackingNumber());

        Map<String, Object> attributesData = new HashMap<>();
        attributesData.put("attributes", attributes);

        Map<String, Object> payload = new HashMap<>();
        payload.put("data", attributesData);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        
        // Basic Auth: secretKey as username, password empty
        String auth = secretKey + ":";
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        headers.set("Authorization", "Basic " + encodedAuth);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        Map<String, Object> response = null;

        try {
            log.info("[PAYMONGO] Sending checkout session request tracking={}", order.getTrackingNumber());
            response = restTemplate.postForObject(url, request, Map.class);
            
            if (response != null && response.get("data") instanceof Map<?, ?> dataMap) {
                String sessionId = (String) dataMap.get("id");
                if (dataMap.get("attributes") instanceof Map<?, ?> respAttrs) {
                    Object checkoutUrlObj = respAttrs.get("checkout_url");
                    if (checkoutUrlObj instanceof String checkoutUrl) {
                        log.info("[PAYMONGO] Checkout session created successfully tracking={} sessionId={}", order.getTrackingNumber(), sessionId);
                        return new CheckoutSessionResult(checkoutUrl, sessionId);
                    }
                }
            }
            log.error("[PAYMONGO] Response structure invalid or missing checkout_url: {}", response);
            throw new IllegalStateException("PayMongo response was missing or had an invalid checkout URL structure.");
        } catch (IllegalStateException ex) {
            throw ex;
        } catch (org.springframework.web.client.HttpStatusCodeException ex) {
            // Log only the HTTP status code — never log raw PayMongo body which may contain
            // payment details, tokens, or internal error messages.
            log.error("[PAYMONGO] API error from PayMongo tracking={} httpStatus={}",
                    order.getTrackingNumber(), ex.getStatusCode());
            throw new IllegalStateException(
                    "Unable to start GCash checkout right now. Please try again or choose another payment option.");
        } catch (Exception ex) {
            log.error("[PAYMONGO] Critical failure tracking={}", order.getTrackingNumber(), ex);
            throw new IllegalStateException("Unable to start GCash checkout right now. Please try again later.");
        }
    }

    @SuppressWarnings("unchecked")
    public boolean checkCheckoutSessionPaid(String sessionId) {
        String secretKey = getSecretKey();
        if (secretKey == null || secretKey.isBlank() || sessionId == null || sessionId.isBlank()) {
            log.warn("[PAYMONGO] Missing secret key or sessionId, cannot verify payment session");
            return false;
        }

        String url = "https://api.paymongo.com/v1/checkout_sessions/" + sessionId;

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        
        // Basic Auth: secretKey as username, password empty
        String auth = secretKey + ":";
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        headers.set("Authorization", "Basic " + encodedAuth);

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            log.info("[PAYMONGO] Querying checkout session status for sessionId={}", sessionId);
            Map<String, Object> response = restTemplate.exchange(url, org.springframework.http.HttpMethod.GET, entity, Map.class).getBody();
            if (response != null && response.get("data") instanceof Map<?, ?> dataMap) {
                if (dataMap.get("attributes") instanceof Map<?, ?> respAttrs) {
                    String status = (String) respAttrs.get("status");
                    log.info("[PAYMONGO] Checkout session status for sessionId={} is status={}", sessionId, status);
                    if ("completed".equalsIgnoreCase(status)) {
                        return true;
                    }
                    
                    // Also check payments list for safety
                    if (respAttrs.get("payments") instanceof List<?> payments) {
                        for (Object paymentObj : payments) {
                            if (paymentObj instanceof Map<?, ?> paymentMap) {
                                if (paymentMap.get("attributes") instanceof Map<?, ?> payAttrs) {
                                    String payStatus = (String) payAttrs.get("status");
                                    if ("paid".equalsIgnoreCase(payStatus)) {
                                        log.info("[PAYMONGO] Found paid transaction inside checkout session payments sessionId={}", sessionId);
                                        return true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (org.springframework.web.client.HttpStatusCodeException ex) {
            log.error("[PAYMONGO] HTTP error retrieving checkout session sessionId={} httpStatus={}", 
                    sessionId, ex.getStatusCode());
        } catch (Exception ex) {
            log.error("[PAYMONGO] Critical error retrieving checkout session sessionId={}", sessionId, ex);
        }
        return false;
    }
}
