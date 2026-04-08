package com.washalert.washalertbackend.booking;

import com.washalert.washalertbackend.booking.dto.BookingSlotResponse;
import com.washalert.washalertbackend.booking.dto.CreateBookingRequest;
import com.washalert.washalertbackend.booking.dto.EstimatePriceRequest;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
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

    public BookingController(BookingService bookingService, PricingService pricingService) {
        this.bookingService = bookingService;
        this.pricingService = pricingService;
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
}
