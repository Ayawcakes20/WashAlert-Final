package com.washalert.washalertbackend.payment;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/payments/paymongo")
public class PaymongoWebhookController {

    private final PaymongoWebhookService webhookService;

    public PaymongoWebhookController(PaymongoWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> receiveWebhook(
            @RequestBody String rawBody,
            @RequestHeader(name = "Paymongo-Signature", required = false) String signature,
            @RequestHeader(name = "X-Paymongo-Signature", required = false) String legacySignatureHeader
    ) {
        try {
            webhookService.verifyAndHandleWebhook(rawBody, signature != null ? signature : legacySignatureHeader);
            return ResponseEntity.ok().build();
        } catch (SecurityException ex) {
            log.warn("Rejected Paymongo webhook: {}", ex.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }
}
