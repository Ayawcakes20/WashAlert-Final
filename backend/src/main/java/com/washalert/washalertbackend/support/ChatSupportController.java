package com.washalert.washalertbackend.support;

import com.washalert.washalertbackend.support.dto.ChatSupportRequest;
import com.washalert.washalertbackend.support.dto.ChatSupportResponse;
import com.washalert.washalertbackend.support.dto.ChatHistoryResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
}
