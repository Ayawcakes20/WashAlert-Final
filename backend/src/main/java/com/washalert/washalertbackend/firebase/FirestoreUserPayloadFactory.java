package com.washalert.washalertbackend.firebase;

import com.washalert.washalertbackend.user.User;

import java.util.LinkedHashMap;
import java.util.Map;

public final class FirestoreUserPayloadFactory {

    private FirestoreUserPayloadFactory() {
    }

    public static Map<String, Object> fromUser(User user) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", user.getId());
        payload.put("firebaseUid", user.getFirebaseUid());
        payload.put("email", user.getEmail());
        payload.put("fullName", user.getFullName());
        payload.put("role", user.getRole());
        payload.put("status", user.getStatus());
        payload.put("branch", user.getBranch());
        payload.put("branchId", user.getBranchId());
        payload.put("enabled", user.isEnabled());
        payload.put("mustChangePassword", user.isMustChangePassword());
        payload.put("provider", user.getProvider());
        payload.put("invitedBy", user.getInvitedBy());
        payload.put("invitedAt", user.getInvitedAt());
        payload.put("activatedAt", user.getActivatedAt());
        payload.put("deactivatedAt", user.getDeactivatedAt());
        payload.put("lastLoginAt", user.getLastLoginAt());
        payload.put("verifiedAt", user.getVerifiedAt());
        payload.put("createdAt", user.getCreatedAt());
        payload.put("updatedAt", user.getUpdatedAt());
        payload.put("passwordHash", user.getPasswordHash());
        return payload;
    }
}
