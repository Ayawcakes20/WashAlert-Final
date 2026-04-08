package com.washalert.washalertbackend.delivery;

import com.washalert.washalertbackend.delivery.dto.CreateDeliveryRequest;
import com.washalert.washalertbackend.delivery.dto.DeliveryResponse;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryAssignmentRequest;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryLocationRequest;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryStatusRequest;
import com.washalert.washalertbackend.security.AuthUserDetails;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public DeliveryResponse updateLocation(
            @PathVariable Long deliveryId,
            @Valid @RequestBody UpdateDeliveryLocationRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return deliveryService.updateLocation(deliveryId, req, principal);
    }
}
