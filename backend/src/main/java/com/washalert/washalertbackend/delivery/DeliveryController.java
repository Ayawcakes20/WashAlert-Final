package com.washalert.washalertbackend.delivery;

import com.washalert.washalertbackend.delivery.dto.BranchHandoverRequest;
import com.washalert.washalertbackend.delivery.dto.CreateDeliveryRequest;
import com.washalert.washalertbackend.delivery.dto.DeliveryResponse;
import com.washalert.washalertbackend.delivery.dto.DriverAvailableOrderResponse;
import com.washalert.washalertbackend.delivery.dto.FinalHandoverRequest;
import com.washalert.washalertbackend.delivery.dto.PickupCompleteRequest;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryAssignmentRequest;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryLocationRequest;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryStatusRequest;
import com.washalert.washalertbackend.delivery.dto.UploadDeliveryProofRequest;
import com.washalert.washalertbackend.common.dto.PagedResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/deliveries")
public class DeliveryController {

    private final DeliveryService deliveryService;

    public DeliveryController(DeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public DeliveryResponse assign(
            @Valid @RequestBody CreateDeliveryRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.assign(req, principal);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<DeliveryResponse> list(
            @RequestParam(required = false) String branch,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.list(branch, principal);
    }

    @GetMapping("/paged")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public PagedResponse<DeliveryResponse> listPaged(
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @AuthenticationPrincipal AuthUserDetails principal,
            @PageableDefault(size = 10, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return deliveryService.listPaged(branch, status, search, principal, pageable);
    }

    @GetMapping("/{deliveryId}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','DRIVER')")
    public DeliveryResponse getById(
            @PathVariable Long deliveryId,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.getById(deliveryId, principal);
    }

    @GetMapping("/track/{trackingNumber}")
    public DeliveryResponse track(@PathVariable String trackingNumber) {
        return deliveryService.trackByTrackingNumber(trackingNumber);
    }

    @PutMapping("/{deliveryId}/status")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','DRIVER')")
    public DeliveryResponse updateStatus(
            @PathVariable Long deliveryId,
            @Valid @RequestBody UpdateDeliveryStatusRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.updateStatus(deliveryId, req, principal);
    }

    /** Driver-facing — returns only deliveries assigned to the calling driver. */
    @GetMapping("/my")
    @PreAuthorize("hasRole('DRIVER')")
    public List<DeliveryResponse> listMy(@AuthenticationPrincipal AuthUserDetails principal) {
        return deliveryService.listMy(principal);
    }

    @GetMapping("/my/paged")
    @PreAuthorize("hasRole('DRIVER')")
    public PagedResponse<DeliveryResponse> listMyPaged(
            @RequestParam(required = false, defaultValue = "all") String status,
            @AuthenticationPrincipal AuthUserDetails principal,
            @PageableDefault(size = 10, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return deliveryService.listMyPaged(principal, status, pageable);
    }

    @GetMapping("/available")
    @PreAuthorize("hasRole('DRIVER')")
    public List<DriverAvailableOrderResponse> listAvailable(@AuthenticationPrincipal AuthUserDetails principal) {
        return deliveryService.listAvailableForDriver(principal);
    }

    @PostMapping("/accept/{trackingNumber}")
    @PreAuthorize("hasRole('DRIVER')")
    public DeliveryResponse accept(
            @PathVariable String trackingNumber,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.acceptPendingBooking(trackingNumber, principal);
    }

    @PutMapping("/{deliveryId}/assign-rider")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public DeliveryResponse updateAssignment(
            @PathVariable Long deliveryId,
            @Valid @RequestBody UpdateDeliveryAssignmentRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.updateAssignment(deliveryId, req, principal);
    }

    @PutMapping("/{deliveryId}/location")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','DRIVER')")
    public DeliveryResponse updateLocation(
            @PathVariable Long deliveryId,
            @Valid @RequestBody UpdateDeliveryLocationRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.updateLocation(deliveryId, req, principal);
    }

    @PutMapping("/{deliveryId}/proof")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','DRIVER')")
    public DeliveryResponse uploadProof(
            @PathVariable Long deliveryId,
            @Valid @RequestBody UploadDeliveryProofRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.uploadProof(deliveryId, req, principal);
    }

    @PatchMapping("/{deliveryId}/collect-cod")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','DRIVER')")
    public DeliveryResponse collectCodPayment(
            @PathVariable Long deliveryId,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.collectCodPayment(deliveryId, principal);
    }

    // ── State Machine Action Endpoints ────────────────────────────────────────

    /** Phase A: Driver swipes "Arrive" at customer. ASSIGNED_PICKUP → ARRIVED_CUSTOMER */
    @PostMapping("/{deliveryId}/arrive-customer")
    @PreAuthorize("hasRole('DRIVER')")
    public DeliveryResponse arriveAtCustomer(
            @PathVariable Long deliveryId,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.arriveAtCustomer(deliveryId, principal);
    }

    /** Phase A: Driver verifies bag count + photo. ARRIVED_CUSTOMER → PICKED_UP */
    @PostMapping("/{deliveryId}/pickup-complete")
    @PreAuthorize("hasRole('DRIVER')")
    public DeliveryResponse completePickup(
            @PathVariable Long deliveryId,
            @Valid @RequestBody PickupCompleteRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.completePickup(deliveryId, req, principal);
    }

    /** Phase A: Driver swipes "Arrived at Branch". PICKED_UP → ARRIVED_BRANCH */
    @PostMapping("/{deliveryId}/arrive-branch")
    @PreAuthorize("hasRole('DRIVER')")
    public DeliveryResponse arriveAtBranch(
            @PathVariable Long deliveryId,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.arriveAtBranch(deliveryId, principal);
    }

    /** Phase A: Driver uploads handover photo. ARRIVED_BRANCH → HANDED_TO_BRANCH */
    @PostMapping("/{deliveryId}/branch-handover")
    @PreAuthorize("hasRole('DRIVER')")
    public DeliveryResponse branchHandover(
            @PathVariable Long deliveryId,
            @Valid @RequestBody BranchHandoverRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.branchHandover(deliveryId, req, principal);
    }

    /** Phase B: Driver accepts from pool. ASSIGNED_DELIVERY → OUT_FOR_DELIVERY */
    @PostMapping("/{deliveryId}/start-delivery")
    @PreAuthorize("hasRole('DRIVER')")
    public DeliveryResponse startDelivery(
            @PathVariable Long deliveryId,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.startDelivery(deliveryId, principal);
    }

    /** Phase B: Driver swipes "Arrived" at customer for return. OUT_FOR_DELIVERY → ARRIVED_DELIVERY */
    @PostMapping("/{deliveryId}/arrive-delivery")
    @PreAuthorize("hasRole('DRIVER')")
    public DeliveryResponse arriveForDelivery(
            @PathVariable Long deliveryId,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.arriveForDelivery(deliveryId, principal);
    }

    @PostMapping("/{deliveryId}/resend-confirmation-code")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF','DRIVER')")
    public DeliveryResponse resendConfirmationCode(
            @PathVariable Long deliveryId,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.resendConfirmationCode(deliveryId, principal);
    }

    /** Phase B: Driver confirms code + photo. ARRIVED_DELIVERY → DELIVERED */
    @PostMapping("/{deliveryId}/final-handover")
    @PreAuthorize("hasRole('DRIVER')")
    public DeliveryResponse finalHandover(
            @PathVariable Long deliveryId,
            @Valid @RequestBody FinalHandoverRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.finalHandover(deliveryId, req, principal);
    }
}
