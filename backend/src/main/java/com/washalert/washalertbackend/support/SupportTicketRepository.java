package com.washalert.washalertbackend.support;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {
    List<SupportTicket> findTop50BySessionIdOrderByCreatedAtDesc(String sessionId);
}
