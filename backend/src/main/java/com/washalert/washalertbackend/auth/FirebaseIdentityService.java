package com.washalert.washalertbackend.auth;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class FirebaseIdentityService {
    private static final Logger log = LoggerFactory.getLogger(FirebaseIdentityService.class);

    private final FirebaseApp firebaseApp;
    private static final int INVITE_BOOTSTRAP_PASSWORD_BYTES = 16;

    public FirebaseIdentityService(ObjectProvider<FirebaseApp> firebaseAppProvider) {
        this.firebaseApp = firebaseAppProvider.getIfAvailable();
    }

    public boolean isEnabled() {
        return firebaseApp != null;
    }

    public FirebaseToken verifyIdToken(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            log.warn("[AUTH][FIREBASE] verifyIdToken rejected: token is null/blank");
            throw new IllegalArgumentException("Firebase ID token is required.");
        }

        String normalizedToken = normalizeIncomingIdToken(idToken);
        String configuredProjectId = firebaseApp != null && firebaseApp.getOptions() != null
                ? firebaseApp.getOptions().getProjectId()
                : "<no-firebase-app>";

        log.info(
                "[AUTH][FIREBASE] verifyIdToken start nullOrBlank={} length={} prefix20='{}' firebaseProjectId='{}'",
                normalizedToken.isBlank(),
                normalizedToken.length(),
                snapshotPrefix(normalizedToken),
                configuredProjectId
        );

        try {
            // Use non-revocation verification for login OTP bootstrap to avoid
            // extra Auth API dependencies during project/API propagation.
            FirebaseToken token = firebaseAuth().verifyIdToken(normalizedToken);
            Object aud = token.getClaims() == null ? null : token.getClaims().get("aud");
            Object exp = token.getClaims() == null ? null : token.getClaims().get("exp");
            log.info(
                    "[AUTH][FIREBASE] verifyIdToken success uid={} aud={} iss={} exp={}",
                    token.getUid(),
                    aud,
                    token.getIssuer(),
                    exp
            );
            return token;
        } catch (FirebaseAuthException ex) {
            String reason = ex.getAuthErrorCode() != null
                    ? ex.getAuthErrorCode().name()
                    : "VERIFICATION_FAILED";
            log.error(
                    "[AUTH][FIREBASE] verifyIdToken failed class={} authCode={} message={}",
                    ex.getClass().getName(),
                    ex.getAuthErrorCode(),
                    ex.getMessage()
            );
            throw new IllegalArgumentException("Firebase ID token verification failed (" + reason + ").");
        }
    }

    public UserRecord createUser(String email, String fullName, String password) {
        return createUserInternal(email, fullName, password);
    }

    public UserRecord createInvitationUser(String email, String fullName) {
        try {
            return createUserInternal(email, fullName, null);
        } catch (IllegalStateException ex) {
            // Fallback for Firebase projects that still require a password for reset-link onboarding.
            return createUserInternal(email, fullName, generateBootstrapPassword());
        }
    }

    public String generatePasswordResetLink(String email) {
        try {
            return firebaseAuth().generatePasswordResetLink(email);
        } catch (FirebaseAuthException ex) {
            throw new IllegalStateException("Unable to generate password setup link.");
        }
    }

    public void updateUserPassword(String firebaseUid, String newPassword) {
        try {
            UserRecord.UpdateRequest request = new UserRecord.UpdateRequest(firebaseUid)
                    .setPassword(newPassword);
            firebaseAuth().updateUser(request);
        } catch (FirebaseAuthException ex) {
            throw new IllegalStateException("Unable to update Firebase password: " + ex.getMessage());
        }
    }

    private UserRecord createUserInternal(String email, String fullName, String password) {
        try {
            UserRecord.CreateRequest request = new UserRecord.CreateRequest()
                    .setEmail(email)
                    .setDisplayName(fullName)
                    .setDisabled(false);
            if (password != null && !password.isBlank()) {
                request.setPassword(password);
            }
            return firebaseAuth().createUser(request);
        } catch (FirebaseAuthException ex) {
            if (ex.getAuthErrorCode() == AuthErrorCode.EMAIL_ALREADY_EXISTS) {
                throw new IllegalArgumentException("Email is already in use.");
            }
            throw new IllegalStateException("Unable to create Firebase account.");
        }
    }

    private String generateBootstrapPassword() {
        byte[] bytes = new byte[INVITE_BOOTSTRAP_PASSWORD_BYTES];
        new SecureRandom().nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public String toFrontendActionLink(String firebaseLink, String frontendBaseUrl, String frontendPath) {
        if (firebaseLink == null || firebaseLink.isBlank()) {
            throw new IllegalArgumentException("Firebase action link is required.");
        }
        Map<String, String> params = parseQueryParams(firebaseLink);
        String oobCode = params.get("oobCode");
        if (oobCode == null || oobCode.isBlank()) {
            throw new IllegalStateException("Firebase action link is missing oobCode.");
        }

        String mode = params.getOrDefault("mode", "resetPassword");
        String lang = params.get("lang");
        String apiKey = params.get("apiKey");

        String base = normalizeFrontendBaseUrl(frontendBaseUrl);
        String path = frontendPath == null ? "" : frontendPath.trim();
        String normalizedPath = path.startsWith("/") ? path : "/" + path;

        StringBuilder link = new StringBuilder(base)
                .append(normalizedPath)
                .append("?oobCode=").append(urlEncode(oobCode))
                .append("&mode=").append(urlEncode(mode));

        if (lang != null && !lang.isBlank()) {
            link.append("&lang=").append(urlEncode(lang));
        }
        if (apiKey != null && !apiKey.isBlank()) {
            link.append("&apiKey=").append(urlEncode(apiKey));
        }

        return link.toString();
    }

    private static Map<String, String> parseQueryParams(String url) {
        try {
            URI uri = new URI(url);
            String query = uri.getRawQuery();
            Map<String, String> params = new LinkedHashMap<>();
            if (query == null || query.isBlank()) {
                return params;
            }
            for (String pair : query.split("&")) {
                if (pair.isBlank()) continue;
                String[] parts = pair.split("=", 2);
                String key = urlDecode(parts[0]);
                String value = parts.length > 1 ? urlDecode(parts[1]) : "";
                params.put(key, value);
            }
            return params;
        } catch (URISyntaxException ex) {
            throw new IllegalStateException("Invalid Firebase action link.");
        }
    }

    private static String urlDecode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static String urlEncode(String value) {
        String encoded = java.net.URLEncoder.encode(value, StandardCharsets.UTF_8);
        return encoded.replace("+", "%20");
    }

    private static String trimTrailingSlash(String value) {
        if (value == null) return "";
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static String normalizeFrontendBaseUrl(String frontendBaseUrl) {
        return trimTrailingSlash(frontendBaseUrl);
    }

    private FirebaseAuth firebaseAuth() {
        if (firebaseApp == null) {
            log.error("[AUTH][FIREBASE] FirebaseApp is null during FirebaseAuth access.");
            throw new IllegalStateException("Firebase authentication is not configured.");
        }
        return FirebaseAuth.getInstance(firebaseApp);
    }

    private String normalizeIncomingIdToken(String idToken) {
        String normalized = idToken == null ? "" : idToken.trim();
        if (normalized.regionMatches(true, 0, "Bearer ", 0, 7)) {
            normalized = normalized.substring(7).trim();
        }
        return normalized;
    }

    private String snapshotPrefix(String value) {
        if (value == null || value.isBlank()) return "";
        return value.substring(0, Math.min(20, value.length()));
    }
}
