package com.washalert.washalertbackend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    /**
     * windowMinute: epochMinute (nowSec / 60)
     * count: requests in that minute
     * lastSeenSec: last time we saw this key (for cleanup)
     */
    private record Window(long windowMinute, int count, long lastSeenSec) {}

    private final Map<String, Window> buckets = new ConcurrentHashMap<>();

    // Limits (per minute per IP)
    private static final int LOGIN_LIMIT  = 10;
    private static final int OTP_LIMIT    = 5;
    private static final int FORGOT_LIMIT = 5;
    private static final int RESET_LIMIT  = 10;

    // Cleanup controls
    private static final int MAX_BUCKETS = 10_000;        // safety cap
    private static final long STALE_SEC = 60L * 10L;      // remove keys not seen for 10 minutes
    private volatile long lastCleanupSec = 0;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return true;

        String path = request.getRequestURI();
        // Only rate-limit these endpoints
        return !(path.equals("/api/auth/login")
                || path.equals("/api/auth/resend-otp")
                || path.equals("/api/auth/firebase-login-otp/request")
                || path.equals("/api/auth/firebase-login-otp/resend")
                || path.equals("/api/auth/firebase-login-otp/verify")
                || path.equals("/api/auth/forgot-password")
                || path.equals("/api/auth/reset-password")
                || path.equals("/api/auth/set-password"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        long nowSec = Instant.now().getEpochSecond();
        maybeCleanup(nowSec);

        String path = req.getRequestURI();
        String ip = clientIp(req);

        // key per endpoint per IP
        String key = path + "::" + ip;

        int limit = switch (path) {
            case "/api/auth/login" -> LOGIN_LIMIT;
            case "/api/auth/resend-otp" -> OTP_LIMIT;
            case "/api/auth/firebase-login-otp/request" -> OTP_LIMIT;
            case "/api/auth/firebase-login-otp/resend" -> OTP_LIMIT;
            case "/api/auth/firebase-login-otp/verify" -> LOGIN_LIMIT;
            case "/api/auth/forgot-password" -> FORGOT_LIMIT;
            case "/api/auth/reset-password" -> RESET_LIMIT;
            case "/api/auth/set-password" -> RESET_LIMIT;
            default -> 100;
        };

        long nowMinute = nowSec / 60; // 1-minute window

        Window updated = buckets.compute(key, (k, old) -> {
            if (old == null || old.windowMinute() != nowMinute) {
                return new Window(nowMinute, 1, nowSec);
            }
            return new Window(nowMinute, old.count() + 1, nowSec);
        });

        if (updated.count() > limit) {
            writeRateLimitError(req, res, path);
            return; // ✅ IMPORTANT: stop the chain after writing
        }

        chain.doFilter(req, res);
    }

    private void writeRateLimitError(HttpServletRequest req, HttpServletResponse res, String path) throws IOException {
        // ✅ If something already wrote to the response, do not write again
        if (res.isCommitted()) return;

        // ✅ Clear any partial content (do NOT use reset() because it clears headers too aggressively)
        res.resetBuffer();

        res.setStatus(429);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);

        // Match your ApiError record shape: timestamp, status, message, path
        String body = """
                {
                  "timestamp": "%s",
                  "status": 429,
                  "message": "Too many requests. Please try again later.",
                  "path": "%s"
                }
                """.formatted(Instant.now().toString(), escapeJson(path));

        res.getWriter().write(body);
        res.getWriter().flush();
        res.flushBuffer(); // ✅ ensure nothing else tries to render /error
    }

    private String clientIp(HttpServletRequest req) {
        // If behind proxy later, this will work (use first IP)
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String first = xff.split(",")[0].trim();
            if (!first.isBlank()) return first;
        }
        return req.getRemoteAddr();
    }

    private void maybeCleanup(long nowSec) {
        // Cleanup at most once per 30 seconds
        if (nowSec - lastCleanupSec < 30) return;
        lastCleanupSec = nowSec;

        // If map is getting big OR entries are stale, prune
        if (buckets.size() < MAX_BUCKETS && buckets.isEmpty()) return;

        long cutoff = nowSec - STALE_SEC;

        Iterator<Map.Entry<String, Window>> it = buckets.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Window> e = it.next();
            Window w = e.getValue();
            if (w == null) {
                it.remove();
                continue;
            }
            // remove stale
            if (w.lastSeenSec() < cutoff) {
                it.remove();
            }
        }

        // Hard cap safety: if still too large, prune more aggressively (oldest-ish by lastSeen)
        if (buckets.size() > MAX_BUCKETS) {
            long aggressiveCutoff = nowSec - 60; // keep only last 1 minute if exploding
            Iterator<Map.Entry<String, Window>> it2 = buckets.entrySet().iterator();
            while (it2.hasNext()) {
                Window w = it2.next().getValue();
                if (w == null || w.lastSeenSec() < aggressiveCutoff) it2.remove();
            }
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
