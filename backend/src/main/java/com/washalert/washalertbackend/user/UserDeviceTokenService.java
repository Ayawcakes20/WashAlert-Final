package com.washalert.washalertbackend.user;

import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;

@Service
public class UserDeviceTokenService {
    private static final Logger log = LoggerFactory.getLogger(UserDeviceTokenService.class);

    private final UserDeviceTokenRepository tokenRepository;
    private final UserRepository userRepository;

    public UserDeviceTokenService(
            UserDeviceTokenRepository tokenRepository,
            UserRepository userRepository
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void registerToken(User user, String rawFcmToken, String rawPlatform, String rawDeviceId) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("Authenticated user is required.");
        }

        String fcmToken = normalizeRequired(rawFcmToken, "FCM token is required.");
        String platform = normalizeOptional(rawPlatform);
        String deviceId = normalizeOptional(rawDeviceId);
        LocalDateTime now = LocalDateTime.now();

        Optional<UserDeviceToken> tokenMatchOpt = tokenRepository.findByFcmToken(fcmToken);
        Optional<UserDeviceToken> deviceMatchOpt = (deviceId == null)
                ? Optional.empty()
                : tokenRepository.findFirstByUser_IdAndDeviceIdOrderByUpdatedAtDesc(user.getId(), deviceId);

        UserDeviceToken tokenMatch = tokenMatchOpt.orElse(null);
        UserDeviceToken deviceMatch = deviceMatchOpt.orElse(null);

        UserDeviceToken target;
        if (tokenMatch != null) {
            target = tokenMatch;
        } else if (deviceMatch != null) {
            target = deviceMatch;
        } else {
            target = new UserDeviceToken();
        }

        // If this device already had an older token record, keep a single active row and deactivate the stale one.
        if (tokenMatch != null && deviceMatch != null && !tokenMatch.getId().equals(deviceMatch.getId())) {
            deviceMatch.setActive(false);
            deviceMatch.setLastSeenAt(now);
            tokenRepository.save(deviceMatch);
            log.info(
                    "[FCM] Deactivated stale token row id={} userId={} deviceId={} while merging with token row id={}",
                    deviceMatch.getId(),
                    user.getId(),
                    deviceId,
                    tokenMatch.getId()
            );
        }

        applyTokenState(target, user, fcmToken, platform, deviceId, now);

        try {
            tokenRepository.save(target);
        } catch (DataIntegrityViolationException ex) {
            // Handle race: another request inserted the same token first.
            UserDeviceToken existing = tokenRepository.findByFcmToken(fcmToken)
                    .orElseThrow(() -> ex);
            applyTokenState(existing, user, fcmToken, platform, deviceId, now);
            tokenRepository.save(existing);
            log.info(
                    "[FCM] Recovered duplicate token registration race for userId={} deviceId={} tokenSuffix={}",
                    user.getId(),
                    deviceId,
                    maskToken(fcmToken)
            );
        }

        // Backward compatibility for existing single-token lookups.
        user.setFcmToken(fcmToken);
        userRepository.save(user);
        log.debug(
                "[FCM] Registered token userId={} deviceId={} platform={} tokenSuffix={}",
                user.getId(),
                deviceId,
                platform,
                maskToken(fcmToken)
        );
    }

    @Transactional
    public void deactivateToken(String rawFcmToken) {
        String token = normalizeOptional(rawFcmToken);
        if (token == null) return;

        tokenRepository.findByFcmToken(token).ifPresent(record -> {
            record.setActive(false);
            tokenRepository.save(record);
        });

        userRepository.findAllByFcmToken(token).forEach(user -> {
            user.setFcmToken(null);
            userRepository.save(user);
        });
    }

    private String normalizeRequired(String value, String message) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void applyTokenState(
            UserDeviceToken target,
            User user,
            String fcmToken,
            String platform,
            String deviceId,
            LocalDateTime now
    ) {
        target.setUser(user);
        target.setFcmToken(fcmToken);
        target.setDeviceId(deviceId);
        target.setPlatform(platform == null ? "MOBILE" : platform.toUpperCase(Locale.ROOT));
        target.setActive(true);
        target.setLastSeenAt(now);
    }

    private String maskToken(String token) {
        if (token == null || token.length() < 8) return "unknown";
        return token.substring(token.length() - 8);
    }
}
