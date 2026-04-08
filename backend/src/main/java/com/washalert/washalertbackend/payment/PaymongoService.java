package com.washalert.washalertbackend.payment;

import com.washalert.washalertbackend.orders.JobOrder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class PaymongoService {

    private final PaymongoProperties properties;
    private final RestTemplate restTemplate;

    public PaymongoService(PaymongoProperties properties, RestTemplate restTemplate) {
        this.properties = properties;
        this.restTemplate = restTemplate;
    }

    public String createCheckoutSession(JobOrder order) {
        String url = "https://api.paymongo.com/v1/checkout_sessions";

        // Paymongo amount is in centavos (PHP 1.00 = 100)
        long amountCentavos = order.getTotalPrice().multiply(new java.math.BigDecimal("100")).longValue();

        Map<String, Object> lineItem = Map.of(
                "currency", "PHP",
                "amount", amountCentavos,
                "description", "Laundry Service: " + order.getServiceType(),
                "name", "WashAlert Order " + order.getTrackingNumber(),
                "quantity", 1
        );

        Map<String, Object> attributes = Map.of(
                "send_email_receipt", true,
                "show_description", true,
                "show_line_items", true,
                "line_items", List.of(lineItem),
                "payment_method_types", List.of("gcash"),
                "description", "Laundry Order Payment for " + order.getTrackingNumber(),
                "reference_number", order.getTrackingNumber(),
                "success_url", "washalertmobile://payment-success?tracking=" + order.getTrackingNumber(),
                "cancel_url", "washalertmobile://payment-cancel?tracking=" + order.getTrackingNumber()
        );

        Map<String, Object> payload = Map.of(
                "data", Map.of(
                        "attributes", attributes
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        
        // Basic Auth: secretKey as username, password empty
        String auth = properties.getSecretKey() + ":";
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
        headers.set("Authorization", "Basic " + encodedAuth);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
            if (response != null && response.containsKey("data")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> data = (Map<String, Object>) response.get("data");
                @SuppressWarnings("unchecked")
                Map<String, Object> respAttrs = (Map<String, Object>) data.get("attributes");
                return (String) respAttrs.get("checkout_url");
            }
        } catch (Exception ex) {
            throw new RuntimeException("Paymongo session creation failed: " + ex.getMessage(), ex);
        }

        throw new RuntimeException("Failed to get checkout URL from Paymongo response.");
    }
}
