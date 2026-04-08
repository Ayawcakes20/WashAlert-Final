package com.washalert.washalertbackend.payment;

import com.washalert.washalertbackend.payment.dto.PaymentWebhookRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments")
public class PaymentWebhookController {

    private final PaymentWebhookService webhookService;

    public PaymentWebhookController(PaymentWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(
            @Valid @RequestBody PaymentWebhookRequest req,
            @RequestHeader(name = "X-WashAlert-Signature", required = false) String signature
    ) {
        webhookService.receiveWebhook(req, signature);
        return ResponseEntity.accepted().build();
    }
}
