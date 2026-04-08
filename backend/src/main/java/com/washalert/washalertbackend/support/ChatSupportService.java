package com.washalert.washalertbackend.support;

import com.washalert.washalertbackend.delivery.DeliveryService;
import com.washalert.washalertbackend.orders.JobOrderService;
import com.washalert.washalertbackend.orders.dto.OrderTrackingResponse;
import com.washalert.washalertbackend.payment.PaymentService;
import com.washalert.washalertbackend.support.dto.ChatHistoryMessageResponse;
import com.washalert.washalertbackend.support.dto.ChatHistoryResponse;
import com.washalert.washalertbackend.support.dto.ChatSupportRequest;
import com.washalert.washalertbackend.support.dto.ChatSupportResponse;
import com.washalert.washalertbackend.support.dto.SupportTicketResponse;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ChatSupportService {

    private static final Pattern TRACKING_PATTERN = Pattern.compile("WA-\\d+", Pattern.CASE_INSENSITIVE);
    private static final DateTimeFormatter TICKET_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final JobOrderService jobOrderService;
    private final DeliveryService deliveryService;
    private final PaymentService paymentService;
    private final ChatSupportMessageRepository messageRepository;
    private final SupportTicketRepository supportTicketRepository;

    public ChatSupportService(
            JobOrderService jobOrderService,
            DeliveryService deliveryService,
            PaymentService paymentService,
            ChatSupportMessageRepository messageRepository,
            SupportTicketRepository supportTicketRepository
    ) {
        this.jobOrderService = jobOrderService;
        this.deliveryService = deliveryService;
        this.paymentService = paymentService;
        this.messageRepository = messageRepository;
        this.supportTicketRepository = supportTicketRepository;
    }

    @Transactional
    public ChatSupportResponse reply(ChatSupportRequest req) {
        String sessionId = normalizeSessionId(req.sessionId());
        String userMessage = req.message().trim();

        saveMessage(sessionId, ChatResponderType.USER, userMessage, "user", null);
        ChatSupportResponse response = buildReply(req, userMessage, sessionId);
        saveMessage(
                sessionId,
                response.escalated() ? ChatResponderType.HUMAN : ChatResponderType.AI,
                response.reply(),
                response.category(),
                response.escalationTicket()
        );

        return response;
    }

    public ChatHistoryResponse history(String sessionId) {
        String normalizedSessionId = normalizeSessionId(sessionId);

        var messages = messageRepository.findTop200BySessionIdOrderByCreatedAtAsc(normalizedSessionId).stream()
                .map(m -> new ChatHistoryMessageResponse(
                        m.getId(),
                        m.getSenderType().name(),
                        m.getMessage(),
                        m.getCategory(),
                        m.getEscalationTicket(),
                        m.getCreatedAt()
                ))
                .toList();

        var tickets = supportTicketRepository.findTop50BySessionIdOrderByCreatedAtDesc(normalizedSessionId).stream()
                .map(t -> new SupportTicketResponse(
                        t.getTicketNumber(),
                        t.getIssue(),
                        t.getStatus().name(),
                        t.getCreatedAt(),
                        t.getUpdatedAt()
                ))
                .toList();

        return new ChatHistoryResponse(messages, tickets);
    }

    private ChatSupportResponse buildReply(ChatSupportRequest req, String message, String sessionId) {
        String lower = message.toLowerCase(Locale.ROOT);

        if (lower.contains("track") || lower.contains("status") || lower.contains("where")) {
            String tracking = resolveTrackingNumber(req.trackingNumber(), message);
            if (tracking == null) {
                return new ChatSupportResponse(
                        "tracking",
                        "Please provide your tracking number (example: WA-10021) so I can check your order.",
                        false,
                        null,
                        null
                );
            }

            Map<String, Object> data = new LinkedHashMap<>();
            OrderTrackingResponse order;
            try {
                order = jobOrderService.trackByTrackingNumber(tracking);
            } catch (IllegalArgumentException ex) {
                return new ChatSupportResponse(
                        "tracking",
                        "I could not find an order with tracking number " + tracking + ". Please double-check and try again.",
                        false,
                        null,
                        null
                );
            }
            data.put("order", order);

            try {
                data.put("delivery", deliveryService.trackByTrackingNumber(tracking));
            } catch (IllegalArgumentException ignored) {
                // Delivery may not exist for non-delivery orders.
            }

            try {
                data.put("payment", paymentService.trackByTrackingNumber(tracking));
            } catch (IllegalArgumentException ignored) {
                // Payment may not be submitted yet.
            }

            return new ChatSupportResponse(
                    "tracking",
                    "Here is your latest order status and related updates.",
                    false,
                    null,
                    data
            );
        }

        if (lower.contains("complaint")
                || lower.contains("issue")
                || lower.contains("problem")
                || lower.contains("talk to staff")
                || lower.contains("human")) {
            String ticket = createTicket(sessionId, message);
            return new ChatSupportResponse(
                    "complaint",
                    "Your concern has been logged and escalated to staff. Please keep this ticket number.",
                    true,
                    ticket,
                    null
            );
        }

        if (lower.contains("payment") || lower.contains("gcash") || lower.contains("maya")) {
            return new ChatSupportResponse(
                    "faq_payment",
                    "You can pay via GCash or Maya, then submit proof using the payment upload flow. Staff will verify it shortly.",
                    false,
                    null,
                    null
            );
        }

        if (lower.contains("pickup") || lower.contains("delivery")) {
            return new ChatSupportResponse(
                    "faq_delivery",
                    "For pickup and delivery orders, we provide live delivery status and ETA once a driver is assigned.",
                    false,
                    null,
                    null
            );
        }

        return new ChatSupportResponse(
                "faq_general",
                "I can help with order tracking, payment updates, delivery status, and complaint escalation. Tell me what you need.",
                false,
                null,
                null
        );
    }

    private void saveMessage(
            String sessionId,
            ChatResponderType senderType,
            String message,
            String category,
            String escalationTicket
    ) {
        if (message == null || message.isBlank()) return;

        ChatSupportMessage entry = ChatSupportMessage.builder()
                .sessionId(sessionId)
                .senderType(senderType)
                .message(message.trim())
                .category(category)
                .escalationTicket(escalationTicket)
                .build();

        messageRepository.save(entry);
    }

    private String createTicket(String sessionId, String issue) {
        String ticketNumber = "SUP-" + LocalDateTime.now().format(TICKET_TIME)
                + "-" + ThreadLocalRandom.current().nextInt(100, 1000);

        SupportTicket ticket = SupportTicket.builder()
                .ticketNumber(ticketNumber)
                .sessionId(sessionId)
                .issue(issue)
                .status(SupportTicketStatus.OPEN)
                .build();
        supportTicketRepository.save(ticket);

        return ticketNumber;
    }

    private String normalizeSessionId(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return "default-session";
        }
        return sessionId.trim();
    }

    private String resolveTrackingNumber(String explicitTracking, String message) {
        if (explicitTracking != null && !explicitTracking.isBlank()) {
            return explicitTracking.trim().toUpperCase();
        }

        Matcher matcher = TRACKING_PATTERN.matcher(message);
        if (matcher.find()) {
            return matcher.group().toUpperCase();
        }

        return null;
    }
}
