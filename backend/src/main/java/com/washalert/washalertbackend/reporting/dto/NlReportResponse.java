package com.washalert.washalertbackend.reporting.dto;

public record NlReportResponse(
        String intent,
        String answer,
        Object data
) {
}
