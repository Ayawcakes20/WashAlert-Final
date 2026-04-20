package com.washalert.washalertbackend.dashboard;

import com.washalert.washalertbackend.dashboard.dto.DashboardSummaryResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public DashboardSummaryResponse summary(@AuthenticationPrincipal AuthUserDetails principal) {
        return service.summary(principal);
    }
}
