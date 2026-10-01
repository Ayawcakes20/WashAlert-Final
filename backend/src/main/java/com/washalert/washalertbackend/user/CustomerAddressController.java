package com.washalert.washalertbackend.user;

import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.firebase.FirestoreUserPayloadFactory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerAddressController {

    private final UserRepository userRepository;
    private final FirestoreSyncService firestoreSyncService;

    public record CustomerAddressResponse(
            Long id,
            String fullName,
            String email,
            String mobileNumber,
            String address,
            String addressLine1,
            String addressLine2,
            String status,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    public record UpdateCustomerAddressRequest(
            @NotBlank(message = "Street address is required.")
            String address,
            String addressLine1,
            String addressLine2
    ) {}

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<List<CustomerAddressResponse>> searchCustomers(
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(required = false, defaultValue = "25") int limit
    ) {
        int size = Math.min(Math.max(1, limit), 50);
        String trimmedQuery = query != null ? query.trim() : "";
        List<User> customers = userRepository.searchCustomers(trimmedQuery, PageRequest.of(0, size));
        List<CustomerAddressResponse> responses = customers.stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(responses);
    }

    @PutMapping("/{id}/address")
    @PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")
    public ResponseEntity<CustomerAddressResponse> updateCustomerAddress(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCustomerAddressRequest req
    ) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Customer not found with ID: " + id));

        if (user.getRole() != Role.CUSTOMER) {
            throw new IllegalArgumentException("Target user is not a customer.");
        }

        String addr = req.address().trim();
        String rawLine1 = req.addressLine1() != null ? req.addressLine1().trim() : "";
        String cleanLine1 = rawLine1.equalsIgnoreCase(addr) ? "" : rawLine1;
        String cleanLine2 = req.addressLine2() != null ? req.addressLine2().trim() : "";

        user.setAddress(addr);
        user.setAddressLine1(cleanLine1.isBlank() ? null : cleanLine1);
        user.setAddressLine2(cleanLine2.isBlank() ? null : cleanLine2);

        User saved = userRepository.save(user);

        try {
            firestoreSyncService.upsertBlocking("users", String.valueOf(saved.getId()), FirestoreUserPayloadFactory.fromUser(saved));
        } catch (Exception ex) {
            log.warn("[CUSTOMER][ADDRESS] Failed to sync to Firestore for customer id={}: {}", saved.getId(), ex.getMessage());
        }

        log.info("[CUSTOMER][ADDRESS] Successfully updated address for customer id={} (email={})", saved.getId(), saved.getEmail());
        return ResponseEntity.ok(toResponse(saved));
    }

    private CustomerAddressResponse toResponse(User u) {
        return new CustomerAddressResponse(
                u.getId(),
                u.getFullName(),
                u.getEmail(),
                u.getMobileNumber(),
                u.getAddress(),
                u.getAddressLine1(),
                u.getAddressLine2(),
                u.getStatus() != null ? u.getStatus().name() : "ACTIVE",
                u.getCreatedAt(),
                u.getUpdatedAt()
        );
    }
}
