package com.washalert.washalertbackend.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.http.HttpClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class GeminiChatClientTests {

    private ObjectMapper objectMapper;
    private GeminiChatClient client;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        // Instantiate GeminiChatClient with empty config so isConfigured() is false by default or mock it
        client = new GeminiChatClient(objectMapper, "", "gemini-2.0-flash", "https://generativelanguage.googleapis.com");
    }

    @Test
    void isConfiguredReturnsFalseWhenApiKeyIsEmpty() {
        assertThat(client.isConfigured()).isFalse();
    }

    @Test
    void validateGcashReceiptReturnsFallbackTrueWhenNotConfigured() {
        GeminiChatClient.ReceiptValidationResult result = client.validateGcashReceipt("https://firebase/storage/proof.jpg");
        assertThat(result.valid()).isTrue();
        assertThat(result.referenceNumber()).isNull();
    }
}
