package com.washalert.washalertbackend.delivery;

import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.common.dto.PagedResponse;
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
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.JobOrderTimelineService;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.payment.PaymentMethod;
import com.washalert.washalertbackend.payment.PaymentRecord;
import com.washalert.washalertbackend.payment.PaymentRecordRepository;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import java.security.SecureRandom;
import java.util.ArrayList;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

@Service
public class DeliveryService {
    private static final Logger log = LoggerFactory.getLogger(DeliveryService.class);
    private static final SecureRandom random = new SecureRandom();

    private final DeliveryOrderRepository deliveryRepository;
    private final JobOrderRepository orderRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final PaymentRecordRepository paymentRecordRepository;
    private final JobOrderTimelineService timelineService;
    private final FirestoreSyncService firestoreSyncService;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;

    public DeliveryService(
            DeliveryOrderRepository deliveryRepository,
            JobOrderRepository orderRepository,
            UserRepository userRepository,
            NotificationService notificationService,
            PaymentRecordRepository paymentRecordRepository,
            JobOrderTimelineService timelineService,
            FirestoreSyncService firestoreSyncService,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties
    ) {
        this.deliveryRepository = deliveryRepository;
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.paymentRecordRepository = paymentRecordRepository;
        this.timelineService = timelineService;
        this.firestoreSyncService = firestoreSyncService;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
    }

    @Transactional
    public DeliveryResponse assign(CreateDeliveryRequest req, AuthUserDetails principal) {
        if (req.trackingNumber() == null || req.trackingNumber().isBlank()) {
            throw new IllegalArgumentException("Tracking number is required.");
        }
        JobOrder order = orderRepository.findByTrackingNumber(normalizeTracking(req.trackingNumber()))
                .orElseThrow(() -> new IllegalArgumentException("Order not found."));

        User actor = principal.getUser();
        if (actor.getRole() == Role.STAFF && !sameBranch(actor.getBranch(), order.getBranch())) {
            throw new IllegalArgumentException("You can only manage deliveries in your branch.");
        }

        if (order.getServiceType() != ServiceType.PICKUP_DELIVERY) {
            throw new IllegalArgumentException("Delivery can only be assigned to pickup/delivery orders.");
        }
        if (order.getDeliveryAddress() == null || order.getDeliveryAddress().isBlank()) {
            throw new IllegalArgumentException("Delivery address is missing for this order.");
        }

        if (deliveryRepository.findByJobOrder_TrackingNumberAndLeg(order.getTrackingNumber(), req.leg()).isPresent()) {
            throw new IllegalArgumentException("Delivery is already assigned for this leg.");
        }

        // Resolve driver: prefer driverId (linked User account) over raw name/phone strings
        User driverUser = null;
        String resolvedName;
        String resolvedPhone;

        if (req.driverId() != null) {
            driverUser = userRepository.findById(req.driverId())
                    .orElseThrow(() -> new IllegalArgumentException("Driver not found."));
            if (driverUser.getRole() != Role.DRIVER) {
                throw new IllegalArgumentException("Selected user is not a driver.");
            }
            resolvedName = driverUser.getFullName();
            resolvedPhone = resolveDriverContact(driverUser);
        } else {
            if (req.driverName() == null || req.driverName().isBlank()) {
                throw new IllegalArgumentException("Driver name or driverId is required.");
            }
            resolvedName = req.driverName().trim();
            resolvedPhone = req.driverPhone() != null ? req.driverPhone().trim() : "-";
        }

        DeliveryOrder delivery = DeliveryOrder.builder()
                .jobOrder(order)
                .driverUser(driverUser)
                .driverName(resolvedName)
                .driverPhone(resolvedPhone)
                .estimatedArrivalAt(req.estimatedArrivalAt())
                .notes(blankToNull(req.notes()))
                .leg(req.leg())
                .status(DeliveryStatus.ASSIGNED_PICKUP)
                .build();

        DeliveryOrder saved = deliveryRepository.save(delivery);
        timelineService.log(order, order.getStatus(), actor.getEmail(), "Delivery assigned for " + saved.getLeg());

        // Notify Customer by email
        String customerEmail = saved.getJobOrder().getCustomerEmail();
        notificationService.enqueueEmail(
                customerEmail,
                "WashAlert Delivery Assigned",
                "Tracking Number: %s\nDriver: %s (%s)\nCurrent delivery status: %s"
                        .formatted(
                                saved.getJobOrder().getTrackingNumber(),
                                saved.getDriverName(),
                                saved.getDriverPhone(),
                                saved.getStatus()
                        ),
                "DELIVERY",
                String.valueOf(saved.getId())
        );
        notificationService.enqueuePushToUserEmail(
                customerEmail,
                "Driver Accepted",
                "A driver accepted order %s.".formatted(saved.getJobOrder().getTrackingNumber()),
                "DRIVER_ACCEPTED",
                saved.getJobOrder().getTrackingNumber() + ":driver-accepted"
        );

        // Notify Driver by push — use linked User account if available, otherwise fallback to name lookup
        Optional<User> driverOpt = driverUser != null
                ? Optional.of(driverUser)
                : userRepository.findAllByRoleAndFullName(Role.DRIVER, saved.getDriverName()).stream().findFirst();

        driverOpt.ifPresent(driver ->
                notificationService.enqueuePushToUser(
                        driver,
                        "New Delivery Job Assigned",
                        "You have been assigned to order %s. Pickup at %s."
                                .formatted(saved.getJobOrder().getTrackingNumber(), saved.getJobOrder().getBranch()),
                        "DELIVERY_ASSIGNED",
                        saved.getJobOrder().getTrackingNumber() + ":assigned"
                )
        );

        firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse acceptPendingBooking(String trackingNumber, AuthUserDetails principal) {
        User driver = principal.getUser();
        if (driver.getRole() != Role.DRIVER) {
            throw new IllegalArgumentException("Only drivers can accept bookings.");
        }

        String normalizedTracking = normalizeTracking(trackingNumber);
        JobOrder order = orderRepository.findByTrackingNumberIgnoreCase(normalizedTracking)
                .orElseThrow(() -> new IllegalArgumentException("Order not found."));

        if (order.getServiceType() != ServiceType.PICKUP_DELIVERY) {
            throw new IllegalArgumentException("Only pickup and delivery orders are available for drivers.");
        }
        if (order.getStatus() != JobOrderStatus.PENDING) {
            throw new IllegalStateException("Only pending bookings can be accepted.");
        }
        if (!matchesDriverBranch(driver, order)) {
            throw new IllegalStateException("This booking belongs to a different branch.");
        }

        Optional<DeliveryOrder> existingPickup = deliveryRepository.findByJobOrder_TrackingNumberAndLeg(
                order.getTrackingNumber(),
                DeliveryLeg.PICKUP_FROM_CUSTOMER
        );
        if (existingPickup.isPresent()) {
            DeliveryOrder assigned = existingPickup.get();
            if (assigned.getDriverUser() == null) {
                assigned.setDriverUser(driver);
                assigned.setDriverName(driver.getFullName());
                assigned.setDriverPhone(resolveDriverContact(driver));
                if (assigned.getStatus() == DeliveryStatus.PENDING_PICKUP) {
                    assigned.setStatus(DeliveryStatus.ASSIGNED_PICKUP);
                }
                DeliveryOrder claimed = deliveryRepository.save(assigned);
                firestoreSyncService.upsert("deliveries", claimed.getJobOrder().getTrackingNumber(), toResponse(claimed));
                return toResponse(claimed);
            }
            if (assigned.getDriverUser() != null && assigned.getDriverUser().getId().equals(driver.getId())) {
                if (assigned.getStatus() == DeliveryStatus.PENDING_PICKUP) {
                    assigned.setStatus(DeliveryStatus.ASSIGNED_PICKUP);
                    DeliveryOrder normalized = deliveryRepository.save(assigned);
                    firestoreSyncService.upsert("deliveries", normalized.getJobOrder().getTrackingNumber(), toResponse(normalized));
                    return toResponse(normalized);
                }
                return toResponse(assigned);
            }
            throw new IllegalArgumentException("This booking was already accepted by another driver.");
        }

        DeliveryOrder delivery = DeliveryOrder.builder()
                .jobOrder(order)
                .driverUser(driver)
                .driverName(driver.getFullName())
                .driverPhone(resolveDriverContact(driver))
                .leg(DeliveryLeg.PICKUP_FROM_CUSTOMER)
                .status(DeliveryStatus.ASSIGNED_PICKUP)
                .notes("Driver accepted booking.")
                .build();

        DeliveryOrder saved = deliveryRepository.save(delivery);
        timelineService.log(order, order.getStatus(), driver.getEmail(), "Driver accepted booking.");

        notificationService.enqueuePushToUserEmail(
                order.getCustomerEmail(),
                "Driver Accepted",
                "Driver %s accepted order %s."
                        .formatted(saved.getDriverName(), order.getTrackingNumber()),
                "DRIVER_ACCEPTED",
                order.getTrackingNumber() + ":driver-accepted"
        );

        firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    public List<DriverAvailableOrderResponse> listAvailableForDriver(AuthUserDetails principal) {
        User driver = principal.getUser();
        if (driver.getRole() != Role.DRIVER) {
            throw new IllegalArgumentException("Only drivers can view available bookings.");
        }
        if (blankToNull(driver.getBranch()) == null) {
            return List.of();
        }

        // Phase A: Jobs that are PENDING and haven't been picked up by a driver yet
        List<JobOrder> phaseAOrders = orderRepository.findByStatusAndServiceTypeOrderByCreatedAtDesc(JobOrderStatus.PENDING, ServiceType.PICKUP_DELIVERY)
                .stream()
                .filter(order -> matchesDriverBranch(driver, order))
                .filter(order -> deliveryRepository.findByJobOrder_TrackingNumberAndLeg(
                        order.getTrackingNumber(),
                        DeliveryLeg.PICKUP_FROM_CUSTOMER
                ).isEmpty())
                .toList();

        // Phase B: Jobs that are READY and don't have an ASSIGNED driver for the return leg yet
        List<JobOrder> phaseBOrders = orderRepository.findByStatusAndServiceTypeOrderByCreatedAtDesc(JobOrderStatus.READY, ServiceType.PICKUP_DELIVERY)
                .stream()
                .filter(order -> matchesDriverBranch(driver, order))
                .filter(order -> {
                    Optional<DeliveryOrder> outbound = deliveryRepository.findByJobOrder_TrackingNumberAndLeg(
                            order.getTrackingNumber(),
                            DeliveryLeg.DELIVERY_TO_CUSTOMER
                    );
                    // Available if no record OR it exists but has no driver
                    return outbound.isEmpty() || outbound.get().getDriverUser() == null;
                })
                .toList();

        List<JobOrder> combined = new ArrayList<>();
        combined.addAll(phaseAOrders);
        combined.addAll(phaseBOrders);

        return combined.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(order -> new DriverAvailableOrderResponse(
                        order.getId(),
                        order.getTrackingNumber(),
                        order.getBranch(),
                        order.getCustomerName(),
                        order.getCustomerPhone(),
                        order.getDeliveryAddress(),
                        order.getPaymentMethod(),
                        order.getTotalPrice(),
                        order.getCreatedAt()
                ))
                .limit(50)
                .toList();
    }

    /**
     * Initializes a Phase B delivery record when an order becomes READY.
     * Generates a 4-digit confirmation code for the final delivery handover.
     */
    @Transactional
    public void initializePhaseB(JobOrder order) {
        if (order.getServiceType() != ServiceType.PICKUP_DELIVERY) return;

        Optional<DeliveryOrder> existing = deliveryRepository.findByJobOrder_TrackingNumberAndLeg(
                order.getTrackingNumber(),
                DeliveryLeg.DELIVERY_TO_CUSTOMER
        );

        DeliveryOrder outbound = existing.orElse(new DeliveryOrder());
        outbound.setJobOrder(order);
        outbound.setLeg(DeliveryLeg.DELIVERY_TO_CUSTOMER);
        if (blankToNull(outbound.getDriverName()) == null) {
            outbound.setDriverName("Unassigned");
        }
        if (blankToNull(outbound.getDriverPhone()) == null) {
            outbound.setDriverPhone("-");
        }

        // Only set status to ASSIGNED_DELIVERY if it's new
        if (outbound.getStatus() == null) {
            outbound.setStatus(DeliveryStatus.ASSIGNED_DELIVERY);
        }

        if (outbound.getConfirmationCode() == null) {
            outbound.setConfirmationCode(generateConfirmationCode());
        }

        DeliveryOrder saved = deliveryRepository.save(outbound);
        firestoreSyncService.upsert("deliveries", order.getTrackingNumber(), toResponse(saved));
        log.info("[DeliveryService] Initialized Phase B for order {}, code: {}", order.getTrackingNumber(), saved.getConfirmationCode());
    }

    @Transactional
    public void syncWithOrderStatus(JobOrder order, String changedBy) {
        if (order == null || order.getServiceType() != ServiceType.PICKUP_DELIVERY) return;
        String trackingNumber = normalizeTracking(order.getTrackingNumber());
        DeliveryStatus targetStatus = null;

        if (order.getStatus() == JobOrderStatus.CANCELLED) {
            targetStatus = DeliveryStatus.CANCELLED;
        } else if (order.getStatus() == JobOrderStatus.DELIVERED) {
            targetStatus = DeliveryStatus.DELIVERED;
        }

        if (targetStatus == null) return;

        List<DeliveryOrder> deliveries = deliveryRepository.findByJobOrder_TrackingNumber(trackingNumber);
        if (deliveries.isEmpty()) return;

        boolean changed = false;
        for (DeliveryOrder delivery : deliveries) {
            DeliveryStatus currentStatus = delivery.getStatus();
            if (currentStatus == null || currentStatus == targetStatus || isTerminalDeliveryState(currentStatus)) {
                continue;
            }
            if (targetStatus == DeliveryStatus.DELIVERED && currentStatus == DeliveryStatus.CANCELLED) {
                continue;
            }
            delivery.setStatus(targetStatus);
            changed = true;
        }

        if (!changed) return;

        List<DeliveryOrder> saved = deliveryRepository.saveAll(deliveries);
        for (DeliveryOrder delivery : saved) {
            syncToFirestore(delivery);
        }
        log.info(
                "[DeliveryService] Synced {} deliveries for order {} to {} (updated by {})",
                saved.size(),
                trackingNumber,
                targetStatus,
                blankToNull(changedBy) != null ? changedBy : "system"
        );
    }

    private String generateConfirmationCode() {
        return String.format("%04d", random.nextInt(10000));
    }

    /** Driver-only: returns all deliveries assigned to the calling driver's account. */
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<DeliveryResponse> listMy(AuthUserDetails principal) {
        User driver = principal.getUser();
        return deliveryRepository.findByDriverUser_IdOrderByUpdatedAtDesc(driver.getId())
                .stream().map(this::toResponse).toList();
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public PagedResponse<DeliveryResponse> listMyPaged(
            AuthUserDetails principal,
            String statusGroup,
            Pageable pageable
    ) {
        User driver = principal.getUser();
        if (driver.getRole() != Role.DRIVER) {
            throw new IllegalArgumentException("Only drivers can view personal deliveries.");
        }

        List<DeliveryStatus> statuses = resolveDriverStatusGroup(statusGroup);
        Page<DeliveryOrder> page = statuses.isEmpty()
                ? deliveryRepository.findByDriverUserIdPaged(driver.getId(), pageable)
                : deliveryRepository.findByDriverUserIdAndStatusInPaged(driver.getId(), statuses, pageable);

        Page<DeliveryResponse> mapped = page.map(this::toResponse);
        return PagedResponse.from(mapped);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<DeliveryResponse> list(String branch, AuthUserDetails principal) {
        User actor = principal.getUser();
        String effectiveBranch = resolveEffectiveBranch(branch, actor);

        if (!dataReadProperties.prefersFirestoreReads()) {
            return listFromMysql(effectiveBranch);
        }

        List<DeliveryResponse> firestoreRows = listFromFirestore(effectiveBranch);
        if (!firestoreRows.isEmpty()) {
            return firestoreRows;
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            return listFromMysql(effectiveBranch);
        }

        return firestoreRows;
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public PagedResponse<DeliveryResponse> listPaged(
            String branch,
            String status,
            String search,
            AuthUserDetails principal,
            Pageable pageable
    ) {
        User actor = principal.getUser();
        String effectiveBranch = resolveEffectiveBranch(branch, actor);
        DeliveryStatus parsedStatus = parseDeliveryStatus(status);

        Page<DeliveryOrder> page = deliveryRepository.findOpsPaged(
                effectiveBranch,
                parsedStatus,
                blankToNull(search),
                pageable
        );
        Page<DeliveryResponse> mapped = page.map(this::toResponse);
        return PagedResponse.from(mapped);
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public DeliveryResponse getById(Long deliveryId, AuthUserDetails principal) {
        User actor = principal.getUser();

        if (!dataReadProperties.prefersFirestoreReads()) {
            DeliveryOrder delivery = findDeliveryByIdMysql(deliveryId);
            enforceStaffBranchScope(actor, delivery.getJobOrder().getBranch());
            return toResponse(delivery);
        }

        Optional<DeliveryResponse> firestoreDelivery = firestoreReadService.findDeliveryById(deliveryId);
        if (firestoreDelivery.isPresent()) {
            DeliveryResponse response = firestoreDelivery.get();
            if (!isIncompleteResponse(response)) {
                enforceStaffBranchScope(actor, response.branch());
                return response;
            }
            log.warn("[DeliveryService] Firestore delivery {} missing critical fields; falling back to MySQL.", deliveryId);
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            DeliveryOrder delivery = findDeliveryByIdMysql(deliveryId);
            enforceStaffBranchScope(actor, delivery.getJobOrder().getBranch());
            return toResponse(delivery);
        }

        throw new IllegalArgumentException("Delivery not found.");
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public DeliveryResponse trackByTrackingNumber(String trackingNumber) {
        String normalized = normalizeTracking(trackingNumber);

        if (!dataReadProperties.prefersFirestoreReads()) {
            List<DeliveryOrder> deliveries = deliveryRepository.findByJobOrder_TrackingNumber(normalized);
            if (deliveries.isEmpty()) throw new IllegalArgumentException("Delivery not found.");
            return toResponse(deliveries.get(0));
        }

        Optional<DeliveryResponse> firestoreDelivery = firestoreReadService.findDeliveryByTracking(normalized);
        if (firestoreDelivery.isPresent()) {
            DeliveryResponse response = firestoreDelivery.get();
            if (!isIncompleteResponse(response)) {
                return response;
            }
            log.warn("[DeliveryService] Firestore tracking {} missing critical fields; falling back to MySQL.", normalized);
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            List<DeliveryOrder> deliveries = deliveryRepository.findByJobOrder_TrackingNumber(normalized);
            if (deliveries.isEmpty()) throw new IllegalArgumentException("Delivery not found.");
            return toResponse(deliveries.get(0));
        }

        throw new IllegalArgumentException("Delivery not found.");
    }

    @Transactional
    public DeliveryResponse updateStatus(Long deliveryId, UpdateDeliveryStatusRequest req, AuthUserDetails principal) {
        DeliveryOrder delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new IllegalArgumentException("Delivery not found."));

        User actor = principal.getUser();
        enforceDeliveryWriteScope(actor, delivery);

        if (delivery.getStatus() != req.status() && !isValidTransition(delivery.getStatus(), req.status())) {
            throw new IllegalStateException("Invalid delivery status transition from " + delivery.getStatus() + " to " + req.status() + ".");
        }
        delivery.setStatus(req.status());
        if (req.notes() != null) {
            delivery.setNotes(blankToNull(req.notes()));
        }

        DeliveryOrder saved = deliveryRepository.save(delivery);
        applyJobOrderStatusFromDelivery(saved, actor);

        // Notify Customer
        notificationService.enqueueEmail(
                saved.getJobOrder().getCustomerEmail(),
                "WashAlert Delivery Status Update",
                "Tracking Number: %s\nDelivery status is now: %s"
                        .formatted(saved.getJobOrder().getTrackingNumber(), saved.getStatus()),
                "DELIVERY_STATUS",
                String.valueOf(saved.getId())
        );
        String customerBody = "Your laundry is now %s."
                .formatted(saved.getStatus().toString().toLowerCase().replace('_', ' '));
        if (saved.getStatus() == DeliveryStatus.EN_ROUTE_TO_PICKUP || saved.getStatus() == DeliveryStatus.IN_TRANSIT) {
            customerBody = "Your order %s is out for delivery."
                    .formatted(saved.getJobOrder().getTrackingNumber());
        } else if (saved.getStatus() == DeliveryStatus.PICKED_UP) {
            customerBody = "Your driver has picked up your laundry and is now heading to you.";
        } else if (saved.getStatus() == DeliveryStatus.DELIVERED) {
            customerBody = "Your laundry has arrived. Delivery completed.";
        }
        notificationService.enqueuePushToUserEmail(
                saved.getJobOrder().getCustomerEmail(),
                "Delivery Update",
                customerBody,
                "DELIVERY_UPDATE",
                saved.getJobOrder().getTrackingNumber() + ":" + saved.getStatus().name()
        );
        if (saved.getDriverUser() != null) {
            notificationService.enqueuePushToUser(
                    saved.getDriverUser(),
                    "Delivery Status Changed",
                    "Order %s is now %s."
                            .formatted(saved.getJobOrder().getTrackingNumber(), saved.getStatus().name().replace('_', ' ')),
                    "DRIVER_DELIVERY_STATUS",
                    saved.getJobOrder().getTrackingNumber() + ":" + saved.getStatus().name()
            );
        }

        firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse updateAssignment(Long deliveryId, UpdateDeliveryAssignmentRequest req, AuthUserDetails principal) {
        DeliveryOrder delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new IllegalArgumentException("Delivery not found."));

        User actor = principal.getUser();
        enforceDeliveryWriteScope(actor, delivery);

        delivery.setDriverName(req.driverName().trim());
        delivery.setDriverPhone(req.driverPhone().trim());
        userRepository.findAllByRoleAndFullName(Role.DRIVER, req.driverName().trim()).stream().findFirst()
                .ifPresent(delivery::setDriverUser);
        if (delivery.getStatus() == DeliveryStatus.PENDING_PICKUP) {
            delivery.setStatus(DeliveryStatus.ASSIGNED_PICKUP);
        }
        delivery.setEstimatedArrivalAt(req.estimatedArrivalAt());
        if (req.notes() != null) {
            delivery.setNotes(blankToNull(req.notes()));
        }

        DeliveryOrder saved = deliveryRepository.save(delivery);
        timelineService.log(saved.getJobOrder(), saved.getJobOrder().getStatus(), actor.getEmail(), "Driver assignment updated.");
        if (saved.getDriverUser() != null) {
            notificationService.enqueuePushToUser(
                    saved.getDriverUser(),
                    "Route/Assignment Updated",
                    "Delivery assignment for order %s was updated."
                            .formatted(saved.getJobOrder().getTrackingNumber()),
                    "DRIVER_ASSIGNMENT_UPDATE",
                    saved.getJobOrder().getTrackingNumber() + ":assignment-update"
            );
        }
        firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse updateLocation(Long deliveryId, UpdateDeliveryLocationRequest req, AuthUserDetails principal) {
        DeliveryOrder delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new IllegalArgumentException("Delivery not found."));

        User actor = principal.getUser();
        enforceStaffBranchScope(actor, delivery.getJobOrder().getBranch());

        if ((req.latitude() == null) != (req.longitude() == null)) {
            throw new IllegalArgumentException("Both latitude and longitude are required when updating location.");
        }

        if (req.latitude() != null) delivery.setCurrentLatitude(req.latitude());
        if (req.longitude() != null) delivery.setCurrentLongitude(req.longitude());
        if (req.estimatedArrivalAt() != null) delivery.setEstimatedArrivalAt(req.estimatedArrivalAt());
        if (req.notes() != null) delivery.setNotes(blankToNull(req.notes()));

        DeliveryOrder saved = deliveryRepository.save(delivery);
        log.info(
                "[DeliveryLocation] tracking={} deliveryId={} lat={} lng={} actor={}",
                saved.getJobOrder().getTrackingNumber(),
                saved.getId(),
                saved.getCurrentLatitude(),
                saved.getCurrentLongitude(),
                actor.getEmail()
        );
        firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse uploadProof(Long deliveryId, UploadDeliveryProofRequest req, AuthUserDetails principal) {
        DeliveryOrder delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new IllegalArgumentException("Delivery not found."));
        User actor = principal.getUser();
        enforceDeliveryWriteScope(actor, delivery);

        String proofUrl = req.proofUrl().trim();
        if (req.proofType() == DeliveryProofType.PICKUP) {
            delivery.setPickupProofUrl(proofUrl);
            timelineService.log(delivery.getJobOrder(), delivery.getJobOrder().getStatus(), actor.getEmail(), "Pickup proof uploaded.");
        } else {
            delivery.setDropoffProofUrl(proofUrl);
            timelineService.log(delivery.getJobOrder(), delivery.getJobOrder().getStatus(), actor.getEmail(), "Drop-off proof uploaded.");
        }

        DeliveryOrder saved = deliveryRepository.save(delivery);
        log.info(
                "[DeliveryProof] tracking={} deliveryId={} proofType={} actor={}",
                saved.getJobOrder().getTrackingNumber(),
                saved.getId(),
                req.proofType(),
                actor.getEmail()
        );
        firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse collectCodPayment(Long deliveryId, AuthUserDetails principal) {
        DeliveryOrder delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new IllegalArgumentException("Delivery not found."));

        User actor = principal.getUser();
        enforceStaffBranchScope(actor, delivery.getJobOrder().getBranch());

        if (actor.getRole() == Role.DRIVER
                && (delivery.getDriverUser() == null || !delivery.getDriverUser().getId().equals(actor.getId()))) {
            throw new IllegalArgumentException("You can only collect COD for your assigned deliveries.");
        }

        JobOrder order = delivery.getJobOrder();
        String method = order.getPaymentMethod() == null ? "" : order.getPaymentMethod().trim().toUpperCase();
        if (!method.contains("CASH")) {
            throw new IllegalStateException("COD collection is only available for cash orders.");
        }

        order.setPaid(true);
        orderRepository.save(order);

        PaymentRecord payment = paymentRecordRepository.findByJobOrder_TrackingNumber(order.getTrackingNumber())
                .orElseGet(() -> PaymentRecord.builder().jobOrder(order).build());
        payment.setMethod(PaymentMethod.CASH);
        payment.setAmount(order.getTotalPrice());
        payment.setStatus(PaymentStatus.PAID);
        payment.setVerifiedAt(LocalDateTime.now());
        payment.setVerifiedBy(actor.getEmail());
        payment.setNotes("COD collected by " + actor.getFullName());
        paymentRecordRepository.save(payment);

        notificationService.enqueuePushToUserEmail(
                order.getCustomerEmail(),
                "Payment Confirmed",
                "Cash payment for order %s was received."
                        .formatted(order.getTrackingNumber()),
                "PAYMENT_VERIFIED",
                order.getTrackingNumber() + ":cod-paid"
        );

        firestoreSyncService.upsert("deliveries", delivery.getJobOrder().getTrackingNumber(), toResponse(delivery));
        return toResponse(delivery);
    }

    private List<DeliveryResponse> listFromMysql(String effectiveBranch) {
        if (effectiveBranch == null) {
            return deliveryRepository.findAllByOrderByUpdatedAtDesc().stream().map(this::toResponse).toList();
        }

        return deliveryRepository.findByJobOrder_BranchIgnoreCaseOrderByUpdatedAtDesc(effectiveBranch)
                .stream().map(this::toResponse).toList();
    }

    private List<DeliveryResponse> listFromFirestore(String effectiveBranch) {
        return firestoreReadService.listDeliveries().stream()
                .filter(delivery -> effectiveBranch == null || sameBranch(delivery.branch(), effectiveBranch))
                .sorted((a, b) -> compareDateDesc(a.updatedAt(), b.updatedAt()))
                .toList();
    }

    private DeliveryOrder findDeliveryByIdMysql(Long deliveryId) {
        return deliveryRepository.findWithJobOrderById(deliveryId)
                .orElseThrow(() -> new IllegalArgumentException("Delivery not found."));
    }

    private List<DeliveryOrder> findDeliveryByTrackingMysql(String normalizedTracking) {
        return deliveryRepository.findByJobOrder_TrackingNumber(normalizedTracking);
    }

    private String resolveEffectiveBranch(String requestedBranch, User actor) {
        if (actor.getRole() == Role.STAFF) return actor.getBranch();
        if (requestedBranch == null || requestedBranch.isBlank() || requestedBranch.equalsIgnoreCase("All")) return null;
        return requestedBranch.trim();
    }

    private void enforceStaffBranchScope(User actor, String targetBranch) {
        if (actor.getRole() == Role.STAFF && !sameBranch(actor.getBranch(), targetBranch)) {
            throw new IllegalArgumentException("You can only manage deliveries in your branch.");
        }
    }

    private void enforceDeliveryWriteScope(User actor, DeliveryOrder delivery) {
        if (actor.getRole() == Role.DRIVER) {
            if (delivery.getDriverUser() == null || !delivery.getDriverUser().getId().equals(actor.getId())) {
                throw new IllegalArgumentException("You can only update your assigned deliveries.");
            }
            return;
        }
        enforceStaffBranchScope(actor, delivery.getJobOrder().getBranch());
    }

    private void applyJobOrderStatusFromDelivery(DeliveryOrder delivery, User actor) {
        JobOrder order = delivery.getJobOrder();
        if (order.getStatus() == JobOrderStatus.CANCELLED || order.getStatus() == JobOrderStatus.DELIVERED) {
            return;
        }

        JobOrderStatus previous = order.getStatus();
        if (delivery.getLeg() == DeliveryLeg.PICKUP_FROM_CUSTOMER) {
            if (delivery.getStatus() == DeliveryStatus.PICKED_UP) {
                order.setStatus(JobOrderStatus.PICKED_UP);
            } else if (delivery.getStatus() == DeliveryStatus.DELIVERED) {
                order.setStatus(JobOrderStatus.WASHING);
            }
        } else if (delivery.getLeg() == DeliveryLeg.DELIVERY_TO_CUSTOMER) {
            if (delivery.getStatus() == DeliveryStatus.DELIVERED) {
                order.setStatus(JobOrderStatus.DELIVERED);
            }
        }

        if (order.getStatus() != previous) {
            orderRepository.save(order);
            timelineService.log(
                    order,
                    order.getStatus(),
                    actor.getEmail(),
                    "Order status updated from delivery workflow."
            );
        }
    }

    private DeliveryWorkflowStatus deriveWorkflowStatus(JobOrder order, DeliveryOrder delivery) {
        if (order.getStatus() == JobOrderStatus.CANCELLED) return DeliveryWorkflowStatus.CANCELLED;
        if (order.getStatus() == JobOrderStatus.DELIVERED) return DeliveryWorkflowStatus.COMPLETED;
        if (order.getStatus() == JobOrderStatus.READY) return DeliveryWorkflowStatus.READY;
        if (order.getStatus() == JobOrderStatus.WASHING || order.getStatus() == JobOrderStatus.DRYING) {
            return DeliveryWorkflowStatus.AT_SHOP;
        }

        if (delivery == null) return DeliveryWorkflowStatus.PENDING;

        if (delivery.getLeg() == DeliveryLeg.PICKUP_FROM_CUSTOMER) {
            return switch (delivery.getStatus()) {
                case ASSIGNED_PICKUP, PENDING_PICKUP           -> DeliveryWorkflowStatus.DRIVER_ACCEPTED;
                case ARRIVED_CUSTOMER, EN_ROUTE_TO_PICKUP      -> DeliveryWorkflowStatus.PICKING_UP;
                case PICKED_UP, ARRIVED_BRANCH                 -> DeliveryWorkflowStatus.PICKED_UP;
                case HANDED_TO_BRANCH, IN_TRANSIT              -> DeliveryWorkflowStatus.AT_SHOP;
                case ASSIGNED_DELIVERY                         -> DeliveryWorkflowStatus.READY;
                case OUT_FOR_DELIVERY, ARRIVED_DELIVERY        -> DeliveryWorkflowStatus.PICKING_UP;
                case DELIVERED                                 -> DeliveryWorkflowStatus.COMPLETED;
                case FAILED, CANCELLED                         -> DeliveryWorkflowStatus.CANCELLED;
                default -> DeliveryWorkflowStatus.PENDING;
            };
        }

        return switch (delivery.getStatus()) {
            case ASSIGNED_DELIVERY, PENDING_PICKUP             -> DeliveryWorkflowStatus.READY;
            case OUT_FOR_DELIVERY, ARRIVED_DELIVERY, EN_ROUTE_TO_PICKUP -> DeliveryWorkflowStatus.PICKING_UP;
            case DELIVERED                                     -> DeliveryWorkflowStatus.COMPLETED;
            case ASSIGNED_PICKUP, ARRIVED_CUSTOMER             -> DeliveryWorkflowStatus.DRIVER_ACCEPTED;
            case PICKED_UP, IN_TRANSIT, ARRIVED_BRANCH         -> DeliveryWorkflowStatus.PICKED_UP;
            case HANDED_TO_BRANCH                              -> DeliveryWorkflowStatus.AT_SHOP;
            case FAILED, CANCELLED                             -> DeliveryWorkflowStatus.CANCELLED;
            default -> DeliveryWorkflowStatus.PENDING;
        };
    }

    private DeliveryResponse toResponse(DeliveryOrder d) {
        JobOrder order = d.getJobOrder();
        User driverUser = d.getDriverUser();
        String driverPhone = (driverUser != null && driverUser.getMobileNumber() != null && !driverUser.getMobileNumber().isBlank())
                ? driverUser.getMobileNumber()
                : d.getDriverPhone();
        String driverPhotoUrl = driverUser != null ? driverUser.getProfileImageUrl() : null;
        String driverVehicle = extractVehicleFromNotes(d.getNotes());
        Integer resolvedLoadCount = d.getBagCount() != null
                ? d.getBagCount()
                : (order.getEstimatedWeightKg() != null ? order.getEstimatedWeightKg().intValue() : null);
        String paymentStatus = order.isPaid() ? "PAID" : "UNPAID";
        return new DeliveryResponse(
                d.getId(),
                order.getId(),
                order.getTrackingNumber(),
                order.getBranchId(),
                order.getBranch(),
                resolveBranchAddress(order.getBranch()),
                order.getCustomerName(),
                order.getCustomerPhone(),
                order.getDeliveryAddress(),
                d.getDriverName(),
                driverUser != null ? driverUser.getId() : null,
                driverPhone,
                driverPhotoUrl,
                driverVehicle,
                order.getPaymentMethod(),
                paymentStatus,
                order.isPaid(),
                order.getTotalPrice(),
                order.getEstimatedWeightKg(),
                resolvedLoadCount,
                deriveWorkflowStatus(order, d),
                d.getLeg(),
                d.getStatus(),
                d.getCurrentLatitude(),
                d.getCurrentLongitude(),
                d.getEstimatedArrivalAt(),
                d.getPickupProofUrl(),
                d.getDropoffProofUrl(),
                d.getNotes(),
                d.getUpdatedAt(),
                order.getBranchLatitude(),
                order.getBranchLongitude(),
                order.getDeliveryLatitude(),
                order.getDeliveryLongitude(),
                order.getDeliveryUnitFloor(),
                order.getDeliveryContactName(),
                order.getDeliveryContactPhone(),
                d.getBagCount(),
                d.getConfirmationCode(),
                d.getBranchHandoverPhotoUrl(),
                d.getFinalDeliveryPhotoUrl()
        );
    }

    // ── State Machine Service Methods ─────────────────────────────────────────

    @Transactional
    public DeliveryResponse arriveAtCustomer(Long deliveryId, AuthUserDetails principal) {
        DeliveryOrder d = findDeliveryOrThrow(deliveryId);
        enforceDriverOwnership(d, principal);
        requireStatusIn(d, "arrive at customer", DeliveryStatus.ASSIGNED_PICKUP, DeliveryStatus.PENDING_PICKUP);
        d.setStatus(DeliveryStatus.ARRIVED_CUSTOMER);
        DeliveryOrder saved = deliveryRepository.save(d);
        syncToFirestore(saved);
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse completePickup(Long deliveryId, PickupCompleteRequest req, AuthUserDetails principal) {
        DeliveryOrder d = findDeliveryOrThrow(deliveryId);
        enforceDriverOwnership(d, principal);
        requireStatus(d, DeliveryStatus.ARRIVED_CUSTOMER, "complete pickup");
        d.setBagCount(req.bagCount());
        if (req.pickupPhotoUrl() != null) d.setPickupProofUrl(req.pickupPhotoUrl());
        d.setStatus(DeliveryStatus.PICKED_UP);
        DeliveryOrder saved = deliveryRepository.save(d);
        syncToFirestore(saved);
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse arriveAtBranch(Long deliveryId, AuthUserDetails principal) {
        DeliveryOrder d = findDeliveryOrThrow(deliveryId);
        enforceDriverOwnership(d, principal);
        requireStatus(d, DeliveryStatus.PICKED_UP, "arrive at branch");
        d.setStatus(DeliveryStatus.ARRIVED_BRANCH);
        DeliveryOrder saved = deliveryRepository.save(d);
        syncToFirestore(saved);
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse branchHandover(Long deliveryId, BranchHandoverRequest req, AuthUserDetails principal) {
        DeliveryOrder d = findDeliveryOrThrow(deliveryId);
        enforceDriverOwnership(d, principal);
        requireStatus(d, DeliveryStatus.ARRIVED_BRANCH, "branch handover");
        d.setBranchHandoverPhotoUrl(req.branchHandoverPhotoUrl());
        d.setStatus(DeliveryStatus.HANDED_TO_BRANCH);
        DeliveryOrder saved = deliveryRepository.save(d);
        syncToFirestore(saved);
        // Update job order status to AT_SHOP
        JobOrder order = saved.getJobOrder();
        if (order.getStatus() == JobOrderStatus.PENDING || order.getStatus() == JobOrderStatus.PICKED_UP) {
            order.setStatus(JobOrderStatus.WASHING);
            orderRepository.save(order);
        }
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse startDelivery(Long deliveryId, AuthUserDetails principal) {
        DeliveryOrder d = findDeliveryOrThrow(deliveryId);
        // Allow any driver to pick from pool, or assigned driver
        User actor = principal.getUser();
        if (d.getDriverUser() == null) {
            // Assign this driver to the delivery from the pool
            d.setDriverUser(actor);
            d.setDriverName(actor.getFullName() != null ? actor.getFullName() : actor.getEmail());
            d.setDriverPhone(resolveDriverContact(actor));
        } else {
            enforceDriverOwnership(d, principal);
        }
        requireStatus(d, DeliveryStatus.ASSIGNED_DELIVERY, "start delivery");
        d.setStatus(DeliveryStatus.OUT_FOR_DELIVERY);
        DeliveryOrder saved = deliveryRepository.save(d);
        syncToFirestore(saved);
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse arriveForDelivery(Long deliveryId, AuthUserDetails principal) {
        DeliveryOrder d = findDeliveryOrThrow(deliveryId);
        enforceDriverOwnership(d, principal);
        requireStatus(d, DeliveryStatus.OUT_FOR_DELIVERY, "arrive for delivery");
        d.setStatus(DeliveryStatus.ARRIVED_DELIVERY);
        DeliveryOrder saved = deliveryRepository.save(d);
        syncToFirestore(saved);
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse finalHandover(Long deliveryId, FinalHandoverRequest req, AuthUserDetails principal) {
        DeliveryOrder d = findDeliveryOrThrow(deliveryId);
        enforceDriverOwnership(d, principal);
        requireStatus(d, DeliveryStatus.ARRIVED_DELIVERY, "final handover");
        // Verify confirmation code
        if (d.getConfirmationCode() != null && !d.getConfirmationCode().equalsIgnoreCase(req.confirmationCode().trim())) {
            throw new IllegalArgumentException("Confirmation code does not match. Please verify with the customer.");
        }
        if (req.finalDeliveryPhotoUrl() != null) d.setFinalDeliveryPhotoUrl(req.finalDeliveryPhotoUrl());
        d.setStatus(DeliveryStatus.DELIVERED);
        DeliveryOrder saved = deliveryRepository.save(d);
        syncToFirestore(saved);
        // Mark job order as delivered
        JobOrder order = saved.getJobOrder();
        order.setStatus(JobOrderStatus.DELIVERED);
        orderRepository.save(order);
        return toResponse(saved);
    }

    // ── State Machine Helpers ─────────────────────────────────────────────────
    
    private DeliveryOrder findDeliveryOrThrow(Long id) {
        return deliveryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Delivery booking not found with ID: " + id));
    }

    private void requireStatus(DeliveryOrder d, DeliveryStatus required, String action) {
        if (d.getStatus() != required) {
            throw new IllegalStateException(
                    "Cannot " + action + ": delivery is in state " + d.getStatus() + " (expected " + required + ")."
            );
        }
    }

    private void requireStatusIn(DeliveryOrder d, String action, DeliveryStatus... expectedStatuses) {
        for (DeliveryStatus expected : expectedStatuses) {
            if (d.getStatus() == expected) {
                return;
            }
        }
        throw new IllegalStateException(
                "Cannot " + action + ": delivery is in state " + d.getStatus() + "."
        );
    }

    private void enforceDriverOwnership(DeliveryOrder d, AuthUserDetails principal) {
        User actor = principal.getUser();
        if (actor.getRole() == Role.ADMIN || actor.getRole() == Role.STAFF) return;
        if (d.getDriverUser() != null && !d.getDriverUser().getId().equals(actor.getId())) {
            throw new IllegalArgumentException("This delivery is not assigned to you.");
        }
    }

    private void syncToFirestore(DeliveryOrder saved) {
        try {
            firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        } catch (Exception ex) {
            log.warn("[StateMachine] Firestore sync failed for delivery {}: {}", saved.getId(), ex.getMessage());
        }
    }

    private String normalizeTracking(String trackingNumber) {
        if (trackingNumber == null || trackingNumber.isBlank()) {
            throw new IllegalArgumentException("Tracking number is required.");
        }
        return trackingNumber.trim().toUpperCase();
    }

    private boolean sameBranch(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
    }

    private boolean matchesDriverBranch(User driver, JobOrder order) {
        if (driver == null || order == null) return false;
        Long driverBranchId = driver.getBranchId();
        Long orderBranchId = order.getBranchId();
        if (driverBranchId != null && orderBranchId != null) {
            return driverBranchId.equals(orderBranchId);
        }
        return sameBranch(driver.getBranch(), order.getBranch());
    }

    private int compareDateDesc(LocalDateTime a, LocalDateTime b) {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return b.compareTo(a);
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isIncompleteResponse(DeliveryResponse response) {
        return response == null
                || response.id() == null
                || blankToNull(response.trackingNumber()) == null
                || blankToNull(response.customerName()) == null
                || blankToNull(response.branch()) == null;
    }

    private String resolveBranchAddress(String branchName) {
        String branch = blankToNull(branchName);
        if (branch == null) return null;
        return switch (branch.toLowerCase()) {
            case "makati branch" -> "7605 Dela Rosa, Corner Wilson Street (inside R&R Carwash), Makati City, Metro Manila";
            case "chestnut branch" -> "244A Upper Republic Ave., West Fairview Park, Quezon City, Metro Manila";
            case "republic branch" -> "Republic Avenue, West Fairview, Quezon City, Metro Manila";
            case "holy spirit branch" -> "Faustino Street, Brgy. Holy Spirit, Quezon City, Metro Manila";
            case "sta. catalina branch" -> "408 Sta. Catalina St, Quezon City, Metro Manila";
            case "brookside branch" -> "Sunset Drive, Brookside Hills Subdivision, Cainta, Rizal";
            case "jp rizal branch" -> "J.P. Rizal Ave, Binangonan, Rizal";
            case "luzon branch" -> "Luzon Ave, Matandang Balara, Quezon City, Metro Manila";
            case "st. anthony branch" -> "St. Anthony Street, Quezon City, Metro Manila";
            case "up diliman / san vicente branch" -> "San Vicente, Diliman, Quezon City, Metro Manila";
            default -> branch;
        };
    }

    private DeliveryStatus parseDeliveryStatus(String status) {
        String normalized = blankToNull(status);
        if (normalized == null) return null;
        try {
            return DeliveryStatus.valueOf(normalized.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid delivery status filter.");
        }
    }

    private List<DeliveryStatus> resolveDriverStatusGroup(String statusGroup) {
        String normalized = blankToNull(statusGroup);
        if (normalized == null || "all".equalsIgnoreCase(normalized)) return List.of();
        return switch (normalized.toLowerCase()) {
            case "pending" -> List.of(DeliveryStatus.ASSIGNED_PICKUP, DeliveryStatus.PENDING_PICKUP);
            case "in_progress" -> EnumSet.of(
                    DeliveryStatus.ARRIVED_CUSTOMER,
                    DeliveryStatus.PICKED_UP,
                    DeliveryStatus.ARRIVED_BRANCH,
                    DeliveryStatus.HANDED_TO_BRANCH,
                    DeliveryStatus.ASSIGNED_DELIVERY,
                    DeliveryStatus.OUT_FOR_DELIVERY,
                    DeliveryStatus.ARRIVED_DELIVERY,
                    DeliveryStatus.EN_ROUTE_TO_PICKUP,
                    DeliveryStatus.IN_TRANSIT
            ).stream().toList();
            case "completed" -> List.of(DeliveryStatus.DELIVERED);
            case "failed" -> List.of(DeliveryStatus.FAILED, DeliveryStatus.CANCELLED);
            default -> throw new IllegalArgumentException("Invalid delivery status group filter.");
        };
    }

    private String resolveDriverContact(User driver) {
        if (driver == null) return "-";
        if (driver.getMobileNumber() != null && !driver.getMobileNumber().isBlank()) {
            return driver.getMobileNumber().trim();
        }
        if (driver.getEmail() != null && !driver.getEmail().isBlank()) {
            return driver.getEmail().trim();
        }
        return "-";
    }

    private String extractVehicleFromNotes(String notes) {
        String value = blankToNull(notes);
        if (value == null) return null;
        String lower = value.toLowerCase();
        int idx = lower.indexOf("vehicle:");
        if (idx < 0) return null;
        String extracted = value.substring(idx + "vehicle:".length()).trim();
        return extracted.isEmpty() ? null : extracted;
    }

    private boolean isValidTransition(DeliveryStatus from, DeliveryStatus to) {
        return switch (from) {
            // ── Phase A ───────────────────────────────────────────────────────
            case ASSIGNED_PICKUP    -> to == DeliveryStatus.ARRIVED_CUSTOMER || to == DeliveryStatus.CANCELLED;
            case ARRIVED_CUSTOMER   -> to == DeliveryStatus.PICKED_UP || to == DeliveryStatus.CANCELLED;
            case PICKED_UP          -> to == DeliveryStatus.ARRIVED_BRANCH || to == DeliveryStatus.CANCELLED;
            case ARRIVED_BRANCH     -> to == DeliveryStatus.HANDED_TO_BRANCH || to == DeliveryStatus.CANCELLED;
            case HANDED_TO_BRANCH   -> to == DeliveryStatus.ASSIGNED_DELIVERY; // auto-transition to Phase B
            // ── Phase B ───────────────────────────────────────────────────────
            case ASSIGNED_DELIVERY  -> to == DeliveryStatus.OUT_FOR_DELIVERY || to == DeliveryStatus.CANCELLED;
            case OUT_FOR_DELIVERY   -> to == DeliveryStatus.ARRIVED_DELIVERY || to == DeliveryStatus.CANCELLED;
            case ARRIVED_DELIVERY   -> to == DeliveryStatus.DELIVERED || to == DeliveryStatus.CANCELLED;
            case DELIVERED, CANCELLED, FAILED -> false;
            // ── Legacy ────────────────────────────────────────────────────────
            case PENDING_PICKUP     -> to == DeliveryStatus.EN_ROUTE_TO_PICKUP || to == DeliveryStatus.FAILED;
            case EN_ROUTE_TO_PICKUP -> to == DeliveryStatus.PICKED_UP || to == DeliveryStatus.FAILED;
            case IN_TRANSIT         -> to == DeliveryStatus.DELIVERED || to == DeliveryStatus.FAILED;
            default -> false;
        };
    }

    private boolean isTerminalDeliveryState(DeliveryStatus status) {
        return status == DeliveryStatus.DELIVERED
                || status == DeliveryStatus.CANCELLED
                || status == DeliveryStatus.FAILED;
    }
}
