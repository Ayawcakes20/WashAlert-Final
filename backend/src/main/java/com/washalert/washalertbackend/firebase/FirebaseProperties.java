package com.washalert.washalertbackend.firebase;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "washalert.firebase")
public record FirebaseProperties(
        boolean enabled,
        String projectId,
        String serviceAccountPath,
        String serviceAccountBase64
) {
}
