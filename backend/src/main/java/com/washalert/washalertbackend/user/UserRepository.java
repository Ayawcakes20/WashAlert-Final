package com.washalert.washalertbackend.user;

import org.springframework.data.jpa.repository.JpaRepository;

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
}
