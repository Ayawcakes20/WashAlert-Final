package com.washalert.washalertbackend.support;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatSupportMessageRepository extends JpaRepository<ChatSupportMessage, Long> {
    List<ChatSupportMessage> findTop200BySessionIdOrderByCreatedAtAsc(String sessionId);
    List<ChatSupportMessage> findTop20BySessionIdOrderByCreatedAtDesc(String sessionId);
}
