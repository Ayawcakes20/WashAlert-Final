package com.washalert.washalertbackend.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);
    Optional<User> findByFirebaseUid(String firebaseUid);
    Optional<User> findByFirebaseUidOrEmail(String firebaseUid, String email);

    boolean existsByEmail(String email);
    boolean existsByFirebaseUid(String firebaseUid);

    List<User> findByRole(Role role);
    List<User> findByRoleIn(List<Role> roles);
    List<User> findAllByRoleAndFullName(Role role, String fullName);
    List<User> findByRoleAndBranchIgnoreCase(Role role, String branch);
    List<User> findAllByFcmToken(String fcmToken);

    @Query(
            value = """
                    select u
                    from User u
                    where u.role in :allowedRoles
                      and (:role is null or u.role = :role)
                      and (:status is null or u.status = :status)
                      and (:branch is null or lower(replace(u.branch, ' BRANCH', '')) = lower(replace(:branch, ' BRANCH', '')))
                      and (:search is null or lower(u.fullName) like lower(concat('%', :search, '%'))
                           or lower(u.email) like lower(concat('%', :search, '%')))
                    """,
            countQuery = """
                    select count(u)
                    from User u
                    where u.role in :allowedRoles
                      and (:role is null or u.role = :role)
                      and (:status is null or u.status = :status)
                      and (:branch is null or lower(replace(u.branch, ' BRANCH', '')) = lower(replace(:branch, ' BRANCH', '')))
                      and (:search is null or lower(u.fullName) like lower(concat('%', :search, '%'))
                           or lower(u.email) like lower(concat('%', :search, '%')))
                    """
    )
    Page<User> findInternalUsersPaged(
            @Param("allowedRoles") List<Role> allowedRoles,
            @Param("role") Role role,
            @Param("status") UserStatus status,
            @Param("branch") String branch,
            @Param("search") String search,
            Pageable pageable
    );
}
