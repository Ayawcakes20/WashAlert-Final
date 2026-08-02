package com.washalert.washalertbackend.booking;

import com.washalert.washalertbackend.booking.dto.BookingSlotResponse;
import com.washalert.washalertbackend.booking.dto.CreateBookingRequest;
import com.washalert.washalertbackend.delivery.DeliveryLeg;
import com.washalert.washalertbackend.delivery.DeliveryOrderRepository;
import com.washalert.washalertbackend.machines.MachineRepository;
import com.washalert.washalertbackend.machines.MachineStatus;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.JobOrderTimelineService;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.inventory.InventoryService;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.user.Role;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class BookingService {
    private static final BigDecimal MACHINE_ABSOLUTE_MAX_LOAD_KG = new BigDecimal("9.0");
    private static final BigDecimal PURE_CLOTHES_MAX_LOAD_KG = new BigDecimal("8.0");
    private static final BigDecimal BULKY_ITEMS_MAX_LOAD_KG = new BigDecimal("7.0");
    private static final BigDecimal MIN_LOAD_KG = new BigDecimal("5.0");
    private static final Pattern SERVICE_KG_LIMIT_PATTERN = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*kg", Pattern.CASE_INSENSITIVE);

    private final JobOrderRepository jobOrderRepository;
    private final MachineRepository machineRepository;
    private final BookingProperties bookingProperties;
    private final DeliveryOrderRepository deliveryOrderRepository;
    private final JobOrderTimelineService timelineService;
    private final NotificationService notificationService;
    private final PricingService pricingService;
    private final InventoryService inventoryService;

    public BookingService(
            JobOrderRepository jobOrderRepository,
            MachineRepository machineRepository,
            BookingProperties bookingProperties,
            DeliveryOrderRepository deliveryOrderRepository,
            JobOrderTimelineService timelineService,
            NotificationService notificationService,
            PricingService pricingService,
            InventoryService inventoryService
    ) {
        this.jobOrderRepository = jobOrderRepository;
        this.machineRepository = machineRepository;
        this.bookingProperties = bookingProperties;
        this.deliveryOrderRepository = deliveryOrderRepository;
        this.timelineService = timelineService;
        this.notificationService = notificationService;
        this.pricingService = pricingService;
        this.inventoryService = inventoryService;
    }

    public List<BookingSlotResponse> getAvailableSlots(String branch, LocalDate date) {
        String cleanBranch = normalizeBranch(branch);
        LocalDate targetDate = (date == null) ? LocalDate.now() : date;
        validateDate(targetDate);

        long capacity = machineRepository.countByNormalizedBranchAndStatusNot(cleanBranch, MachineStatus.MAINTENANCE);
        if (capacity <= 0) {
            throw new IllegalArgumentException("No active machines found for the selected branch.");
        }

        LocalTime opening = LocalTime.of(bookingProperties.getOpenHour(), 0);
        LocalTime closing = LocalTime.of(bookingProperties.getCloseHour(), 0);
        int slotMinutes = bookingProperties.getSlotMinutes();

        if (!opening.isBefore(closing) || slotMinutes <= 0) {
            throw new IllegalStateException("Invalid booking slot configuration.");
        }

        List<BookingSlotResponse> slots = new ArrayList<>();
        for (LocalTime cursor = opening; !cursor.plusMinutes(slotMinutes).isAfter(closing); cursor = cursor.plusMinutes(slotMinutes)) {
            LocalTime slotStart = cursor;
            LocalTime slotEnd = cursor.plusMinutes(slotMinutes);

            long booked = jobOrderRepository.countByNormalizedBranchAndBookingDateAndSlotStartTime(cleanBranch, targetDate, slotStart);
            long remaining = Math.max(capacity - booked, 0);

            slots.add(new BookingSlotResponse(
                    targetDate,
                    slotStart,
                    slotEnd,
                    capacity,
                    booked,
                    remaining,
                    remaining > 0
            ));
        }

        return slots;
    }

    @Transactional
    public JobOrderResponse createBooking(CreateBookingRequest req) {
        String cleanBranch = normalizeBranch(req.branch());
        String paymentMethod = normalizePaymentMethod(req.paymentMethod());
        String customerPhone = trimToNull(req.customerPhone());
        validateDate(req.preferredDate());
        validateLoadSize(req.serviceName(), req.estimatedWeightKg(), req.containsBulkyItems());

        if (customerPhone == null) {
            throw new IllegalArgumentException("Customer phone is required. Please update your profile before booking.");
        }

        if (req.serviceType() == ServiceType.PICKUP_DELIVERY
                && (req.deliveryAddress() == null || req.deliveryAddress().isBlank())) {
            throw new IllegalArgumentException("Delivery address is required for pickup and delivery.");
        }

        LocalTime slotStart = req.preferredSlotStartTime();
        LocalTime slotEnd = slotStart.plusMinutes(bookingProperties.getSlotMinutes());
        validateSlotTime(slotStart, slotEnd);

        // Reject if the selected slot has already passed for today's date.
        if (req.preferredDate().isEqual(LocalDate.now()) && slotStart.isBefore(LocalTime.now())) {
            throw new IllegalArgumentException(
                    "This time slot has already passed. Please choose another schedule.");
        }

        // Duplicate detection: if the same customer has an identical pending booking for this
        // branch/date/slot submitted within the last 60 seconds, return a friendly message instead
        // of creating a duplicate.
        String normEmail = trimToNull(req.customerEmail());
        if (normEmail != null) {
            LocalDateTime since = LocalDateTime.now().minusSeconds(60);
            List<JobOrder> recentDups = jobOrderRepository
                    .findByCustomerEmailAndNormalizedBranchAndBookingDateAndSlotStartTimeAndStatusAndCreatedAtAfter(
                            normEmail, cleanBranch, req.preferredDate(), slotStart, JobOrderStatus.PENDING, since);
            if (!recentDups.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "A booking for this slot was just submitted. Check your Orders tab — your booking is already confirmed.");
            }
        }

        // Lock branch machines to serialize booking writes and prevent slot overbooking races.
        var lockedMachines = machineRepository.lockByBranch(cleanBranch);
        long capacity = lockedMachines.stream()
                .filter(m -> m.getStatus() != MachineStatus.MAINTENANCE)
                .count();
        if (capacity <= 0) {
            throw new IllegalArgumentException("No active machines found for the selected branch.");
        }

        long booked = jobOrderRepository.countByNormalizedBranchAndBookingDateAndSlotStartTime(cleanBranch, req.preferredDate(), slotStart);
        if (booked >= capacity) {
            throw new IllegalArgumentException("Selected time slot is already full. Please choose another slot.");
        }

        // Never trust a client-supplied distance when we can compute it ourselves from the
        // branch/delivery coordinates captured during address selection — this closes the
        // "distanceKm: 0" free-delivery tamper. Only fall back to the client value when
        // coordinates are unavailable (e.g. drop-off orders with no delivery leg).
        BigDecimal effectiveDistanceKm = resolveDistanceKm(req);

        var est = pricingService.estimate(
                cleanBranch,
                req.serviceName(),
                req.estimatedWeightKg(),
                req.isRush(),
                req.detergentPreference(),
                req.fabricConditionerPreference(),
                effectiveDistanceKm
        );

        // Reject tampered add-on quantities before any fallback logic runs.
        pricingService.validateAddonQuantities(
                req.serviceName(),
                req.estimatedWeightKg(),
                req.detergentPreference(),
                req.detergentQuantity() != null ? req.detergentQuantity() : 0,
                req.fabricConditionerPreference(),
                req.conditionerQuantity() != null ? req.conditionerQuantity() : 0
        );

        int computedLoads = est.numberOfLoads();
        // Only default quantity to computedLoads for actual shop supplies.
        // Customer Provided / None must store qty=0 — no shop inventory involved.
        boolean detIsShop = pricingService.isShopSupply(req.detergentPreference());
        boolean conIsShop = pricingService.isShopSupply(req.fabricConditionerPreference());
        int detQty = detIsShop
                ? (req.detergentQuantity() != null && req.detergentQuantity() > 0 ? req.detergentQuantity() : computedLoads)
                : 0;
        int conQty = conIsShop
                ? (req.conditionerQuantity() != null && req.conditionerQuantity() > 0 ? req.conditionerQuantity() : computedLoads)
                : 0;

        // Validate inventory availability before committing the booking.
        // Does NOT deduct stock — deduction happens when order reaches WASHING.
        inventoryService.validateSuppliesForBooking(
                cleanBranch,
                req.detergentPreference(),
                req.fabricConditionerPreference(),
                detQty,
                conQty
        );

        JobOrder order = JobOrder.builder()
                .trackingNumber("TMP-" + UUID.randomUUID())
                .customerName(req.customerName().trim())
                .branch(cleanBranch)
                .branchId(req.branchId())
                .customerPhone(customerPhone)
                .customerEmail(trimToNull(req.customerEmail()))
                .serviceType(req.serviceType())
                .deliveryAddress(trimToNull(req.deliveryAddress()))
                .deliveryUnitFloor(trimToNull(req.deliveryUnitFloor()))
                .deliveryContactName(trimToNull(req.deliveryContactName()))
                .deliveryContactPhone(trimToNull(req.deliveryContactPhone()))
                .deliveryLatitude(req.deliveryLatitude())
                .deliveryLongitude(req.deliveryLongitude())
                .branchLatitude(req.branchLatitude())
                .branchLongitude(req.branchLongitude())
                .bookingDate(req.preferredDate())
                .slotStartTime(slotStart)
                .slotEndTime(slotEnd)
                .detergentPreference(req.detergentPreference().trim())
                .detergentQuantity(detQty)
                .fabricConditionerPreference(req.fabricConditionerPreference().trim())
                .conditionerQuantity(conQty)
                .loadSize(req.loadSize())
                .estimatedWeightKg(req.estimatedWeightKg())
                .specialInstructions(buildSpecialInstructions(req.laundryType(), req.specialInstructions()))
                // Pricing is always server-computed. Any price fields the client sends in
                // CreateBookingRequest are display-only echoes and are never trusted here —
                // this closes a price-tampering hole where a client could set its own total.
                .servicePrice(est.servicePrice())
                .suppliesPrice(est.suppliesPrice())
                .rushPrice(est.rushPrice())
                .deliveryPrice(est.deliveryPrice())
                .totalPrice(est.totalPrice())
                .paymentMethod(paymentMethod)
                .serviceName(req.serviceName())
                .status(JobOrderStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        jobOrderRepository.saveAndFlush(order);
        order.setTrackingNumber(formatTrackingNumber(order.getId()));
        JobOrder saved = jobOrderRepository.save(order);
        inventoryService.deductAtBooking(saved);

        try {
            timelineService.log(saved, saved.getStatus(), "customer", "Booking created");
        } catch (Exception ex) {
            log.warn("[BookingService] Timeline log failed for {}: {}", saved.getTrackingNumber(), ex.getMessage());
        }

        try {
            notificationService.enqueueEmail(
                    saved.getCustomerEmail(),
                    "WashAlert Booking Confirmed",
                    "Your booking is confirmed.\nTracking Number: %s\nBranch: %s\nScheduled: %s %s"
                            .formatted(
                                    saved.getTrackingNumber(),
                                    saved.getBranch(),
                                    saved.getBookingDate(),
                                    saved.getSlotStartTime()
                            ),
                    "BOOKING",
                    String.valueOf(saved.getId())
            );
            notificationService.enqueuePushToUserEmail(
                    saved.getCustomerEmail(),
                    "Booking Confirmed",
                    "Your booking %s is confirmed for %s %s."
                            .formatted(saved.getTrackingNumber(), saved.getBookingDate(), saved.getSlotStartTime()),
                    "BOOKING_CONFIRMED",
                    saved.getTrackingNumber() + ":confirmed"
            );
            notificationService.enqueuePushToRoles(
                    List.of(Role.ADMIN, Role.STAFF),
                    saved.getBranch(),
                    "New Booking Received",
                    "Order %s was booked for branch %s."
                            .formatted(saved.getTrackingNumber(), saved.getBranch()),
                    "BOOKING_NEW",
                    saved.getTrackingNumber() + ":new"
            );
            if (saved.getServiceType() == ServiceType.PICKUP_DELIVERY) {
                notificationService.enqueuePushToRoles(
                        List.of(Role.DRIVER),
                        saved.getBranch(),
                        "New Booking Available",
                        "Order %s in %s is ready for driver acceptance."
                                .formatted(saved.getTrackingNumber(), saved.getBranch()),
                        "BOOKING_AVAILABLE_DRIVER",
                        saved.getTrackingNumber() + ":driver-pool"
                );
            }
        } catch (Exception ex) {
            log.warn("[BookingService] Notification enqueue failed for {}: {}", saved.getTrackingNumber(), ex.getMessage());
        }
        return toResponse(saved);
    }

    /**
     * Prefers a server-computed haversine distance from the branch/delivery coordinates
     * over the client-supplied {@code distanceKm}. Falls back to the client value only
     * when coordinates are not present (e.g. drop-off bookings with no delivery leg).
     */
    private BigDecimal resolveDistanceKm(CreateBookingRequest req) {
        if (req.branchLatitude() != null && req.branchLongitude() != null
                && req.deliveryLatitude() != null && req.deliveryLongitude() != null) {
            return haversineKm(
                    req.branchLatitude(), req.branchLongitude(),
                    req.deliveryLatitude(), req.deliveryLongitude()
            );
        }
        return req.distanceKm();
    }

    private BigDecimal haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double earthRadiusKm = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        double distanceKm = earthRadiusKm * c;
        return BigDecimal.valueOf(distanceKm).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private void validateDate(LocalDate date) {
        if (date.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Preferred date cannot be in the past.");
        }
    }

    private void validateSlotTime(LocalTime slotStart, LocalTime slotEnd) {
        LocalTime opening = LocalTime.of(bookingProperties.getOpenHour(), 0);
        LocalTime closing = LocalTime.of(bookingProperties.getCloseHour(), 0);

        if (slotStart.isBefore(opening) || slotEnd.isAfter(closing)) {
            throw new IllegalArgumentException("Selected slot is outside business hours.");
        }
    }

    private String normalizeBranch(String branch) {
        if (branch == null || branch.isBlank()) {
            throw new IllegalArgumentException("Branch is required.");
        }
        return branch.trim();
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizePaymentMethod(String rawPaymentMethod) {
        if (rawPaymentMethod == null || rawPaymentMethod.isBlank()) {
            throw new IllegalArgumentException("Payment method is required.");
        }

        String normalized = rawPaymentMethod
                .trim()
                .toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');

        if (normalized.contains("COD")) return "CASH";
        if (normalized.equals("CASH_ON_DELIVERY")) return "CASH";
        if (normalized.equals("CASH")) return "CASH";
        if (normalized.equals("GCASH")) return "GCASH";
        if (normalized.equals("MAYA")) return "MAYA";

        throw new IllegalArgumentException("Invalid payment method. Allowed values: GCASH, CASH, MAYA.");
    }

    private String formatTrackingNumber(Long id) {
        if (id == null) {
            throw new IllegalStateException("Booking ID was not generated.");
        }
        return "WA-" + (10000 + id);
    }

    private void validateLoadSize(String serviceName, BigDecimal weightKg, boolean containsBulkyItems) {
        if (weightKg == null) {
            throw new IllegalArgumentException("Estimated weight is required.");
        }

        if (weightKg.compareTo(MIN_LOAD_KG) < 0) {
            throw new IllegalArgumentException("Minimum load is 5 kg.");
        }

        if (weightKg.compareTo(MACHINE_ABSOLUTE_MAX_LOAD_KG) > 0) {
            throw new IllegalArgumentException("Machine limit is 9 kg per load.");
        }

        BigDecimal fabricTypeMaxKg = containsBulkyItems ? BULKY_ITEMS_MAX_LOAD_KG : PURE_CLOTHES_MAX_LOAD_KG;
        if (weightKg.compareTo(fabricTypeMaxKg) > 0) {
            String limitLabel = containsBulkyItems ? "Loads with towels/beddings are limited to 7 kg." : "Pure clothes loads are limited to 8 kg.";
            throw new IllegalArgumentException(limitLabel);
        }

        BigDecimal serviceMaxKg = resolveMaxLoadKg(serviceName);
        BigDecimal maxAllowedKg = serviceMaxKg.min(fabricTypeMaxKg).min(MACHINE_ABSOLUTE_MAX_LOAD_KG);
        if (weightKg.compareTo(maxAllowedKg) > 0) {
            throw new IllegalArgumentException(
                    "Selected service allows up to " + toWholeOrDecimal(maxAllowedKg) + " kg per load."
            );
        }
    }

    private BigDecimal resolveMaxLoadKg(String serviceName) {
        if (serviceName == null || serviceName.isBlank()) {
            return PURE_CLOTHES_MAX_LOAD_KG;
        }
        String normalized = serviceName.toLowerCase();
        if (normalized.contains("basic full")) {
            // Supports the approved "madness limit" +1kg on top of 8kg.
            return MACHINE_ABSOLUTE_MAX_LOAD_KG;
        }
        Matcher matcher = SERVICE_KG_LIMIT_PATTERN.matcher(serviceName);
        if (matcher.find()) {
            try {
                return new BigDecimal(matcher.group(1));
            } catch (NumberFormatException ignored) {
                // Fallback to default cap.
            }
        }
        return PURE_CLOTHES_MAX_LOAD_KG;
    }

    private String toWholeOrDecimal(BigDecimal value) {
        if (value == null) return "0";
        BigDecimal stripped = value.stripTrailingZeros();
        return stripped.scale() <= 0 ? stripped.toPlainString() : value.toPlainString();
    }

    @Transactional
    public JobOrderResponse cancelBooking(Long id, com.washalert.washalertbackend.security.AuthUserDetails principal) {
        JobOrder order = jobOrderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found."));

        String userRole = principal.getUser().getRole().name();
        String userEmail = principal.getUser().getEmail();

        boolean isStaffOrAdmin = userRole.equals("ADMIN") || userRole.equals("STAFF");
        boolean isOwner = order.getCustomerEmail().equals(userEmail);

        if (!isOwner && !isStaffOrAdmin) {
            throw new IllegalStateException("You are not authorized to cancel this booking.");
        }

        if (order.getStatus() != JobOrderStatus.PENDING) {
            throw new IllegalStateException("Only PENDING bookings can be cancelled.");
        }
        if (deliveryOrderRepository.findByJobOrder_TrackingNumberAndLeg(order.getTrackingNumber(), DeliveryLeg.PICKUP_FROM_CUSTOMER).isPresent()) {
            throw new IllegalStateException("This booking already has a driver assigned and can no longer be cancelled.");
        }

        order.setStatus(JobOrderStatus.CANCELLED);
        jobOrderRepository.save(order);

        timelineService.log(order, JobOrderStatus.CANCELLED, principal.getUser().getFullName(), "Booking cancelled.");

        // Optionally, send cancellation email
        notificationService.enqueueEmail(
                order.getCustomerEmail(),
                "WashAlert Booking Cancelled",
                "Your booking " + order.getTrackingNumber() + " has been successfully cancelled.",
                "ORDER",
                String.valueOf(order.getId())
        );

        return toResponse(order);
    }

    private JobOrderResponse toResponse(JobOrder jo) {
        return JobOrderResponse.from(jo, jo.isPaid() ? PaymentStatus.PAID : null);
    }

    private String buildSpecialInstructions(String laundryType, String notes) {
        String cleanNotes = (notes == null || notes.isBlank()) ? null : notes.trim();
        if (laundryType == null || laundryType.isBlank()) return cleanNotes;
        String prefix = "[Type:" + laundryType.trim() + "]";
        return cleanNotes == null ? prefix : prefix + " " + cleanNotes;
    }
}
