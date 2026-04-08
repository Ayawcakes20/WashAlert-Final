package com.washalert.washalertbackend.user;

import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user/profile")
public class UserProfileController {

    private final UserRepository userRepository;

    public UserProfileController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public record UpdateFcmTokenRequest(
            @NotBlank(message = "FCM token is required.")
            String fcmToken
    ) {}

    public record UpdateProfileRequest(
            @NotBlank(message = "Full name is required.")
            String fullName
    ) {}

    @PutMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateProfile(
            @AuthenticationPrincipal AuthUserDetails principal,
            @Valid @RequestBody UpdateProfileRequest req
    ) {
        User user = principal.getUser();
        user.setFullName(req.fullName());
        userRepository.save(user);
    }

    @PutMapping("/fcm-token")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateFcmToken(
            @AuthenticationPrincipal AuthUserDetails principal,
            @Valid @RequestBody UpdateFcmTokenRequest req
    ) {
        User user = principal.getUser();
        user.setFcmToken(req.fcmToken());
        userRepository.save(user);
    }
}
