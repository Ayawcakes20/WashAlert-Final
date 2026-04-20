package com.washalert.washalertbackend.user;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user/profile")
public class UserProfileController {
    private static final Logger log = LoggerFactory.getLogger(UserProfileController.class);

    private final UserRepository userRepository;
    private final UserDeviceTokenService userDeviceTokenService;
    private final FirestoreSyncService firestoreSyncService;

    public UserProfileController(
            UserRepository userRepository,
            UserDeviceTokenService userDeviceTokenService,
            FirestoreSyncService firestoreSyncService
    ) {
        this.userRepository = userRepository;
        this.userDeviceTokenService = userDeviceTokenService;
        this.firestoreSyncService = firestoreSyncService;
    }

    public record UpdateFcmTokenRequest(
            @NotBlank(message = "FCM token is required.")
            String fcmToken,
            String platform,
            String deviceId
    ) {}

    public record UpdateProfileRequest(
            @NotBlank(message = "Full name is required.")
            String fullName,
            @Pattern(
                    regexp = "^$|^09\\d{9}$",
                    message = "Mobile number must use format 09XXXXXXXXX."
            )
            String mobileNumber,
            String profileImageUrl
    ) {}

    @PutMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateProfile(
            @AuthenticationPrincipal AuthUserDetails principal,
            @Valid @RequestBody UpdateProfileRequest req
    ) {
        User user = principal.getUser();
        String normalizedName = req.fullName().trim();
        String normalizedMobile = normalizeBlankToNull(req.mobileNumber());
        String normalizedImageUrl = normalizeBlankToNull(req.profileImageUrl());

        user.setFullName(normalizedName);
        user.setMobileNumber(normalizedMobile);
        user.setProfileImageUrl(normalizedImageUrl);
        User saved = userRepository.save(user);
        firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));

        log.info(
                "[PROFILE] Updated user profile userId={} fullNameUpdated={} mobileUpdated={} imageUpdated={}",
                saved.getId(),
                true,
                normalizedMobile != null,
                normalizedImageUrl != null
        );
    }

    @PutMapping("/fcm-token")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateFcmToken(
            @AuthenticationPrincipal AuthUserDetails principal,
            @Valid @RequestBody UpdateFcmTokenRequest req
    ) {
        User user = principal.getUser();
        userDeviceTokenService.registerToken(user, req.fcmToken(), req.platform(), req.deviceId());
    }

    private String normalizeBlankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
