package com.washalert.washalertbackend.support;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {
    List<SupportTicket> findTop50BySessionIdOrderByCreatedAtDesc(String sessionId);
    Optional<SupportTicket> findByTicketNumber(String ticketNumber);
    List<SupportTicket> findTop100ByOrderByCreatedAtDesc();
    List<SupportTicket> findTop100ByBranchIgnoreCaseOrderByCreatedAtDesc(String branch);
}
