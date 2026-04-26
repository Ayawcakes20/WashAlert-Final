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
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GeminiChatClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiChatClient.class);
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

    public GeminiChatClient(
            ObjectMapper objectMapper,
            @Value("${washalert.gemini.api-key:${GEMINI_API_KEY:${GOOGLE_API_KEY:}}}") String apiKey,
            @Value("${washalert.gemini.model:${GEMINI_MODEL:gemini-1.5-flash}}") String model,
            @Value("${washalert.gemini.base-url:${GEMINI_BASE_URL:https://generativelanguage.googleapis.com/v1beta}}") String baseUrl
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gemini-1.5-flash" : model.trim();
        this.baseUrl = baseUrl == null || baseUrl.isBlank() ? "https://generativelanguage.googleapis.com/v1beta" : baseUrl.trim();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .build();
        log.info("GEMINI_API_KEY configured: {}", isConfigured() ? "YES" : "NO");
    }

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    public AiSupportDecision generateReply(String userMessage, List<ChatSupportMessage> contextMessages) {
        if (!isConfigured()) {
            throw new IllegalStateException("AI support is not configured on server (missing GEMINI_API_KEY).");
        }

        try {
            ObjectNode payload = objectMapper.createObjectNode();
            payload.set("systemInstruction", partsOnly(SYSTEM_PROMPT));
            payload.set("contents", buildContents(userMessage, contextMessages));
            ObjectNode generationConfig = objectMapper.createObjectNode();
            generationConfig.put("temperature", 0.2);
            payload.set("generationConfig", generationConfig);

            HttpRequest request = HttpRequest.newBuilder(URI.create(buildGenerateContentUrl()))
                    .timeout(Duration.ofSeconds(25))
                    .header("Content-Type", "application/json")
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
                throw new IllegalStateException("Gemini returned an empty response.");
            }

            return parseDecision(rawContent);
        } catch (IllegalStateException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("Gemini support call interrupted: {}", ex.getMessage());
            throw new IllegalStateException("AI support is temporarily unavailable right now.");
        } catch (IOException ex) {
            log.warn("Gemini support call failed: {}", ex.getMessage());
            throw new IllegalStateException("AI support is temporarily unavailable right now.");
        }
    }

    private ArrayNode buildContents(String userMessage, List<ChatSupportMessage> contextMessages) {
        ArrayNode contents = objectMapper.createArrayNode();

        if (contextMessages != null && !contextMessages.isEmpty()) {
            contextMessages.stream()
                    .sorted(Comparator.comparing(ChatSupportMessage::getCreatedAt))
                    .skip(Math.max(0, contextMessages.size() - 8))
                    .forEach(entry -> {
                        String role = entry.getSenderType() == ChatResponderType.USER ? "user" : "model";
                        contents.add(content(role, entry.getMessage()));
                    });
        }

        contents.add(content("user", userMessage));
        return contents;
    }

    private ObjectNode partsOnly(String text) {
        ObjectNode wrapper = objectMapper.createObjectNode();
        ArrayNode parts = objectMapper.createArrayNode();
        ObjectNode part = objectMapper.createObjectNode();
        part.put("text", text == null ? "" : text.trim());
        parts.add(part);
        wrapper.set("parts", parts);
        return wrapper;
    }

    private ObjectNode content(String role, String content) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("role", role);
        ArrayNode parts = objectMapper.createArrayNode();
        ObjectNode part = objectMapper.createObjectNode();
        part.put("text", content == null ? "" : content.trim());
        parts.add(part);
        node.set("parts", parts);
        return node;
    }

    private AiSupportDecision parseDecision(String rawContent) {
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

        return new AiSupportDecision(safeCategory, reply.trim(), escalate);
    }

    private String extractContent(JsonNode root) {
        JsonNode partsNode = root.path("candidates").path(0).path("content").path("parts");
        if (partsNode.isArray()) {
            StringBuilder combined = new StringBuilder();
            for (JsonNode item : partsNode) {
                String text = item.path("text").asText("");
                if (!text.isBlank()) {
                    if (!combined.isEmpty()) combined.append('\n');
                    combined.append(text.trim());
                }
            }
            return combined.toString();
        }
        JsonNode textNode = root.path("candidates").path(0).path("content").path("text");
        if (textNode.isTextual()) {
            return textNode.asText();
        }
        return "";
    }

    private String resolveApiError(String body, int statusCode) {
        if (body != null && !body.isBlank()) {
            try {
                JsonNode root = objectMapper.readTree(body);
                String message = root.path("error").path("message").asText("");
                if (!message.isBlank()) {
                    return "Gemini request failed (" + statusCode + "): " + message;
                }
            } catch (Exception ignored) {
                // Fallback below.
            }
        }
        return "Gemini request failed with status " + statusCode + ".";
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

    private String buildGenerateContentUrl() {
        String encodedKey = URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
        return "%s/models/%s:generateContent?key=%s".formatted(normalizeBaseUrl(baseUrl), model, encodedKey);
    }
}
