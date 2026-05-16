package com.washalert.washalertbackend.orders;

import com.washalert.washalertbackend.orders.dto.CreateJobOrderRequest;
import com.washalert.washalertbackend.orders.dto.DashboardSummaryResponse;
import com.washalert.washalertbackend.orders.dto.AssignDriverRequest;
import com.washalert.washalertbackend.orders.dto.DriverConfirmDeliveryRequest;
import com.washalert.washalertbackend.orders.dto.DriverDeliveryFailedRequest;
import com.washalert.washalertbackend.orders.dto.EditJobOrderRequest;
import com.washalert.washalertbackend.orders.dto.FeedbackRequest;
import com.washalert.washalertbackend.orders.dto.FeedbackResponse;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.orders.dto.OrderTrackingResponse;
import com.washalert.washalertbackend.orders.dto.RescheduleOrderRequest;
import com.washalert.washalertbackend.orders.dto.SetPriceRequest;
import com.washalert.washalertbackend.orders.dto.StaffNoteRequest;
import com.washalert.washalertbackend.orders.dto.UpdateJobOrderRequest;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.common.dto.PagedResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class JobOrderController {

    private final JobOrderService service;

    public JobOrderController(JobOrderService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<JobOrderResponse> listAll(@AuthenticationPrincipal AuthUserDetails principal) {
        return service.listAll(principal);
    }

    @GetMapping("/paged")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public PagedResponse<JobOrderResponse> listPaged(
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @AuthenticationPrincipal AuthUserDetails principal,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return service.listPaged(
                principal,
                branch,
                status,
                search,
                paymentStatus,
                paymentMethod,
                fromDate,
                toDate,
                pageable
        );
    }

    @PostMapping("/my/{trackingNumber}/cancel")
    @PreAuthorize("hasRole('CUSTOMER')")
    public JobOrderResponse cancelMyOrder(
            @PathVariable String trackingNumber,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.cancelMyOrder(trackingNumber, principal);
    }

    @PostMapping("/my/{trackingNumber}/reject-price")
    @PreAuthorize("hasRole('CUSTOMER')")
    public JobOrderResponse rejectPrice(
            @PathVariable String trackingNumber,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.cancelMyOrder(trackingNumber, principal);
    }

    @PutMapping("/my/{trackingNumber}/reschedule")
    @PreAuthorize("hasRole('CUSTOMER')")
    public JobOrderResponse rescheduleMyOrder(
            @PathVariable String trackingNumber,
            @Valid @RequestBody RescheduleOrderRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.rescheduleMyOrder(trackingNumber, req, principal);
    }

    @GetMapping("/my/paged")
    @PreAuthorize("hasRole('CUSTOMER')")
    public PagedResponse<JobOrderResponse> listMyPaged(
            @RequestParam(required = false, defaultValue = "all") String status,
            @RequestParam(required = false) String search,
            @AuthenticationPrincipal AuthUserDetails principal,
            @PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return service.listMyPaged(principal, status, search, pageable);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse getById(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.getById(id, principal);
    }

    @GetMapping("/recent")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public List<JobOrderResponse> recent(@AuthenticationPrincipal AuthUserDetails principal) {
        return service.recent(principal);
    }

    @GetMapping("/track/{trackingNumber}")
    public OrderTrackingResponse track(@PathVariable String trackingNumber) {
        return service.trackByTrackingNumber(trackingNumber);
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public DashboardSummaryResponse summary(@AuthenticationPrincipal AuthUserDetails principal) {
        return service.summary(principal);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse create(
            @Valid @RequestBody CreateJobOrderRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.create(req, principal);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse update(
            @PathVariable Long id,
            @Valid @RequestBody EditJobOrderRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.update(id, req, principal);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse patchStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateJobOrderRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.updateStatus(id, req, principal);
    }

    // Backward-compatible alias for existing clients still sending PUT /status
    @PutMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse putStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateJobOrderRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.updateStatus(id, req, principal);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // Payment Verification — per approved Order Management module scope
    @PatchMapping("/{id}/pay")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse markAsPaid(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.markAsPaid(id, principal);
    }

    // ── PRICE CONFIRMATION FLOW ───────────────────────────────────────────────

    /**
     * Staff sets the actual weighed kg + confirmed price, then notifies the customer.
     * Advances order to AWAITING_PRICE_CONFIRMATION and fires FCM push.
     */
    @PutMapping("/{id}/set-actual-weight")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse setActualWeight(
            @PathVariable Long id,
            @Valid @RequestBody SetPriceRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.setActualWeight(id, req, principal);
    }

    // Backward-compatible alias
    @PostMapping("/{id}/set-price")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse setPrice(
            @PathVariable Long id,
            @Valid @RequestBody SetPriceRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.setActualWeight(id, req, principal);
    }

    /**
     * Customer confirms the price — advances order to WASHING.
     * Authenticated customers only (must own the order).
     */
    @PutMapping("/{id}/confirm-price")
    @PreAuthorize("hasRole('CUSTOMER')")
    public JobOrderResponse confirmPrice(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.confirmPrice(id, principal);
    }

    @PutMapping("/{id}/assign-pickup-rider")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse assignPickupRider(
            @PathVariable Long id,
            @Valid @RequestBody AssignDriverRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.assignPickupRider(id, req.driverId(), principal);
    }

    @PutMapping("/{id}/driver/start-pickup-leg")
    @PreAuthorize("hasRole('DRIVER')")
    public JobOrderResponse startPickupLeg(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.startPickupLeg(id, principal);
    }

    @PutMapping("/{id}/driver/confirm-laundry-collected")
    @PreAuthorize("hasRole('DRIVER')")
    public JobOrderResponse confirmLaundryCollected(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.confirmLaundryCollected(id, principal);
    }

    @PutMapping("/{id}/driver/confirm-arrived-at-branch")
    @PreAuthorize("hasRole('DRIVER')")
    public JobOrderResponse confirmArrivedAtBranch(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.confirmArrivedAtBranch(id, principal);
    }

    @PutMapping("/{id}/assign-delivery-rider")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public JobOrderResponse assignDeliveryRider(
            @PathVariable Long id,
            @Valid @RequestBody AssignDriverRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.assignDeliveryRider(id, req.driverId(), principal);
    }

    @PutMapping("/{id}/driver/start-delivery-leg")
    @PreAuthorize("hasRole('DRIVER')")
    public JobOrderResponse startDeliveryLeg(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.startDeliveryLeg(id, principal);
    }

    @PutMapping("/{id}/driver/confirm-delivery")
    @PreAuthorize("hasRole('DRIVER')")
    public JobOrderResponse confirmDelivery(
            @PathVariable Long id,
            @Valid @RequestBody DriverConfirmDeliveryRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.confirmDelivery(id, req.codCollected(), principal);
    }

    @GetMapping("/driver/tasks")
    @PreAuthorize("hasRole('DRIVER')")
    public PagedResponse<JobOrderResponse> listDriverTasks(
            @AuthenticationPrincipal AuthUserDetails principal,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return service.listDriverTasks(principal, pageable);
    }

    /**
     * Driver fetches a single assigned order by its numeric DB ID.
     * Only returns the order if it is actually assigned to the requesting driver.
     */
    @GetMapping("/driver/task/{id}")
    @PreAuthorize("hasRole('DRIVER')")
    public JobOrderResponse getDriverTaskById(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.getDriverTaskById(id, principal);
    }

    @PutMapping("/{id}/driver/location")
    @PreAuthorize("hasRole('DRIVER')")
    public JobOrderResponse updateDriverLocation(
            @PathVariable Long id,
            @RequestBody Map<String, Double> location,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.updateDriverLocation(id, location.get("latitude"), location.get("longitude"), principal);
    }

    @PostMapping("/my/{trackingNumber}/feedback")
    @PreAuthorize("hasRole('CUSTOMER')")
    public FeedbackResponse submitFeedback(
            @PathVariable String trackingNumber,
            @Valid @RequestBody FeedbackRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.submitFeedback(trackingNumber, req, principal);
    }

    @GetMapping("/my/{trackingNumber}/feedback")
    @PreAuthorize("hasRole('CUSTOMER')")
    public FeedbackResponse getMyFeedback(
            @PathVariable String trackingNumber,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.getFeedback(trackingNumber, principal);
    }

    @GetMapping("/feedback/{trackingNumber}")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public FeedbackResponse getOrderFeedback(
            @PathVariable String trackingNumber,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.getFeedback(trackingNumber, principal);
    }

    @PatchMapping("/feedback/{trackingNumber}/staff-note")
    @PreAuthorize("hasAnyRole('ADMIN','STAFF')")
    public FeedbackResponse submitStaffNote(
            @PathVariable String trackingNumber,
            @Valid @RequestBody StaffNoteRequest req,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return service.submitStaffNote(trackingNumber, req, principal);
    }
}
