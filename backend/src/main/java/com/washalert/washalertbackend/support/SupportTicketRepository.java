package com.washalert.washalertbackend.support;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {
    List<SupportTicket> findTop50BySessionIdOrderByCreatedAtDesc(String sessionId);
    Optional<SupportTicket> findByTicketNumber(String ticketNumber);
    List<SupportTicket> findTop100ByOrderByCreatedAtDesc();

    // Branch is free text with no canonical entity/FK (see BranchNames) — normalized the same
    // way the JPQL queries elsewhere in the backend already are, so support-ticket routing to
    // staff doesn't silently show nothing on a naming-convention mismatch. These are native SQL
    // (not JPQL), so the equivalent normalization is spelled out with SQL's REPLACE/LOWER.
    @org.springframework.data.jpa.repository.Query(
            value = "SELECT * FROM support_tickets WHERE REPLACE(LOWER(branch), ' branch', '') = REPLACE(LOWER(:branch), ' branch', '') ORDER BY created_at DESC LIMIT 100",
            nativeQuery = true
    )
    List<SupportTicket> findTop100ByNormalizedBranchOrderByCreatedAtDesc(@org.springframework.data.repository.query.Param("branch") String branch);

    @org.springframework.data.jpa.repository.Query(
            value = "SELECT * FROM support_tickets WHERE branch IS NULL OR branch = '' OR REPLACE(LOWER(branch), ' branch', '') = REPLACE(LOWER(:branch), ' branch', '') ORDER BY created_at DESC LIMIT 100",
            nativeQuery = true
    )
    List<SupportTicket> findTop100ForBranchOrUnassigned(@org.springframework.data.repository.query.Param("branch") String branch);
}
