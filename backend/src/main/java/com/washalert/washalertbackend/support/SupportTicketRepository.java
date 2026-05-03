package com.washalert.washalertbackend.support;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {
    List<SupportTicket> findTop50BySessionIdOrderByCreatedAtDesc(String sessionId);
    Optional<SupportTicket> findByTicketNumber(String ticketNumber);
    List<SupportTicket> findTop100ByOrderByCreatedAtDesc();
    List<SupportTicket> findTop100ByBranchIgnoreCaseOrderByCreatedAtDesc(String branch);

    @org.springframework.data.jpa.repository.Query(
            value = "SELECT * FROM support_tickets WHERE branch IS NULL OR branch = '' OR LOWER(branch) = LOWER(:branch) ORDER BY created_at DESC LIMIT 100",
            nativeQuery = true
    )
    List<SupportTicket> findTop100ForBranchOrUnassigned(@org.springframework.data.repository.query.Param("branch") String branch);
}
