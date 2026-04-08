package com.washalert.washalertbackend.reporting.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

public record NlReportRequest(
        @NotBlank(message = "Query is required.")
        String query,
        LocalDate fromDate,
        LocalDate toDate,
        String branch
) {
}
