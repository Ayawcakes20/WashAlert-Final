package com.washalert.washalertbackend.announcement;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    List<Announcement> findTop100ByOrderByCreatedAtDesc();
    List<Announcement> findTop100ByTargetAllBranchesTrueOrBranchIgnoreCaseOrderByCreatedAtDesc(String branch);
}
