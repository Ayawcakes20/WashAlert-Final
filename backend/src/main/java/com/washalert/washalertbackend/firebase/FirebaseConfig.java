package com.washalert.washalertbackend.firebase;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.cloud.firestore.Firestore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Configuration
@EnableConfigurationProperties(FirebaseProperties.class)
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    private final FirebaseProperties firebaseProperties;

    public FirebaseConfig(FirebaseProperties firebaseProperties) {
        this.firebaseProperties = firebaseProperties;
    }

    @Bean
    @ConditionalOnProperty(prefix = "washalert.firebase", name = "enabled", havingValue = "true")
    public FirebaseApp firebaseApp() throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) {
            log.info("[Firebase] Reusing existing FirebaseApp instance.");
            return FirebaseApp.getInstance();
        }

        log.info("[Firebase] Initializing FirebaseApp for project: {}", firebaseProperties.projectId());

        GoogleCredentials credentials = resolveCredentials();

        FirebaseOptions.Builder builder = FirebaseOptions.builder()
                .setCredentials(credentials);

        if (StringUtils.hasText(firebaseProperties.projectId())) {
            builder.setProjectId(firebaseProperties.projectId().trim());
        }

        FirebaseApp app = FirebaseApp.initializeApp(builder.build());
        log.info("[Firebase] FirebaseApp initialized successfully for project '{}'.", firebaseProperties.projectId());
        return app;
    }

    @Bean
    @ConditionalOnBean(FirebaseApp.class)
    public Firestore firestore(FirebaseApp firebaseApp) {
        return FirestoreClient.getFirestore(firebaseApp);
    }

    @Bean
    @ConditionalOnBean(FirebaseApp.class)
    public FirebaseMessaging firebaseMessaging(FirebaseApp firebaseApp) {
        return FirebaseMessaging.getInstance(firebaseApp);
    }

    private GoogleCredentials resolveCredentials() throws IOException {
        // 1. Base64-encoded service account (environment variable — best for production)
        if (StringUtils.hasText(firebaseProperties.serviceAccountBase64())) {
            log.info("[Firebase] Loading credentials from Base64 service account.");
            byte[] decoded = Base64.getDecoder().decode(
                    firebaseProperties.serviceAccountBase64().trim().getBytes(StandardCharsets.UTF_8)
            );
            return GoogleCredentials.fromStream(new ByteArrayInputStream(decoded));
        }

        // 2. File path to service account JSON (good for local development)
        if (StringUtils.hasText(firebaseProperties.serviceAccountPath())) {
            String path = firebaseProperties.serviceAccountPath().trim();
            File keyFile = new File(path);

            // Also resolve relative to the working directory (backend root when running via Maven/IDE)
            if (!keyFile.exists()) {
                keyFile = new File(System.getProperty("user.dir"), path);
            }

            if (keyFile.exists()) {
                log.info("[Firebase] Loading credentials from service account file: {}", keyFile.getAbsolutePath());
                try (FileInputStream fis = new FileInputStream(keyFile)) {
                    return GoogleCredentials.fromStream(fis);
                }
            } else {
                log.error("[Firebase] ============================================================");
                log.error("[Firebase] SERVICE ACCOUNT FILE NOT FOUND: {}", keyFile.getAbsolutePath());
                log.error("[Firebase] To fix:");
                log.error("[Firebase]   1. Go to Firebase Console → Project Settings → Service Accounts");
                log.error("[Firebase]   2. Click 'Generate new private key' and download the JSON file");
                log.error("[Firebase]   3. Save it as: {}", keyFile.getAbsolutePath());
                log.error("[Firebase] ============================================================");
                throw new IOException(
                    "Firebase service account key file not found at: " + keyFile.getAbsolutePath() +
                    "\nDownload it from: Firebase Console → Project Settings → Service Accounts → Generate new private key" +
                    "\nSave as: " + path
                );
            }
        }

        // 3. Application Default Credentials fallback (works on GCP/Cloud Run, not local dev)
        log.warn("[Firebase] No service account configured — falling back to Application Default Credentials.");
        log.warn("[Firebase] This only works on Google Cloud infrastructure. For local dev, set service-account-path.");
        return GoogleCredentials.getApplicationDefault();
    }
}
