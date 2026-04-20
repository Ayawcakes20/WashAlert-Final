package com.washalert.washalertbackend.migration.dto;

public record ModuleParityResponse(
        String module,
        long mysqlCount,
        long firestoreCount,
        boolean parity
) {
}
