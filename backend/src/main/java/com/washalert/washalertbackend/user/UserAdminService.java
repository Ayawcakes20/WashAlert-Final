package com.washalert.washalertbackend.user;

import com.washalert.washalertbackend.audit.StaffAuditService;
import com.washalert.washalertbackend.auth.FirebaseIdentityService;
import com.washalert.washalertbackend.auth.StaffInvitationService;
import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.common.dto.PagedResponse;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.dto.CreateStaffRequest;
import com.washalert.washalertbackend.user.dto.UpdateStaffRequest;
import com.washalert.washalertbackend.user.dto.UserAdminResponse;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
public class UserAdminService {

    private final UserRepository userRepository;
    private final StaffAuditService staffAuditService;
    private final FirestoreSyncService firestoreSyncService;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;
    private final FirebaseIdentityService firebaseIdentityService;
    private final StaffInvitationService staffInvitationService;
    private static final String FIREBASE_MANAGED_PASSWORD_MARKER = "{FIREBASE_MANAGED}";

    public UserAdminService(
            UserRepository userRepository,
            StaffAuditService staffAuditService,
            FirestoreSyncService firestoreSyncService,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties,
            FirebaseIdentityService firebaseIdentityService,
            StaffInvitationService staffInvitationService
    ) {
        this.userRepository = userRepository;
        this.staffAuditService = staffAuditService;
        this.firestoreSyncService = firestoreSyncService;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
        this.firebaseIdentityService = firebaseIdentityService;
        this.staffInvitationService = staffInvitationService;
    }

    public List<UserAdminResponse> listStaff() {
        if (!dataReadProperties.prefersFirestoreReads()) {
            return listInternalFromMysql();
        }

        List<UserAdminResponse> firestoreRows = listInternalFromFirestore();
        if (!firestoreRows.isEmpty()) {
            return firestoreRows;
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            return listInternalFromMysql();
        }

        return firestoreRows;
    }

    /** Returns all DRIVER accounts, optionally filtered to a specific branch. */
    public List<UserAdminResponse> listDrivers(String branch) {
        List<User> drivers = (branch != null && !branch.isBlank())
                ? userRepository.findByRoleAndBranchIgnoreCase(Role.DRIVER, branch.trim())
                : userRepository.findByRole(Role.DRIVER);
        return drivers.stream()
                .sorted(Comparator.comparing(User::getFullName))
                .map(this::toResponse)
                .toList();
    }

    public PagedResponse<UserAdminResponse> listStaffPaged(
            String search,
            Role role,
            UserStatus status,
            String branch,
            Pageable pageable
    ) {
        Role effectiveRole = role;
        if (effectiveRole != null && effectiveRole != Role.STAFF && effectiveRole != Role.DRIVER) {
            throw new IllegalArgumentException("Only STAFF or DRIVER roles can be filtered.");
        }

        Page<User> page = userRepository.findInternalUsersPaged(
                List.of(Role.STAFF, Role.DRIVER),
                effectiveRole,
                status,
                blankToNull(branch),
                blankToNull(search),
                pageable
        );
        Page<UserAdminResponse> mapped = page.map(this::toResponse);
        return PagedResponse.from(mapped);
    }

    @Transactional(dontRollbackOn = InviteDispatchException.class)
    public UserAdminResponse createStaff(CreateStaffRequest req) {
        String email = normalizeEmail(req.email());
        if (email.isBlank()) throw new IllegalArgumentException("Email is required.");
        User existing = userRepository.findByEmail(email).orElse(null);
        if (existing != null) {
            if ((existing.getRole() == Role.STAFF || existing.getRole() == Role.DRIVER)
                    && existing.getStatus() == UserStatus.PENDING) {
                resendInvite(existing.getId());
                return toResponse(userRepository.findById(existing.getId()).orElse(existing));
            }
            throw new IllegalStateException("User already exists.");
        }
        if (!firebaseIdentityService.isEnabled()) throw new IllegalStateException("Firebase Auth is not configured.");

        Role role = normalizeInternalRole(req.role());
        String branch = blankToNull(req.branch());
        if (branch == null) {
            throw new IllegalArgumentException("Branch is required for staff and driver accounts.");
        }

        LocalDateTime now = LocalDateTime.now();
        User actor = currentUserOrNull();

        // Create Firebase user without requiring admin-provided password.
        var firebaseUser = firebaseIdentityService.createInvitationUser(email, req.fullName().trim());

        User internalUser = User.builder()
                .firebaseUid(firebaseUser.getUid())
                .email(email)
                .fullName(req.fullName().trim())
                .passwordHash(FIREBASE_MANAGED_PASSWORD_MARKER)
                .role(role)
                .status(UserStatus.PENDING)
                .enabled(false)
                .verifiedAt(null)
                .createdAt(now)
                .updatedAt(now)
                .branch(branch)
                .branchId(null)
                .invitedBy(actor == null ? null : actor.getId())
                .invitedAt(now)
                .activatedAt(null)
                .deactivatedAt(null)
                .lastLoginAt(null)
                .mustChangePassword(false)
                .provider(AuthProvider.LOCAL)
                .mobileNumber(blankToNull(req.mobileNumber()))
                .build();

        User saved = userRepository.save(internalUser);
        staffAuditService.logCreateStaff(actor, saved);
        firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));
        try {
            staffInvitationService.createAndSendInvitation(saved);
        } catch (InviteDispatchException ex) {
            throw new InviteDispatchException(
                    "User was created, but invite email could not be sent. Use Resend Invite from the user list."
            );
        }

        return toResponse(saved);
    }

    @Transactional
    public UserAdminResponse updateStaff(Long id, UpdateStaffRequest req) {
        User u = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found."));

        if (!(u.getRole() == Role.STAFF || u.getRole() == Role.DRIVER)) {
            throw new IllegalArgumentException("You can only edit internal accounts here.");
        }

        String email = normalizeEmail(req.email());
        if (email.isBlank()) throw new IllegalArgumentException("Email is required.");

        userRepository.findByEmail(email).ifPresent(existing -> {
            if (!existing.getId().equals(u.getId())) {
                throw new IllegalArgumentException("Email is already in use.");
            }
        });

        u.setFullName(req.fullName().trim());
        u.setEmail(email);
        u.setBranch(blankToNull(req.branch()));
        if (req.enabled()) {
            if (u.getStatus() == UserStatus.PENDING) {
                u.setStatus(UserStatus.PENDING);
            } else {
                u.setStatus(UserStatus.ACTIVE);
                u.setActivatedAt(u.getActivatedAt() == null ? LocalDateTime.now() : u.getActivatedAt());
            }
        } else {
            u.setStatus(UserStatus.DEACTIVATED);
            u.setDeactivatedAt(LocalDateTime.now());
        }
        u.syncEnabledFromStatus();

        User saved = userRepository.save(u);
        firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));
        return toResponse(saved);
    }

    @Transactional
    public void resetStaffPassword(Long id, String ignoredNewPassword) {
        resendInvite(id);
    }

    @Transactional
    public void resendInvite(Long id) {
        User u = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found."));
        if (!(u.getRole() == Role.STAFF || u.getRole() == Role.DRIVER)) {
            throw new IllegalArgumentException("You can only resend invites for staff or driver accounts.");
        }
        u.setInvitedAt(LocalDateTime.now());
        u.setStatus(UserStatus.PENDING);
        u.setMustChangePassword(false);
        u.syncEnabledFromStatus();
        User saved = userRepository.save(u);
        firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));
        staffInvitationService.createAndSendInvitation(saved);
    }

    @Transactional
    public void suspendAccount(Long id) {
        updateAccountStatus(id, UserStatus.SUSPENDED);
    }

    @Transactional
    public void reactivateAccount(Long id) {
        updateAccountStatus(id, UserStatus.ACTIVE);
    }

    @Transactional
    public void deactivateAccount(Long id) {
        updateAccountStatus(id, UserStatus.DEACTIVATED);
    }

    @Transactional
    public void deleteStaff(Long id) {
        User staff = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found."));
        if (!(staff.getRole() == Role.STAFF || staff.getRole() == Role.DRIVER)) {
            throw new IllegalArgumentException("You can only delete internal accounts here.");
        }

        User actor = currentUserOrNull();
        staffAuditService.logDeleteStaff(actor, staff);
        userRepository.delete(staff);
        firestoreSyncService.delete("users", String.valueOf(staff.getId()));
    }

    private void updateAccountStatus(Long id, UserStatus status) {
        User user = userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found."));
        if (status == UserStatus.SUSPENDED && user.getStatus() == UserStatus.DEACTIVATED) {
            throw new IllegalArgumentException("Deactivated accounts must be reactivated before suspension.");
        }

        user.setStatus(status);
        if (status == UserStatus.ACTIVE) {
            user.setActivatedAt(user.getActivatedAt() == null ? LocalDateTime.now() : user.getActivatedAt());
            user.setDeactivatedAt(null);
        }
        if (status == UserStatus.SUSPENDED) {
            user.setDeactivatedAt(null);
        }
        if (status == UserStatus.DEACTIVATED) {
            user.setDeactivatedAt(user.getDeactivatedAt() == null ? LocalDateTime.now() : user.getDeactivatedAt());
        }
        user.syncEnabledFromStatus();
        User saved = userRepository.save(user);
        firestoreSyncService.upsert("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));
    }

    private List<UserAdminResponse> listInternalFromMysql() {
        return userRepository.findByRoleIn(List.of(Role.STAFF, Role.DRIVER)).stream()
                .map(this::toResponse)
                .sorted(Comparator.comparing(UserAdminResponse::createdAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private List<UserAdminResponse> listInternalFromFirestore() {
        return firestoreReadService.listUsers().stream()
                .filter(u -> "STAFF".equalsIgnoreCase(u.role()) || "DRIVER".equalsIgnoreCase(u.role()))
                .map(this::toResponse)
                .sorted(Comparator.comparing(UserAdminResponse::createdAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private User currentUserOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthUserDetails details)) return null;
        return details.getUser();
    }

    private UserAdminResponse toResponse(User u) {
        return new UserAdminResponse(
                u.getId(),
                u.getEmail(),
                u.getFullName(),
                u.getRole(),
                u.getStatus(),
                u.getBranch(),
                u.getBranchId(),
                u.getInvitedAt(),
                u.getActivatedAt(),
                u.getCreatedAt(),
                u.isMustChangePassword(),
                u.getMobileNumber()
        );
    }

    private UserAdminResponse toResponse(FirestoreReadService.FirestoreUserRecord u) {
        Role role = parseRole(u.role());
        UserStatus status = Boolean.TRUE.equals(u.enabled()) ? UserStatus.ACTIVE : UserStatus.PENDING;
        return new UserAdminResponse(
                u.id(),
                u.email(),
                u.fullName(),
                role,
                status,
                u.branch(),
                null,
                null,
                u.verifiedAt(),
                u.createdAt(),
                Boolean.TRUE.equals(u.mustChangePassword()),
                null
        );
    }

    private Role normalizeInternalRole(Role role) {
        Role normalized = role == null ? Role.STAFF : role;
        if (normalized != Role.STAFF && normalized != Role.DRIVER) {
            throw new IllegalArgumentException("Only STAFF or DRIVER roles are allowed for internal invites.");
        }
        return normalized;
    }

    private Role parseRole(String value) {
        try {
            return Role.valueOf(value);
        } catch (Exception ex) {
            return Role.STAFF;
        }
    }

    private String normalizeEmail(String email) {
        return (email == null) ? "" : email.trim().toLowerCase();
    }

    private String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
