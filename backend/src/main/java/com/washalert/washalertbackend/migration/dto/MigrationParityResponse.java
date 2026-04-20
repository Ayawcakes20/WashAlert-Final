package com.washalert.washalertbackend.migration.dto;

import java.time.Instant;
import java.util.List;

public record MigrationParityResponse(
        Instant generatedAt,
        boolean firestoreAvailable,
        String readMode,
        boolean readyForStrictFirestore,
        List<ModuleParityResponse> modules
) {
}
