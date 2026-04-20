package com.washalert.washalertbackend.payment;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "washalert.paymongo")
public class PaymongoProperties {

    private String secretKey;
    private String publicKey;
    private String webhookSecret;

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getPublicKey() {
        return publicKey;
    }

    public void setPublicKey(String publicKey) {
        this.publicKey = publicKey;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }
}
