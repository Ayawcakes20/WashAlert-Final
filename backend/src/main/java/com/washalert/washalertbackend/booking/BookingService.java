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
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.user.Role;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class BookingService {
    private static final BigDecimal MACHINE_ABSOLUTE_MAX_LOAD_KG = new BigDecimal("9.0");
    private static final BigDecimal PURE_CLOTHES_MAX_LOAD_KG = new BigDecimal("8.0");
    private static final BigDecimal BULKY_ITEMS_MAX_LOAD_KG = new BigDecimal("7.0");
    private static final BigDecimal MIN_LOAD_KG = new BigDecimal("1.0");
    private static final Pattern SERVICE_KG_LIMIT_PATTERN = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*kg", Pattern.CASE_INSENSITIVE);

    private final JobOrderRepository jobOrderRepository;
    private final MachineRepository machineRepository;
    private final BookingProperties bookingProperties;
    private final DeliveryOrderRepository deliveryOrderRepository;
    private final JobOrderTimelineService timelineService;
    private final NotificationService notificationService;
    private final PricingService pricingService;

    public BookingService(
            JobOrderRepository jobOrderRepository,
            MachineRepository machineRepository,
            BookingProperties bookingProperties,
            DeliveryOrderRepository deliveryOrderRepository,
            JobOrderTimelineService timelineService,
            NotificationService notificationService,
            PricingService pricingService
    ) {
        this.jobOrderRepository = jobOrderRepository;
        this.machineRepository = machineRepository;
        this.bookingProperties = bookingProperties;
        this.deliveryOrderRepository = deliveryOrderRepository;
        this.timelineService = timelineService;
        this.notificationService = notificationService;
        this.pricingService = pricingService;
    }

    public List<BookingSlotResponse> getAvailableSlots(String branch, LocalDate date) {
        String cleanBranch = normalizeBranch(branch);
        LocalDate targetDate = (date == null) ? LocalDate.now() : date;
        validateDate(targetDate);

        long capacity = machineRepository.countByBranchIgnoreCaseAndStatusNot(cleanBranch, MachineStatus.MAINTENANCE);
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

            long booked = jobOrderRepository.countByBranchIgnoreCaseAndBookingDateAndSlotStartTime(cleanBranch, targetDate, slotStart);
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
        validateDate(req.preferredDate());
        validateLoadSize(req.serviceName(), req.estimatedWeightKg(), req.containsBulkyItems());

        if (req.serviceType() == ServiceType.PICKUP_DELIVERY
                && (req.deliveryAddress() == null || req.deliveryAddress().isBlank())) {
            throw new IllegalArgumentException("Delivery address is required for pickup and delivery.");
        }

        LocalTime slotStart = req.preferredSlotStartTime();
        LocalTime slotEnd = slotStart.plusMinutes(bookingProperties.getSlotMinutes());
        validateSlotTime(slotStart, slotEnd);

        // Lock branch machines to serialize booking writes and prevent slot overbooking races.
        var lockedMachines = machineRepository.lockByBranch(cleanBranch);
        long capacity = lockedMachines.stream()
                .filter(m -> m.getStatus() != MachineStatus.MAINTENANCE)
                .count();
        if (capacity <= 0) {
            throw new IllegalArgumentException("No active machines found for the selected branch.");
        }

        long booked = jobOrderRepository.countByBranchIgnoreCaseAndBookingDateAndSlotStartTime(cleanBranch, req.preferredDate(), slotStart);
        if (booked >= capacity) {
            throw new IllegalArgumentException("Selected time slot is already full. Please choose another slot.");
        }

        var est = pricingService.estimate(
                cleanBranch,
                req.serviceName(),
                BigDecimal.ONE, // Base price only (no weight multiplier at booking)
                req.isRush(),
                req.detergentPreference(),
                req.fabricConditionerPreference(),
                req.distanceKm()
        );

        JobOrder order = JobOrder.builder()
                .trackingNumber("TMP-" + UUID.randomUUID())
                .customerName(req.customerName().trim())
                .branch(cleanBranch)
                .branchId(req.branchId())
                .customerPhone(req.customerPhone().trim())
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
                .detergentQuantity(req.detergentQuantity())
                .fabricConditionerPreference(req.fabricConditionerPreference().trim())
                .conditionerQuantity(req.conditionerQuantity())
                .loadSize(req.loadSize())
                .estimatedWeightKg(req.estimatedWeightKg())
                .specialInstructions(trimToNull(req.specialInstructions()))
                .servicePrice(req.servicePrice() != null ? req.servicePrice() : est.servicePrice())
                .suppliesPrice(req.suppliesPrice() != null ? req.suppliesPrice() : est.suppliesPrice())
                .rushPrice(req.rushPrice() != null ? req.rushPrice() : (req.isRush() ? new BigDecimal("150.00") : BigDecimal.ZERO))
                .deliveryPrice(req.deliveryPrice() != null ? req.deliveryPrice() : est.deliveryPrice())
                .totalPrice(req.total() != null ? req.total() : est.totalPrice())
                .paymentMethod(req.paymentMethod())
                .serviceName(req.serviceName())
                .status(JobOrderStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        jobOrderRepository.saveAndFlush(order);
        order.setTrackingNumber(formatTrackingNumber(order.getId()));
        JobOrder saved = jobOrderRepository.save(order);
        timelineService.log(saved, saved.getStatus(), "customer", "Booking created");
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
        return toResponse(saved);
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
            throw new IllegalArgumentException("Minimum load is 1 kg.");
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
}
