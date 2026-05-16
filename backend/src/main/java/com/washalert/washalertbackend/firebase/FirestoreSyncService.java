package com.washalert.washalertbackend.firebase;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.SetOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Service
public class FirestoreSyncService {

    private static final Logger log = LoggerFactory.getLogger(FirestoreSyncService.class);

    private final Optional<Firestore> firestore;
    private final ObjectMapper objectMapper;
    private final FirebaseProperties firebaseProperties;

    public FirestoreSyncService(Optional<Firestore> firestore, ObjectMapper objectMapper, FirebaseProperties firebaseProperties) {
        this.firestore = firestore;
        this.objectMapper = objectMapper;
        this.firebaseProperties = firebaseProperties;
    }

    public boolean isEnabled() {
        return firebaseProperties.enabled() && firestore.isPresent();
    }

    public void upsert(String collection, String documentId, Object payload) {
        if (!isEnabled()) return;
        if (!StringUtils.hasText(collection) || !StringUtils.hasText(documentId) || payload == null) return;

        try {
            Map<String, Object> doc = objectMapper.convertValue(payload, new TypeReference<>() {});
            Map<String, Object> normalized = normalizeMap(doc);
            normalized.put("_syncedAt", Instant.now().toString());

            firestore.get()
                    .collection(collection.trim())
                    .document(sanitizeDocumentId(documentId))
                    .set(normalized);
        } catch (Exception ex) {
            log.warn("Firestore upsert failed for collection={} docId={}: {}", collection, documentId, ex.getMessage());
        }
    }

    /**
     * Blocking variant of upsert for critical documents (order status, delivery assignment).
     * Waits up to 5 seconds for Firestore to confirm the write. Logs an error on timeout
     * rather than silently losing the update.
     */
    public void upsertBlocking(String collection, String documentId, Object payload) {
        if (!isEnabled()) return;
        if (!StringUtils.hasText(collection) || !StringUtils.hasText(documentId) || payload == null) return;

        try {
            Map<String, Object> doc = objectMapper.convertValue(payload, new TypeReference<>() {});
            Map<String, Object> normalized = normalizeMap(doc);
            normalized.put("_syncedAt", Instant.now().toString());

            firestore.get()
                    .collection(collection.trim())
                    .document(sanitizeDocumentId(documentId))
                    .set(normalized)
                    .get(5, TimeUnit.SECONDS);
        } catch (java.util.concurrent.TimeoutException tex) {
            log.error("Firestore blocking upsert timed out for collection={} docId={}", collection, documentId);
        } catch (Exception ex) {
            log.error("Firestore blocking upsert failed for collection={} docId={}: {}", collection, documentId, ex.getMessage());
        }
    }

    public void mergePatchBlocking(String collection, String documentId, Map<String, Object> fields) {
        if (!isEnabled()) return;
        if (!StringUtils.hasText(collection) || !StringUtils.hasText(documentId) || fields == null) return;
        try {
            Map<String, Object> normalized = normalizeMap(fields);
            normalized.put("_syncedAt", Instant.now().toString());
            firestore.get()
                    .collection(collection.trim())
                    .document(sanitizeDocumentId(documentId))
                    .set(normalized, SetOptions.merge())
                    .get(5, TimeUnit.SECONDS);
        } catch (java.util.concurrent.TimeoutException tex) {
            log.error("Firestore merge-patch timed out for collection={} docId={}", collection, documentId);
        } catch (Exception ex) {
            log.error("Firestore merge-patch failed for collection={} docId={}: {}", collection, documentId, ex.getMessage());
        }
    }

    public Optional<Map<String, Object>> get(String collection, String documentId) {
        if (!isEnabled()) return Optional.empty();
        if (!StringUtils.hasText(collection) || !StringUtils.hasText(documentId)) return Optional.empty();
        try {
            DocumentSnapshot snap = firestore.get()
                    .collection(collection.trim())
                    .document(sanitizeDocumentId(documentId))
                    .get()
                    .get(5, TimeUnit.SECONDS);
            return snap.exists() ? Optional.ofNullable(snap.getData()) : Optional.empty();
        } catch (Exception ex) {
            log.warn("Firestore get failed for collection={} docId={}: {}", collection, documentId, ex.getMessage());
            return Optional.empty();
        }
    }

    public void delete(String collection, String documentId) {
        if (!isEnabled()) return;
        if (!StringUtils.hasText(collection) || !StringUtils.hasText(documentId)) return;

        try {
            firestore.get()
                    .collection(collection.trim())
                    .document(sanitizeDocumentId(documentId))
                    .delete();
        } catch (Exception ex) {
            log.warn("Firestore delete failed for collection={} docId={}: {}", collection, documentId, ex.getMessage());
        }
    }

    private String sanitizeDocumentId(String rawId) {
        String id = rawId.trim();
        return id.replace("/", "_");
    }

    private Map<String, Object> normalizeMap(Map<String, Object> source) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            normalized.put(entry.getKey(), normalizeValue(entry.getValue()));
        }
        return normalized;
    }

    @SuppressWarnings("unchecked")
    private Object normalizeValue(Object value) {
        if (value == null) return null;
        if (value instanceof String || value instanceof Number || value instanceof Boolean) return value;
        if (value instanceof Enum<?> enumValue) return enumValue.name();
        if (value instanceof LocalDateTime
                || value instanceof LocalDate
                || value instanceof LocalTime
                || value instanceof Instant
                || value instanceof OffsetDateTime
                || value instanceof ZonedDateTime) {
            return value.toString();
        }
        if (value instanceof Map<?, ?> mapValue) {
            Map<String, Object> nested = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : mapValue.entrySet()) {
                nested.put(String.valueOf(e.getKey()), normalizeValue(e.getValue()));
            }
            return nested;
        }
        if (value instanceof List<?> listValue) {
            List<Object> normalized = new ArrayList<>();
            for (Object item : listValue) {
                normalized.add(normalizeValue(item));
            }
            return normalized;
        }

        // Fallback for any unsupported type.
        return String.valueOf(value);
    }
}
