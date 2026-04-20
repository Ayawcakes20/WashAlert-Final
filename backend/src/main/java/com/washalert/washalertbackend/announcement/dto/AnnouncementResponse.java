package com.washalert.washalertbackend.announcement.dto;

import com.washalert.washalertbackend.announcement.AnnouncementType;

import java.time.LocalDateTime;

public record AnnouncementResponse(
        Long id,
        String title,
        String message,
        AnnouncementType type,
        boolean targetAllBranches,
        String branch,
        Long createdByUserId,
        String createdByName,
        LocalDateTime createdAt
) {
}
