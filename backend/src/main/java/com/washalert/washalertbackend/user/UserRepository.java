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

    // Branch is free text with no canonical entity/FK, so the same branch can be stored as
    // "Quezon City" on one row and "Quezon City Branch" on another. This mirrors the same
    // " branch" suffix normalization used by findInternalUsersPaged below — without it, an
    // exact case-insensitive match silently returns zero rows whenever the two sides of the
    // comparison used a different convention (this is what caused the Assign Delivery rider
    // dropdown to appear empty even when active drivers existed for the branch).
    @Query("""
            select u
            from User u
            where u.role = :role
              and replace(lower(u.branch), ' branch', '') = replace(lower(:branch), ' branch', '')
            """)
    List<User> findByRoleAndNormalizedBranch(@Param("role") Role role, @Param("branch") String branch);

    @Query(
            value = """
                    select u
                    from User u
                    where u.role in :allowedRoles
                      and (:role is null or u.role = :role)
                      and (:status is null or u.status = :status)
                      and (:branch is null or replace(lower(u.branch), ' branch', '') = replace(lower(:branch), ' branch', ''))
                      and (:search is null or lower(u.fullName) like lower(concat('%', :search, '%'))
                           or lower(u.email) like lower(concat('%', :search, '%')))
                    """,
            countQuery = """
                    select count(u)
                    from User u
                    where u.role in :allowedRoles
                      and (:role is null or u.role = :role)
                      and (:status is null or u.status = :status)
                      and (:branch is null or replace(lower(u.branch), ' branch', '') = replace(lower(:branch), ' branch', ''))
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
