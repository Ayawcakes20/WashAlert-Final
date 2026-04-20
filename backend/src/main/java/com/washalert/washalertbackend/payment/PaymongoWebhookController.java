package com.washalert.washalertbackend.payment;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/payments/paymongo")
public class PaymongoWebhookController {

    private final PaymongoWebhookService webhookService;

    public PaymongoWebhookController(PaymongoWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> receiveWebhook(
            @RequestBody Map<String, Object> payload,
            @RequestHeader(name = "X-Paymongo-Signature", required = false) String signature
    ) {
        // Verification logic can be added here using the signature and webhook secret
        webhookService.handleWebhook(payload);
        return ResponseEntity.ok().build();
    }
}
