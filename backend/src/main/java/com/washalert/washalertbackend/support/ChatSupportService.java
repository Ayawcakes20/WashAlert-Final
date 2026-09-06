package com.washalert.washalertbackend.support;

import com.washalert.washalertbackend.delivery.DeliveryService;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrderService;
import com.washalert.washalertbackend.orders.dto.OrderTrackingResponse;
import com.washalert.washalertbackend.payment.PaymentService;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.support.dto.ChatHistoryMessageResponse;
import com.washalert.washalertbackend.support.dto.ChatHistoryResponse;
import com.washalert.washalertbackend.support.dto.ChatSupportRequest;
import com.washalert.washalertbackend.support.dto.ChatSupportResponse;
import com.washalert.washalertbackend.support.dto.SupportTicketResponse;
import com.washalert.washalertbackend.user.Role;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
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
    private final GeminiChatClient geminiChatClient;
    private final NotificationService notificationService;

    public ChatSupportService(
            JobOrderService jobOrderService,
            DeliveryService deliveryService,
            PaymentService paymentService,
            ChatSupportMessageRepository messageRepository,
            SupportTicketRepository supportTicketRepository,
            GeminiChatClient geminiChatClient,
            NotificationService notificationService) {
        this.jobOrderService = jobOrderService;
        this.deliveryService = deliveryService;
        this.paymentService = paymentService;
        this.messageRepository = messageRepository;
        this.supportTicketRepository = supportTicketRepository;
        this.geminiChatClient = geminiChatClient;
        this.notificationService = notificationService;
    }

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public ChatSupportResponse reply(ChatSupportRequest req) {
        String sessionId = normalizeSessionId(req.sessionId());
        String userMessage = req.message().trim();

        String tracking = resolveTrackingNumber(req.trackingNumber(), userMessage);
        String intendedBranch = resolveIntendedBranch(tracking, req.selectedBranch());

        var openTickets = supportTicketRepository.findTop50BySessionIdOrderByCreatedAtDesc(sessionId).stream()
                .filter(t -> t.getStatus() == SupportTicketStatus.OPEN)
                .toList();

        // A device only ever has one support sessionId, so a customer can have an open
        // ticket from an earlier conversation (e.g. Branch A) while starting a new one
        // from a different order (e.g. Branch B). Only auto-continue an open ticket when
        // this message is actually about the same branch — otherwise a message meant for
        // the newly selected branch would silently get appended to the old branch's
        // ticket instead of reaching the branch the customer is actually messaging.
        SupportTicket matchingOpenTicket = openTickets.stream()
                .filter(t -> intendedBranch == null || isSoftMatch(intendedBranch, t.getBranch()))
                .findFirst()
                .orElse(null);

        if (matchingOpenTicket != null) {
            saveMessage(sessionId, ChatResponderType.USER, userMessage, "user", matchingOpenTicket.getTicketNumber(),
                    req.senderName());

            notificationService.enqueuePushToRoles(
                    List.of(Role.ADMIN, Role.STAFF),
                    matchingOpenTicket.getBranch(),
                    "New Customer Message",
                    "Ticket " + matchingOpenTicket.getTicketNumber() + ": "
                            + (userMessage.length() > 100 ? userMessage.substring(0, 100) + "..." : userMessage),
                    "SUPPORT_MESSAGE",
                    matchingOpenTicket.getTicketNumber());

            return new ChatSupportResponse(
                    "escalated_chat",
                    null, // Handled implicitly by mobile UI via polling
                    true,
                    matchingOpenTicket.getTicketNumber(),
                    null);
        }

        saveMessage(sessionId, ChatResponderType.USER, userMessage, "user", null, req.senderName());

        ChatSupportResponse response;
        try {
            response = buildReply(req, userMessage, sessionId);
        } catch (Exception ex) {
            // Ensure AI failures never bubble up as HTTP errors — always return a usable chat response
            response = new ChatSupportResponse(
                    "ai_unavailable",
                    "AI support is temporarily unavailable. You can type 'talk to staff' any time to open a support ticket.",
                    false,
                    null,
                    null);
        }

        saveMessage(
                sessionId,
                ChatResponderType.AI,
                response.reply(),
                response.category(),
                response.escalationTicket(),
                null);

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
                        m.getSenderName(),
                        m.getCreatedAt()))
                .toList();

        var tickets = supportTicketRepository.findTop50BySessionIdOrderByCreatedAtDesc(normalizedSessionId).stream()
                .map(t -> new SupportTicketResponse(
                        t.getTicketNumber(),
                        t.getSessionId(),
                        t.getIssue(),
                        t.getStatus().name(),
                        t.getBranch(),
                        t.getCreatedAt(),
                        t.getUpdatedAt()))
                .toList();

        return new ChatHistoryResponse(messages, tickets);
    }

    public List<SupportTicketResponse> allTickets(AuthUserDetails principal) {
        String staffBranch = principal.getUser().getRole() == Role.STAFF ? principal.getUser().getBranch() : null;

        List<SupportTicket> all = supportTicketRepository.findTop100ByOrderByCreatedAtDesc();

        return all.stream()
                .filter(t -> staffBranch == null || staffBranch.isBlank() || isSoftMatch(staffBranch, t.getBranch()))
                .map(t -> new SupportTicketResponse(
                        t.getTicketNumber(),
                        t.getSessionId(),
                        t.getIssue(),
                        t.getStatus().name(),
                        t.getBranch(),
                        t.getCreatedAt(),
                        t.getUpdatedAt()))
                .toList();
    }

    @Transactional
    public SupportTicketResponse resolveTicket(String ticketNumber, AuthUserDetails principal) {
        SupportTicket ticket = supportTicketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketNumber));

        if (principal.getUser().getRole() == Role.STAFF
                && ticket.getBranch() != null && !ticket.getBranch().isBlank()
                && !sameBranch(principal.getUser().getBranch(), ticket.getBranch())) {
            throw new IllegalArgumentException(
                    "You can only resolve tickets for your assigned branch or unassigned tickets.");
        }

        ticket.setStatus(SupportTicketStatus.RESOLVED);
        SupportTicket saved = supportTicketRepository.save(ticket);

        // Send a closing message so the customer sees it on mobile
        saveMessage(
                saved.getSessionId(),
                ChatResponderType.HUMAN,
                "This live chat session has been closed by our support team. If you need further help, feel free to send a new message — you'll be connected back to IkotAsk AI. Thank you!",
                "resolved",
                ticketNumber,
                null);

        return new SupportTicketResponse(
                saved.getTicketNumber(),
                saved.getSessionId(),
                saved.getIssue(),
                saved.getStatus().name(),
                saved.getBranch(),
                saved.getCreatedAt(),
                saved.getUpdatedAt());
    }

    @Transactional
    public void replyToTicket(String ticketNumber, String message, AuthUserDetails principal) {
        SupportTicket ticket = supportTicketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketNumber));

        if (principal.getUser().getRole() == Role.STAFF
                && ticket.getBranch() != null && !ticket.getBranch().isBlank()
                && !sameBranch(principal.getUser().getBranch(), ticket.getBranch())) {
            throw new IllegalArgumentException(
                    "You can only reply to tickets for your assigned branch or unassigned tickets.");
        }

        if (ticket.getStatus() != SupportTicketStatus.OPEN) {
            throw new IllegalArgumentException(
                    "Cannot reply to a resolved ticket. Please wait for the customer to open a new ticket.");
        }

        String rolePrefix = principal.getUser().getRole().name().equals("ADMIN") ? "Admin" : "Staff";
        String formattedSenderName = rolePrefix + " - " + principal.getUser().getFullName();

        saveMessage(ticket.getSessionId(), ChatResponderType.HUMAN, message, "human", ticketNumber,
                formattedSenderName);

        // Optionally notify the customer here if FCM tokens are linked to session IDs.
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
                        null);
            }

            Map<String, Object> data = new LinkedHashMap<>();
            OrderTrackingResponse order;
            try {
                order = jobOrderService.trackByTrackingNumber(tracking);
            } catch (IllegalArgumentException ex) {
                return new ChatSupportResponse(
                        "tracking",
                        "I could not find an order with tracking number " + tracking
                                + ". Please double-check and try again.",
                        false,
                        null,
                        null);
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
                    data);
        }

        if (lower.contains("complaint")
                || lower.contains("issue")
                || lower.contains("problem")
                || lower.contains("talk to staff")
                || lower.contains("human")) {
            String explicitBranch = req.selectedBranch() != null && !req.selectedBranch().isBlank()
                    ? req.selectedBranch().trim()
                    : null;
            String ticket = createTicket(sessionId, message, resolveTrackingNumber(req.trackingNumber(), message),
                    explicitBranch);
            return new ChatSupportResponse(
                    "complaint",
                    "Your concern has been logged and escalated to staff. Your ticket number is: " + ticket
                            + ". A staff member will respond shortly.",
                    true,
                    ticket,
                    null);
        }

        if (lower.contains("payment") || lower.contains("gcash") || lower.contains("maya")) {
            return new ChatSupportResponse(
                    "faq_payment",
                    "You can pay via GCash or Maya, then submit proof using the payment upload flow. Staff will verify it shortly.",
                    false,
                    null,
                    null);
        }

        if (lower.contains("pickup") || lower.contains("delivery")) {
            return new ChatSupportResponse(
                    "faq_delivery",
                    "For pickup and delivery orders, we provide live delivery status and ETA once a driver is assigned.",
                    false,
                    null,
                    null);
        }

        return buildAiAssistedFaqReply(req, sessionId);
    }

    private ChatSupportResponse buildAiAssistedFaqReply(ChatSupportRequest req, String sessionId) {
        String message = req.message();
        if (!geminiChatClient.isConfigured()) {
            return new ChatSupportResponse(
                    "ai_configuration",
                    "AI support is unavailable because GEMINI_API_KEY is not configured on the server. "
                            + "I can still help with tracking (WA-xxxxx), payments, delivery updates, and ticket escalation.",
                    false,
                    null,
                    null);
        }

        List<ChatSupportMessage> context = new ArrayList<>(
                messageRepository.findTop20BySessionIdOrderByCreatedAtDesc(sessionId));
        context.sort(Comparator.comparing(ChatSupportMessage::getCreatedAt));
        if (!context.isEmpty()) {
            ChatSupportMessage latest = context.get(context.size() - 1);
            if (latest.getSenderType() == ChatResponderType.USER
                    && latest.getMessage() != null
                    && latest.getMessage().trim().equalsIgnoreCase(message.trim())) {
                context.remove(context.size() - 1);
            }
        }

        AiSupportDecision aiDecision;
        try {
            aiDecision = geminiChatClient.generateReply(message, context);
        } catch (IllegalStateException ex) {
            return new ChatSupportResponse(
                    "ai_unavailable",
                    ex.getMessage() + " You can type 'talk to staff' any time to open a support ticket.",
                    false,
                    null,
                    null);
        }

        if (aiDecision.escalate()) {
            String explicitBranch = req.selectedBranch() != null && !req.selectedBranch().isBlank()
                    ? req.selectedBranch().trim()
                    : null;
            String ticket = createTicket(sessionId, message, resolveTrackingNumber(req.trackingNumber(), message),
                    explicitBranch);
            return new ChatSupportResponse(
                    aiDecision.category(),
                    aiDecision.reply(),
                    true,
                    ticket,
                    null);
        }

        return new ChatSupportResponse(
                aiDecision.category(),
                aiDecision.reply(),
                false,
                null,
                null);
    }

    private void saveMessage(
            String sessionId,
            ChatResponderType senderType,
            String message,
            String category,
            String escalationTicket,
            String senderName) {
        if (message == null || message.isBlank())
            return;

        ChatSupportMessage entry = ChatSupportMessage.builder()
                .sessionId(sessionId)
                .senderType(senderType)
                .message(message.trim())
                .category(category)
                .escalationTicket(escalationTicket)
                .senderName(senderName)
                .build();

        messageRepository.save(entry);
    }

    private String createTicket(String sessionId, String issue, String trackingNumber, String explicitBranch) {
        String ticketNumber = "SUP-" + LocalDateTime.now().format(TICKET_TIME)
                + "-" + ThreadLocalRandom.current().nextInt(100, 1000);

        String branch = resolveIntendedBranch(trackingNumber, explicitBranch);

        SupportTicket ticket = SupportTicket.builder()
                .ticketNumber(ticketNumber)
                .sessionId(sessionId)
                .branch(branch)
                .issue(issue)
                .status(SupportTicketStatus.OPEN)
                .build();
        supportTicketRepository.save(ticket);

        notificationService.enqueuePushToRoles(
                List.of(Role.ADMIN, Role.STAFF),
                ticket.getBranch(),
                "Escalated Support Ticket",
                "Ticket %s needs manual response. Issue: %s"
                        .formatted(ticketNumber, truncate(issue, 100)),
                "SUPPORT_ESCALATION",
                ticketNumber);

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

    private String resolveIntendedBranch(String trackingNumber, String explicitBranch) {
        String branch = resolveBranchFromTracking(trackingNumber);
        if (branch == null && explicitBranch != null && !explicitBranch.isBlank()) {
            branch = explicitBranch.trim();
        }
        return branch;
    }

    private String resolveBranchFromTracking(String trackingNumber) {
        if (trackingNumber == null || trackingNumber.isBlank()) {
            return null;
        }
        try {
            return jobOrderService.trackByTrackingNumber(trackingNumber).branch();
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean sameBranch(String a, String b) {
        return isSoftMatch(a, b);
    }

    private boolean isSoftMatch(String a, String b) {
        if (a == null || b == null) return false;
        String normA = a.toLowerCase().replace(" branch", "").trim();
        String normB = b.toLowerCase().replace(" branch", "").trim();
        return normA.equals(normB) || normA.contains(normB) || normB.contains(normA);
    }

    private String truncate(String value, int max) {
        if (value == null)
            return "";
        return value.length() <= max ? value : value.substring(0, max);
    }
}
