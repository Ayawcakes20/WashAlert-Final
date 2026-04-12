package com.washalert.washalertbackend.announcement;

import com.washalert.washalertbackend.announcement.dto.AnnouncementResponse;
import com.washalert.washalertbackend.announcement.dto.CreateAnnouncementRequest;
import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private final AnnouncementService announcementService;

    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public AnnouncementResponse create(
            @Valid @RequestBody CreateAnnouncementRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return announcementService.create(req, principal);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<AnnouncementResponse> listHistory(@AuthenticationPrincipal AuthUserDetails principal) {
        return announcementService.listHistory(principal);
    }
}
