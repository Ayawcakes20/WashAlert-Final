package com.washalert.washalertbackend.booking;

import com.washalert.washalertbackend.booking.dto.BookingSlotResponse;
import com.washalert.washalertbackend.booking.dto.CreateBookingRequest;
import com.washalert.washalertbackend.booking.dto.EstimatePriceRequest;
import com.washalert.washalertbackend.inventory.InventoryService;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.washalert.washalertbackend.security.AuthUserDetails;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;
    private final PricingService pricingService;
    private final InventoryService inventoryService;

    public BookingController(BookingService bookingService, PricingService pricingService,
                             InventoryService inventoryService) {
        this.bookingService = bookingService;
        this.pricingService = pricingService;
        this.inventoryService = inventoryService;
    }

    // Request/response records for the supply availability check endpoint
    public record CheckSuppliesRequest(
            String branch,
            String detergent,
            Integer detergentQuantity,
            String conditioner,
            Integer conditionerQuantity
    ) {}

    public record CheckSuppliesResponse(boolean available, String message) {}

    // Returns per-item availability for all customer-selectable supplies at the given branch.
    // No auth required, no stock deducted. Used to render unavailable badges on Extras page.
    @GetMapping("/supplies-availability")
    public InventoryService.SuppliesAvailability getSuppliesAvailability(
            @RequestParam String branch
    ) {
        return inventoryService.getSuppliesAvailability(branch);
    }

    @GetMapping("/slots")
    public List<BookingSlotResponse> getAvailableSlots(
            @RequestParam String branch,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return bookingService.getAvailableSlots(branch, date);
    }

    @PostMapping
    public JobOrderResponse createBooking(@Valid @RequestBody CreateBookingRequest req) {
        return bookingService.createBooking(req);
    }

    @PostMapping("/estimate")
    public PricingService.PriceEstimation estimate(@Valid @RequestBody EstimatePriceRequest req) {
        return pricingService.estimate(
                req.branch(),
                req.serviceName(),
                req.weightKg(),
                req.isRush(),
                req.detergent(),
                req.fabcon(),
                req.distanceKm()
        );
    }

    @PatchMapping("/{id}/cancel")
    public JobOrderResponse cancelBooking(
            @PathVariable Long id,
            @AuthenticationPrincipal AuthUserDetails principal
    ) {
        return bookingService.cancelBooking(id, principal);
    }

    // Safe, customer-accessible supply availability check — no auth required, no stock deducted.
    // Returns { available: true } or HTTP 400 with { available: false, message: "..." }.
    @PostMapping("/check-supplies")
    public ResponseEntity<CheckSuppliesResponse> checkSupplies(
            @RequestBody CheckSuppliesRequest req
    ) {
        try {
            inventoryService.validateSuppliesForBooking(
                    req.branch(),
                    req.detergent(),
                    req.conditioner(),
                    req.detergentQuantity() != null ? req.detergentQuantity() : 0,
                    req.conditionerQuantity() != null ? req.conditionerQuantity() : 0
            );
            return ResponseEntity.ok(new CheckSuppliesResponse(true, null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new CheckSuppliesResponse(false, e.getMessage()));
        }
    }
}
