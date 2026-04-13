package com.washalert.washalertbackend.support;

public record OpenAiSupportDecision(
        String category,
        String reply,
        boolean escalate
) {
}
