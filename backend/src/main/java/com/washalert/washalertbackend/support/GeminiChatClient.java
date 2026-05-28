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
            You are IkotAsk, the cheerful and friendly WashAlert Support Assistant! 🌟 You work for Triplets Laundry Shop (branded as WashAlert in the app), and you LOVE helping customers with their laundry needs!

            ═══════════════════════════════════════
            YOUR PERSONALITY 😊
            ═══════════════════════════════════════
            • Be warm, enthusiastic, and genuinely happy to help!
            • Use friendly greetings like "Hello!", "Hi there!", "Great question!"
            • Show appreciation: "Thank you for asking!", "I'm happy to help!"
            • Be encouraging: "You're all set!", "Perfect choice!", "Great!"
            • Use emojis naturally to add warmth (but don't overdo it - 1-2 per response)
            • End responses positively: "Have a wonderful day!", "Anything else I can help with?"
            • Be patient and understanding, never rush or sound annoyed
            • Celebrate their choices: "Excellent selection!", "That's a popular service!"

            ═══════════════════════════════════════
            BUSINESS INFO
            ═══════════════════════════════════════
            Business Name: Triplets Laundry Shop (WashAlert App)
            Operating Hours: 7:00 AM – 10:00 PM daily (all branches)
            Booking Window: 8:00 AM – 8:00 PM (90-minute time slots)

            ═══════════════════════════════════════
            SERVICES & PRICING (Philippine Pesos ₱)
            ═══════════════════════════════════════
            • Wash (7kg) — ₱80
            • Dry (7kg) — ₱90
            • Ecowash Full Service (5kg, wash-dry-fold, eco-friendly) — ₱220
            • Basic Full Service (7kg, wash-dry-fold) — ₱240
            • Basic Full Service (8kg, wash-dry-fold) — ₱245
            • Premium Full Service (7kg, wash-dry-fold with extra care) — ₱270
            • Premium Full Service (8kg, wash-dry-fold with extra care) — ₱275
            • Handwash (delicate items) — ₱150/kg for 1-3kg; ₱90/kg for 3kg+

            Detergent Add-ons:
            • Surf (Basic) — ₱25
            • Ariel (Premium) — ₱30
            • None — ₱0

            Fabric Conditioner Add-ons:
            • Charm (Basic) — ₱15
            • Downy (Premium) — ₱25
            • None — ₱0

            ═══════════════════════════════════════
            BRANCHES (10 locations)
            ═══════════════════════════════════════
            1. Makati Branch — Makati City | ☎ (02) 1234-5678
            2. UP Diliman — Quezon City | ☎ (02) 2345-6789
            3. JP Rizal — Makati City | ☎ (02) 3456-7890
            4. S. Catalina — Manila | ☎ (02) 4567-8901
            5. Pasig City — Pasig City | ☎ (02) 5678-9012
            6. Republic Ave — Quezon City | ☎ (02) 6789-0123
            7. Chestnut St — Quezon City | ☎ (02) 7890-1234
            8. Tondo — Manila | ☎ (02) 8901-2345
            9. Samat St — Quezon City | ☎ (02) 9012-3456
            10. St. Nino — Quezon City | ☎ (02) 0123-4567

            ═══════════════════════════════════════
            SERVICE MODES
            ═══════════════════════════════════════
            • Drop-Off Only — Customer drops off laundry at a branch.
            • Pick-Up Only — Driver picks up laundry from customer's address.
            • Full Service (Pick-Up & Delivery) — Driver picks up AND delivers back.

            ═══════════════════════════════════════
            PAYMENT METHODS
            ═══════════════════════════════════════
            • GCash (online, via PayMongo)
            • Cash on Delivery / Cash at Branch

            ═══════════════════════════════════════
            ORDER TRACKING
            ═══════════════════════════════════════
            Tracking numbers start with "WA-" (e.g., WA-2024-001).
            Order statuses: Pending → Washing → Drying → Ready for Pickup → Out for Delivery → Delivered.
            Customers can track orders in the app under "My Orders".

            ═══════════════════════════════════════
            ESTIMATED TURNAROUND
            ═══════════════════════════════════════
            • Self-service (Wash or Dry only): ~45–60 minutes per cycle
            • Full Service: 2–4 hours
            • Pick-Up & Delivery: same day if booked before 2:00 PM

            ═══════════════════════════════════════
            COMMUNICATION STYLE EXAMPLES
            ═══════════════════════════════════════
            Instead of: "The price is ₱240"
            Say: "Great choice! Our Basic Full Service (7kg) is ₱240. It includes wash, dry, and fold! 😊"

            Instead of: "We have 10 branches"
            Say: "We'd love to serve you! We have 10 convenient branches across Metro Manila. Which area are you in?"

            Instead of: "Your order is being washed"
            Say: "Good news! Your laundry is currently being washed. We're taking great care of it! 🧺"

            ═══════════════════════════════════════
            RULES
            ═══════════════════════════════════════
            1) Always be cheerful, polite, and enthusiastic in your responses!
            2) Answer laundry-related questions using the business info above. Be specific with prices and branch details.
            3) If a request is outside laundry support scope, politely redirect to human support with a smile.
            4) Never claim you are training a model. You are a friendly assistant helping through the app.
            5) Set ESCALATE:YES for out-of-scope requests, high-friction complaints, or when human follow-up is needed.
            6) LANGUAGE RULE: Detect the language the customer writes in and ALWAYS reply in that same language. Support ALL languages (Filipino/Tagalog, English, Chinese, Japanese, Korean, Spanish, French, Arabic, Hindi, etc.). If the customer switches language, switch with them.
            7) Keep responses conversational and warm. Make customers feel valued and appreciated!
            8) Use 1-2 emojis per response to add friendliness, but keep it professional.
            9) Always offer to help more: "Is there anything else I can help you with?" or "Feel free to ask if you have more questions!"

            Return exactly:
            CATEGORY: <laundry_faq|out_of_scope|escalation>
            ESCALATE: <YES|NO>
            REPLY: <cheerful, helpful customer-facing response in the SAME language the customer used>
            """;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String baseUrl;

    public GeminiChatClient(
            ObjectMapper objectMapper,
            @Value("${washalert.gemini.api-key:${GEMINI_API_KEY:${GOOGLE_API_KEY:}}}") String apiKey,
            @Value("${washalert.gemini.model:${GEMINI_MODEL:gemini-2.0-flash}}") String model,
            @Value("${washalert.gemini.base-url:${GEMINI_BASE_URL:https://generativelanguage.googleapis.com/v1beta}}") String baseUrl
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gemini-2.0-flash" : model.trim();
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

        int maxAttempts = 3;
        long[] backoffMs = {0, 3000, 8000};

        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                if (backoffMs[attempt] > 0) {
                    log.info("Gemini retry attempt {} after {}ms backoff", attempt + 1, backoffMs[attempt]);
                    Thread.sleep(backoffMs[attempt]);
                }

                ObjectNode payload = objectMapper.createObjectNode();
                payload.set("systemInstruction", partsOnly(SYSTEM_PROMPT));
                payload.set("contents", buildContents(userMessage, contextMessages));
                ObjectNode generationConfig = objectMapper.createObjectNode();
                generationConfig.put("temperature", 0.2);
                payload.set("generationConfig", generationConfig);

                HttpRequest request = HttpRequest.newBuilder(URI.create(buildGenerateContentUrl()))
                        .timeout(Duration.ofSeconds(30))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                String body = response.body() == null ? "" : response.body();

                // Retry on 429 (rate limit) or 503 (overloaded)
                if ((response.statusCode() == 429 || response.statusCode() == 503) && attempt < maxAttempts - 1) {
                    log.warn("Gemini returned {} on attempt {}, will retry...", response.statusCode(), attempt + 1);
                    continue;
                }

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
                if (attempt < maxAttempts - 1) {
                    log.warn("Gemini attempt {} failed ({}), retrying...", attempt + 1, ex.getMessage());
                    continue;
                }
                log.warn("Gemini support call failed after {} attempts: {}", maxAttempts, ex.getMessage());
                throw new IllegalStateException("AI support is temporarily unavailable right now.");
            }
        }
        throw new IllegalStateException("AI support is temporarily unavailable right now.");
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

        // Clean Markdown formatting for mobile display
        reply = cleanMarkdown(reply);

        String safeCategory = category == null || category.isBlank()
                ? "laundry_faq"
                : category.trim().toLowerCase(Locale.ROOT);
        boolean escalate = "YES".equalsIgnoreCase(escalateRaw) || "TRUE".equalsIgnoreCase(escalateRaw);

        return new AiSupportDecision(safeCategory, reply.trim(), escalate);
    }

    private String cleanMarkdown(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        return text
                // Remove bold (**text** or __text__)
                .replaceAll("\\*\\*(.+?)\\*\\*", "$1")
                .replaceAll("__(.+?)__", "$1")
                // Remove italic (*text* or _text_)
                .replaceAll("(?<!\\*)\\*(?!\\*)(.+?)(?<!\\*)\\*(?!\\*)", "$1")
                .replaceAll("(?<!_)_(?!_)(.+?)(?<!_)_(?!_)", "$1")
                // Remove headers (# text)
                .replaceAll("(?m)^#{1,6}\\s+", "")
                // Remove code blocks (```text```)
                .replaceAll("```[\\s\\S]*?```", "")
                // Remove inline code (`text`)
                .replaceAll("`(.+?)`", "$1")
                // Remove links [text](url)
                .replaceAll("\\[(.+?)\\]\\(.+?\\)", "$1")
                // Clean up multiple spaces
                .replaceAll(" {2,}", " ")
                .trim();
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

    public static record ReceiptValidationResult(boolean valid, String referenceNumber) {}

    public ReceiptValidationResult validateGcashReceipt(String imageUrl) {
        if (!isConfigured()) {
            log.warn("[GEMINI][RECEIPT] API key is not configured. Failing validation.");
            return new ReceiptValidationResult(false, null);
        }
        if (imageUrl == null || imageUrl.isBlank()) {
            log.warn("[GEMINI][RECEIPT] Empty receipt image URL. Failing validation.");
            return new ReceiptValidationResult(false, null);
        }

        // Attempt image download up to 2 times for transient network errors
        byte[] imageBytes = null;
        String contentType = "image/jpeg";
        for (int dlAttempt = 1; dlAttempt <= 2; dlAttempt++) {
            try {
                log.info("[GEMINI][RECEIPT] Downloading image (attempt {}): {}", dlAttempt, imageUrl);
                HttpRequest downloadRequest = HttpRequest.newBuilder(URI.create(imageUrl))
                        .GET()
                        .timeout(Duration.ofSeconds(20))
                        .build();
                HttpResponse<byte[]> downloadResponse = httpClient.send(downloadRequest, HttpResponse.BodyHandlers.ofByteArray());
                if (downloadResponse.statusCode() == 200) {
                    imageBytes = downloadResponse.body();
                    contentType = downloadResponse.headers().firstValue("Content-Type").orElse("image/jpeg");
                    break;
                }
                log.error("[GEMINI][RECEIPT] Image download returned status {} on attempt {}", downloadResponse.statusCode(), dlAttempt);
            } catch (Exception dlEx) {
                log.warn("[GEMINI][RECEIPT] Image download exception on attempt {}: {}", dlAttempt, dlEx.getMessage());
            }
            if (dlAttempt < 2) {
                try { Thread.sleep(1500); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
            }
        }
        if (imageBytes == null) {
            log.error("[GEMINI][RECEIPT] Failed to download image after 2 attempts.");
            return new ReceiptValidationResult(false, null);
        }

        try {
            String base64Image = java.util.Base64.getEncoder().encodeToString(imageBytes);

            ObjectNode payload = objectMapper.createObjectNode();

            ArrayNode contents = objectMapper.createArrayNode();
            ObjectNode contentNode = objectMapper.createObjectNode();
            contentNode.put("role", "user");

            ArrayNode parts = objectMapper.createArrayNode();

            ObjectNode textPart = objectMapper.createObjectNode();
            textPart.put("text",
                    "You are an automated system that validates payment receipts for a laundry app.\n" +
                    "Carefully examine this image and determine if it is a valid GCash receipt screenshot.\n\n" +
                    "WHAT TO ACCEPT (set valid = true):\n" +
                    "- GCash Send Money receipt (shows 'Sent', 'You sent', or similar confirmation)\n" +
                    "- GCash Express Send receipt\n" +
                    "- GCash QR payment confirmation screen\n" +
                    "- GCash save-to-gallery receipt image\n" +
                    "- Any GCash in-app screenshot that clearly shows a SUCCESSFUL payment or money transfer and a reference number\n" +
                    "- The image must display GCash branding (GCash logo, GCash name, or the distinctive GCash app interface)\n" +
                    "- The receipt must show a transaction reference number (typically labeled 'Ref No.', 'Reference No.', 'Ref. No.', 'Instapay Ref No.', or similar label)\n\n" +
                    "WHAT TO REJECT (set valid = false):\n" +
                    "- Photos of people, selfies, pets, food, laundry, objects, or any real-world scene\n" +
                    "- Screenshots from non-GCash apps (other banking apps, messaging apps, social media, etc.)\n" +
                    "- Screenshots from this laundry app (WashAlert) or any other app's order/booking screen\n" +
                    "- GCash app screens that are NOT a payment receipt (e.g. login, balance, home screen, payment selection, loading screens)\n" +
                    "- General documents, ID cards, bank statements from other banks\n" +
                    "- Images without any visible GCash branding or reference number\n\n" +
                    "REFERENCE NUMBER EXTRACTION:\n" +
                    "- Look for labels like 'Ref No.', 'Ref. No.', 'Reference No.', 'Instapay Ref No.', or a standalone number near the transaction details\n" +
                    "- GCash reference numbers are exactly 13 digits long (digits only, no letters)\n" +
                    "- Extract the exact 13-digit number. If the number has spaces or dashes, remove them and check if it is 13 digits\n" +
                    "- If the receipt is valid but you cannot find a 13-digit reference number, set valid = false\n\n" +
                    "You must respond with a JSON object containing two fields:\n" +
                    "1. \"valid\": boolean, true if the image is a genuine GCash payment receipt with a 13-digit reference number, false otherwise.\n" +
                    "2. \"referenceNumber\": string, the exact 13-digit reference number from the receipt, or null if not found or invalid.\n\n" +
                    "Respond ONLY with the raw JSON object. Do not use markdown, code blocks, or any other text. Example:\n" +
                    "{\"valid\": true, \"referenceNumber\": \"5013749285918\"}"
            );
            parts.add(textPart);

            ObjectNode imagePart = objectMapper.createObjectNode();
            ObjectNode inlineData = objectMapper.createObjectNode();
            inlineData.put("mimeType", contentType);
            inlineData.put("data", base64Image);
            imagePart.set("inlineData", inlineData);
            parts.add(imagePart);

            contentNode.set("parts", parts);
            contents.add(contentNode);
            payload.set("contents", contents);

            ObjectNode generationConfig = objectMapper.createObjectNode();
            generationConfig.put("temperature", 0.0);
            payload.set("generationConfig", generationConfig);

            // Attempt Gemini API call up to 2 times for transient errors (429, 503)
            HttpResponse<String> apiResponse = null;
            for (int attempt = 1; attempt <= 2; attempt++) {
                HttpRequest apiRequest = HttpRequest.newBuilder(URI.create(buildGenerateContentUrl()))
                        .timeout(Duration.ofSeconds(30))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                        .build();
                apiResponse = httpClient.send(apiRequest, HttpResponse.BodyHandlers.ofString());
                if (apiResponse.statusCode() < 400) {
                    break; // success
                }
                if (attempt < 2 && (apiResponse.statusCode() == 429 || apiResponse.statusCode() == 503)) {
                    log.warn("[GEMINI][RECEIPT] Transient API error ({}) on attempt {}, retrying...", apiResponse.statusCode(), attempt);
                    try { Thread.sleep(2000); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                } else {
                    log.error("[GEMINI][RECEIPT] API error ({}) after {} attempt(s): {}", apiResponse.statusCode(), attempt, apiResponse.body());
                    return new ReceiptValidationResult(false, null);
                }
            }

            String body = apiResponse.body() == null ? "" : apiResponse.body();

            JsonNode root = objectMapper.readTree(body);
            String resultText = extractContent(root).trim();
            // Strip markdown code fences if Gemini wraps output despite instructions
            if (resultText.startsWith("```")) {
                int firstLineBreak = resultText.indexOf('\n');
                if (firstLineBreak != -1) {
                    resultText = resultText.substring(firstLineBreak + 1);
                } else {
                    resultText = resultText.substring(3);
                }
            }
            if (resultText.endsWith("```")) {
                resultText = resultText.substring(0, resultText.length() - 3);
            }
            resultText = resultText.trim();

            JsonNode decisionNode = objectMapper.readTree(resultText);
            boolean valid = decisionNode.path("valid").asBoolean();
            String referenceNumber = decisionNode.path("referenceNumber").isNull() ? null : decisionNode.path("referenceNumber").asText().trim();
            if (referenceNumber != null && referenceNumber.isEmpty()) {
                referenceNumber = null;
            }

            if (referenceNumber != null) {
                // Strip any non-digit characters (spaces, dashes) Gemini may have included
                String digitsOnly = referenceNumber.replaceAll("\\D", "");
                if (digitsOnly.length() == 13) {
                    referenceNumber = digitsOnly;
                } else {
                    // Digits do not form a clean 13-digit number — discard
                    referenceNumber = null;
                }
            }

            // Programmatic safeguard: a receipt marked valid MUST have a clean 13-digit reference number
            if (valid && (referenceNumber == null || referenceNumber.length() != 13 || !referenceNumber.matches("\\d+"))) {
                log.warn("[GEMINI][RECEIPT] Receipt marked valid by Gemini but reference number is missing or invalid: {}", referenceNumber);
                valid = false;
                referenceNumber = null;
            }

            log.info("[GEMINI][RECEIPT] Validation parsed result: valid={}, ref={}", valid, referenceNumber);
            return new ReceiptValidationResult(valid, referenceNumber);
        } catch (Exception e) {
            log.error("[GEMINI][RECEIPT] Exception during validation: {}", e.getMessage(), e);
            return new ReceiptValidationResult(false, null); // Fallback to fail validation
        }
    }
}
