package com.washalert.washalertbackend.announcement.dto;

import com.washalert.washalertbackend.announcement.AnnouncementType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateAnnouncementRequest(
        @NotBlank(message = "Title is required.")
        String title,
        @NotBlank(message = "Message is required.")
        String message,
        @NotNull(message = "Announcement type is required.")
        AnnouncementType type,
        // optional: when omitted for admin, announcement targets all branches
        String branch
) {
}
