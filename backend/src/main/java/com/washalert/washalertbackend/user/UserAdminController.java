package com.washalert.washalertbackend.user;

import com.washalert.washalertbackend.user.dto.CreateStaffRequest;
import com.washalert.washalertbackend.user.dto.UpdateStaffRequest;
import com.washalert.washalertbackend.user.dto.UserAdminResponse;
import com.washalert.washalertbackend.common.dto.PagedResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
public class UserAdminController {

    private final UserAdminService userAdminService;

    public UserAdminController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    // ✅ Explicit STAFF collection
    @GetMapping("/staff")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UserAdminResponse> listStaff() {
        return userAdminService.listStaff();
    }

    @GetMapping("/staff/paged")
    @PreAuthorize("hasRole('ADMIN')")
    public PagedResponse<UserAdminResponse> listStaffPaged(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Role role,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(required = false) String branch,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return userAdminService.listStaffPaged(search, role, status, branch, pageable);
    }

    // ✅ Drivers list — used by web "Assign Driver" dialog; filter by branch when provided
    @GetMapping("/drivers")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public List<UserAdminResponse> listDrivers(@RequestParam(required = false) String branch) {
        return userAdminService.listDrivers(branch);
    }

    @PostMapping("/staff")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public UserAdminResponse createStaff(@Valid @RequestBody CreateStaffRequest req) {
        return userAdminService.createStaff(req);
    }

    @PutMapping("/staff/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserAdminResponse updateStaff(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStaffRequest req
    ) {
        return userAdminService.updateStaff(id, req);
    }

    // ✅ Request DTO kept inside controller (fine for your setup)
    public record AdminResetStaffPasswordRequest(
            @NotBlank(message = "Password is required.")
            @Size(min = 8, max = 64, message = "Password must be 8-64 characters.")
            String newPassword
    ) {}

    // ✅ Better semantics: update password
    @PutMapping("/staff/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void resetStaffPassword(
            @PathVariable Long id,
            @Valid @RequestBody AdminResetStaffPasswordRequest req
    ) {
        userAdminService.resetStaffPassword(id, req.newPassword());
    }

    @PostMapping("/staff/{id}/resend-invite")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void resendInvite(@PathVariable Long id) {
        userAdminService.resendInvite(id);
    }

    public record UpdateStaffStatusRequest(@NotBlank String status) {}

    @PatchMapping("/staff/{id}/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateStaffStatusRequest req) {
        String normalized = req.status().trim().toUpperCase();
        switch (normalized) {
            case "SUSPENDED" -> userAdminService.suspendAccount(id);
            case "ACTIVE" -> userAdminService.reactivateAccount(id);
            case "DEACTIVATED" -> userAdminService.deactivateAccount(id);
            default -> throw new IllegalArgumentException("Unsupported status. Use ACTIVE, SUSPENDED, or DEACTIVATED.");
        }
    }

    @DeleteMapping("/staff/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void deleteStaff(@PathVariable Long id) {
        userAdminService.deleteStaff(id);
    }
}
