package com.washalert.washalertbackend.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserDeviceTokenRepository extends JpaRepository<UserDeviceToken, Long> {
    Optional<UserDeviceToken> findByFcmToken(String fcmToken);
    Optional<UserDeviceToken> findFirstByUser_IdAndDeviceIdOrderByUpdatedAtDesc(Long userId, String deviceId);
    List<UserDeviceToken> findByUser_IdAndActiveTrue(Long userId);
    List<UserDeviceToken> findByUser_EmailIgnoreCaseAndActiveTrue(String email);
    List<UserDeviceToken> findByUser_RoleInAndActiveTrueAndUser_EnabledTrue(List<Role> roles);

    // Branch is free text with no canonical entity/FK (see BranchNames), so this normalizes
    // the same way findInternalUsersPaged does instead of doing a raw exact match — otherwise
    // branch-scoped push notifications silently reach zero devices whenever the order/user
    // branch strings used a different naming convention.
    @Query("""
            select t
            from UserDeviceToken t
            where t.user.role in :roles
              and replace(lower(t.user.branch), ' branch', '') = replace(lower(:branch), ' branch', '')
              and t.active = true
              and t.user.enabled = true
            """)
    List<UserDeviceToken> findByUserRoleInAndNormalizedBranch(@Param("roles") List<Role> roles, @Param("branch") String branch);
}
