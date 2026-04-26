package com.washalert.washalertbackend.support;

public record AiSupportDecision(
        String category,
        String reply,
        boolean escalate
) {
}
