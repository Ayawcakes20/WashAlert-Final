package com.washalert.washalertbackend.analytics;

import com.washalert.washalertbackend.analytics.dto.AnalyticsSummaryResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public AnalyticsSummaryResponse summary(
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String branch,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return analyticsService.summary(parseDateOrNull(fromDate), parseDateOrNull(toDate), branch, principal);
    }

    private LocalDate parseDateOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(trimmed);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }
}
