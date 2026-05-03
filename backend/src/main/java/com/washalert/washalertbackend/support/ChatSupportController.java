package com.washalert.washalertbackend.support;

import com.washalert.washalertbackend.support.dto.ChatSupportRequest;
import com.washalert.washalertbackend.support.dto.ChatSupportResponse;
import com.washalert.washalertbackend.support.dto.ChatHistoryResponse;
import com.washalert.washalertbackend.support.dto.SupportTicketResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/support")
public class ChatSupportController {

    private final ChatSupportService chatSupportService;

    public ChatSupportController(ChatSupportService chatSupportService) {
        this.chatSupportService = chatSupportService;
    }

    @PostMapping("/chat")
    public ChatSupportResponse chat(@Valid @RequestBody ChatSupportRequest req) {
        return chatSupportService.reply(req);
    }

    @GetMapping("/history")
    public ChatHistoryResponse history(@RequestParam String sessionId) {
        return chatSupportService.history(sessionId);
    }

    /**
     * Admin/Staff: list all escalated support tickets (most recent first).
     */
    @GetMapping("/tickets")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<SupportTicketResponse> allTickets(@AuthenticationPrincipal AuthUserDetails principal) {
        return chatSupportService.allTickets(principal);
    }

    /**
     * Admin/Staff: mark a support ticket as resolved.
     */
    @PatchMapping("/tickets/{ticketNumber}/resolve")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<SupportTicketResponse> resolveTicket(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return ResponseEntity.ok(chatSupportService.resolveTicket(ticketNumber, principal));
    }

    /**
     * Admin/Staff: reply to an open support ticket.
     */
    @PostMapping("/tickets/{ticketNumber}/reply")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public ResponseEntity<Void> replyToTicket(
            @PathVariable String ticketNumber,
            @RequestBody java.util.Map<String, String> body,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        String message = body.get("message");
        if (message == null || message.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        chatSupportService.replyToTicket(ticketNumber, message, principal);
        return ResponseEntity.ok().build();
    }
}
