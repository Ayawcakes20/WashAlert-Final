package com.washalert.washalertbackend.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserDeviceTokenRepository extends JpaRepository<UserDeviceToken, Long> {
    Optional<UserDeviceToken> findByFcmToken(String fcmToken);
    Optional<UserDeviceToken> findFirstByUser_IdAndDeviceIdOrderByUpdatedAtDesc(Long userId, String deviceId);
    List<UserDeviceToken> findByUser_IdAndActiveTrue(Long userId);
    List<UserDeviceToken> findByUser_EmailIgnoreCaseAndActiveTrue(String email);
    List<UserDeviceToken> findByUser_RoleInAndActiveTrueAndUser_EnabledTrue(List<Role> roles);
    List<UserDeviceToken> findByUser_RoleInAndUser_BranchIgnoreCaseAndActiveTrueAndUser_EnabledTrue(List<Role> roles, String branch);
}
