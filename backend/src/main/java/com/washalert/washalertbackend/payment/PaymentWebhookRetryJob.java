package com.washalert.washalertbackend.payment;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class PaymentWebhookRetryJob {

    private final PaymentWebhookService webhookService;

    public PaymentWebhookRetryJob(PaymentWebhookService webhookService) {
        this.webhookService = webhookService;
    }

    @Scheduled(fixedDelayString = "${washalert.payment.webhook.retry-interval-ms:60000}")
    public void retryFailedWebhooks() {
        webhookService.retryPendingEvents();
    }
}
