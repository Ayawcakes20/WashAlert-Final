package com.washalert.washalertbackend.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks per-account failed OTP/login attempts and enforces a temporary
 * lockout after MAX_ATTEMPTS consecutive failures. Implemented in-memory
 * (same pattern as RateLimitFilter) — no DB schema changes required.
 *
 * Lockout resets automatically after LOCK_DURATION_SECONDS, or immediately
 * on a successful login.
 */
@Component
public class LoginAttemptService {

    private static final Logger log = LoggerFactory.getLogger(LoginAttemptService.class);

    static final int    MAX_ATTEMPTS          = 5;
    static final long   LOCK_DURATION_SECONDS = 30 * 60L;  // 30 minutes
    private static final long CLEANUP_INTERVAL_SECONDS = 120L;
    private static final long STALE_SECONDS          = 2 * 60 * 60L; // 2 hours

    private record AttemptRecord(int count, long lockUntilSec, long updatedSec) {}

    private final ConcurrentHashMap<String, AttemptRecord> attempts = new ConcurrentHashMap<>();
    private volatile long lastCleanupSec = 0;

    /** Returns true if the account is currently locked out. */
    public boolean isLocked(String email) {
        if (email == null) return false;
        AttemptRecord r = attempts.get(normalize(email));
        return r != null && r.lockUntilSec() > 0 && Instant.now().getEpochSecond() < r.lockUntilSec();
    }

    /** Seconds remaining on the current lockout, or 0 if not locked. */
    public long getLockRemainingSeconds(String email) {
        if (email == null) return 0;
        AttemptRecord r = attempts.get(normalize(email));
        if (r == null || r.lockUntilSec() <= 0) return 0;
        return Math.max(0, r.lockUntilSec() - Instant.now().getEpochSecond());
    }

    /** Call on every failed OTP/password attempt. */
    public void recordFailure(String email) {
        if (email == null) return;
        String key   = normalize(email);
        long nowSec  = Instant.now().getEpochSecond();

        AttemptRecord updated = attempts.compute(key, (k, old) -> {
            int newCount;
            if (old == null || (old.lockUntilSec() > 0 && old.lockUntilSec() <= nowSec)) {
                // No record, or a previous lock already expired — start fresh
                newCount = 1;
            } else {
                newCount = old.count() + 1;
            }
            long lockUntil = newCount >= MAX_ATTEMPTS ? nowSec + LOCK_DURATION_SECONDS : 0L;
            return new AttemptRecord(newCount, lockUntil, nowSec);
        });

        if (updated.lockUntilSec() > 0) {
            log.warn("[SECURITY][LOCKOUT] email={} locked for {} min after {} consecutive failures",
                    maskEmail(email), LOCK_DURATION_SECONDS / 60, MAX_ATTEMPTS);
        } else {
            log.warn("[SECURITY][FAILED_LOGIN] email={} attempt {} of {}",
                    maskEmail(email), updated.count(), MAX_ATTEMPTS);
        }

        maybeCleanup(nowSec);
    }

    /** Call on every successful OTP verification — clears the failure counter. */
    public void recordSuccess(String email) {
        if (email == null) return;
        attempts.remove(normalize(email));
        log.info("[SECURITY][LOGIN_SUCCESS] Cleared failure counters for email={}", maskEmail(email));
    }

    // ── internals ──────────────────────────────────────────────────────────────

    private void maybeCleanup(long nowSec) {
        if (nowSec - lastCleanupSec < CLEANUP_INTERVAL_SECONDS) return;
        lastCleanupSec = nowSec;

        Iterator<Map.Entry<String, AttemptRecord>> it = attempts.entrySet().iterator();
        while (it.hasNext()) {
            AttemptRecord r = it.next().getValue();
            boolean lockExpired = r.lockUntilSec() > 0 && r.lockUntilSec() <= nowSec;
            boolean stale       = r.updatedSec() < nowSec - STALE_SECONDS;
            if (lockExpired || stale) it.remove();
        }
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "<unknown>";
        int at     = email.indexOf('@');
        String local = email.substring(0, at);
        String masked = local.length() <= 2 ? "*" : local.substring(0, 2) + "***";
        return masked + "@" + email.substring(at + 1);
    }
}
