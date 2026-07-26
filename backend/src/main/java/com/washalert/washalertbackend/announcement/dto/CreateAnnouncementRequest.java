package com.washalert.washalertbackend.announcement.dto;

import com.washalert.washalertbackend.announcement.AnnouncementType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateAnnouncementRequest(
        @NotBlank(message = "Title is required.")
        @Size(max = 180, message = "Title is too long.")
        String title,
        @NotBlank(message = "Message is required.")
        @Size(max = 5000, message = "Message is too long.")
        String message,
        @NotNull(message = "Announcement type is required.")
        AnnouncementType type,
        // optional: when omitted for admin, announcement targets all branches
        @Size(max = 80, message = "Branch is too long.")
        String branch
) {
}
