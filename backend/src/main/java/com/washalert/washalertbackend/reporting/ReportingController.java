package com.washalert.washalertbackend.reporting;

import com.washalert.washalertbackend.reporting.dto.NlReportRequest;
import com.washalert.washalertbackend.reporting.dto.NlReportResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class ReportingController {

    private final ReportingService reportingService;

    public ReportingController(ReportingService reportingService) {
        this.reportingService = reportingService;
    }

    @PostMapping("/nl")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public NlReportResponse reportFromNaturalLanguage(
            @Valid @RequestBody NlReportRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return reportingService.runNaturalLanguageReport(req, principal);
    }
}
