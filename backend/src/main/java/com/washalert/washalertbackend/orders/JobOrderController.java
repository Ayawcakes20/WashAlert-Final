package com.washalert.washalertbackend.orders;

import com.washalert.washalertbackend.orders.dto.CreateJobOrderRequest;
import com.washalert.washalertbackend.orders.dto.DashboardSummaryResponse;
import com.washalert.washalertbackend.orders.dto.EditJobOrderRequest;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.orders.dto.OrderTrackingResponse;
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
}
