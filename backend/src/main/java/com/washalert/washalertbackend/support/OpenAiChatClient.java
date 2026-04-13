package com.washalert.washalertbackend.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class OpenAiChatClient {

    private static final Logger log = LoggerFactory.getLogger(OpenAiChatClient.class);
    private static final Pattern CATEGORY_PATTERN = Pattern.compile("(?im)^CATEGORY\\s*:\\s*([a-zA-Z0-9_-]+)\\s*$");
    private static final Pattern ESCALATE_PATTERN = Pattern.compile("(?im)^ESCALATE\\s*:\\s*(YES|NO|TRUE|FALSE)\\s*$");
    private static final Pattern REPLY_PATTERN = Pattern.compile("(?is)REPLY\\s*:\\s*(.+)$");

    private static final String SYSTEM_PROMPT = """
            You are WashAlert Support Assistant for a laundry business.
            Rules:
            1) Prioritize laundry-related questions: booking, branch info, washing/drying timelines, order tracking guidance, pickup/delivery, pricing, and payments.
            2) If a request is outside laundry support scope or unsupported by WashAlert, do not invent details. Politely redirect to human support.
            3) Never claim you are training a model. You are an assistant replying through API calls.
            4) Set ESCALATE:YES for out-of-scope requests, high-friction complaints, or when human follow-up is needed.
            Return exactly:
            CATEGORY: <laundry_faq|out_of_scope|escalation>
            ESCALATE: <YES|NO>
            REPLY: <helpful customer-facing response>
            """;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String baseUrl;

    public OpenAiChatClient(
            ObjectMapper objectMapper,
            @Value("${washalert.openai.api-key:${OPENAI_API_KEY:}}") String apiKey,
            @Value("${washalert.openai.model:${OPENAI_MODEL:gpt-4o-mini}}") String model,
            @Value("${washalert.openai.base-url:${OPENAI_BASE_URL:https://api.openai.com/v1}}") String baseUrl
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gpt-4o-mini" : model.trim();
        this.baseUrl = baseUrl == null || baseUrl.isBlank() ? "https://api.openai.com/v1" : baseUrl.trim();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .build();
    }

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public OpenAiSupportDecision generateReply(String userMessage, List<ChatSupportMessage> contextMessages) {
        if (!isConfigured()) {
            throw new IllegalStateException("AI support is not configured on server (missing OPENAI_API_KEY).");
        }

        try {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("model", model);
            payload.put("temperature", 0.2);
            payload.set("messages", buildMessages(userMessage, contextMessages));

            HttpRequest request = HttpRequest.newBuilder(URI.create(normalizeBaseUrl(baseUrl) + "/chat/completions"))
                    .timeout(Duration.ofSeconds(25))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body() == null ? "" : response.body();

            if (response.statusCode() >= 400) {
                throw new IllegalStateException(resolveApiError(body, response.statusCode()));
            }

            JsonNode root = objectMapper.readTree(body);
            String rawContent = extractContent(root);
            if (rawContent.isBlank()) {
                throw new IllegalStateException("OpenAI returned an empty response.");
            }

            return parseDecision(rawContent);
        } catch (IllegalStateException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("OpenAI support call interrupted: {}", ex.getMessage());
            throw new IllegalStateException("AI support is temporarily unavailable right now.");
        } catch (IOException ex) {
            log.warn("OpenAI support call failed: {}", ex.getMessage());
            throw new IllegalStateException("AI support is temporarily unavailable right now.");
        }
    }

    private ArrayNode buildMessages(String userMessage, List<ChatSupportMessage> contextMessages) {
        ArrayNode messages = objectMapper.createArrayNode();
        messages.add(message("system", SYSTEM_PROMPT));

        if (contextMessages != null && !contextMessages.isEmpty()) {
            contextMessages.stream()
                    .sorted(Comparator.comparing(ChatSupportMessage::getCreatedAt))
                    .skip(Math.max(0, contextMessages.size() - 8))
                    .forEach(entry -> {
                        String role = entry.getSenderType() == ChatResponderType.USER ? "user" : "assistant";
                        messages.add(message(role, entry.getMessage()));
                    });
        }

        messages.add(message("user", userMessage));
        return messages;
    }

    private ObjectNode message(String role, String content) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("role", role);
        node.put("content", content == null ? "" : content.trim());
        return node;
    }

    private OpenAiSupportDecision parseDecision(String rawContent) {
        String normalized = rawContent == null ? "" : rawContent.trim();
        String category = extractMatch(CATEGORY_PATTERN, normalized);
        String escalateRaw = extractMatch(ESCALATE_PATTERN, normalized);
        String reply = extractMatch(REPLY_PATTERN, normalized);

        if (reply == null || reply.isBlank()) {
            reply = normalized;
        }

        String safeCategory = category == null || category.isBlank()
                ? "laundry_faq"
                : category.trim().toLowerCase(Locale.ROOT);
        boolean escalate = "YES".equalsIgnoreCase(escalateRaw) || "TRUE".equalsIgnoreCase(escalateRaw);

        return new OpenAiSupportDecision(safeCategory, reply.trim(), escalate);
    }

    private String extractContent(JsonNode root) {
        JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
        if (contentNode.isTextual()) {
            return contentNode.asText();
        }
        if (contentNode.isArray()) {
            StringBuilder combined = new StringBuilder();
            for (JsonNode item : contentNode) {
                String text = item.path("text").asText("");
                if (!text.isBlank()) {
                    if (!combined.isEmpty()) combined.append('\n');
                    combined.append(text.trim());
                }
            }
            return combined.toString();
        }
        return "";
    }

    private String resolveApiError(String body, int statusCode) {
        if (body != null && !body.isBlank()) {
            try {
                JsonNode root = objectMapper.readTree(body);
                String message = root.path("error").path("message").asText("");
                if (!message.isBlank()) {
                    return "OpenAI request failed (" + statusCode + "): " + message;
                }
            } catch (Exception ignored) {
                // Fallback below.
            }
        }
        return "OpenAI request failed with status " + statusCode + ".";
    }

    private String extractMatch(Pattern pattern, String source) {
        if (source == null || source.isBlank()) {
            return null;
        }
        Matcher matcher = pattern.matcher(source);
        if (!matcher.find()) {
            return null;
        }
        return matcher.group(1);
    }

    private String normalizeBaseUrl(String rawBase) {
        if (rawBase.endsWith("/")) {
            return rawBase.substring(0, rawBase.length() - 1);
        }
        return rawBase;
    }
}
