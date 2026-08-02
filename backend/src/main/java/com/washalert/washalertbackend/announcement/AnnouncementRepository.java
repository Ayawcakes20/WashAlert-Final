package com.washalert.washalertbackend.announcement;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    List<Announcement> findTop100ByOrderByCreatedAtDesc();

    // Branch is free text with no canonical entity/FK (see BranchNames) — normalized the same
    // way the rest of the backend already is, so a branch-targeted announcement doesn't
    // silently fail to reach that branch's staff/customers on a naming-convention mismatch.
    // Callers pass PageRequest.of(0, 100) to preserve the original findTop100By... behavior —
    // a custom @Query doesn't honor the "Top100" keyword the way a derived method name does.
    @Query("""
            select a from Announcement a
            where a.targetAllBranches = true
               or replace(lower(a.branch), ' branch', '') = replace(lower(:branch), ' branch', '')
            order by a.createdAt desc
            """)
    List<Announcement> findByTargetAllBranchesTrueOrNormalizedBranchOrderByCreatedAtDesc(@Param("branch") String branch, Pageable pageable);
}
