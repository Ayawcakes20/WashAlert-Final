package com.washalert.washalertbackend.delivery;

import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.delivery.dto.CreateDeliveryRequest;
import com.washalert.washalertbackend.delivery.dto.DeliveryResponse;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryAssignmentRequest;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryLocationRequest;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryStatusRequest;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class DeliveryService {

    private final DeliveryOrderRepository deliveryRepository;
    private final JobOrderRepository orderRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final FirestoreSyncService firestoreSyncService;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;

    public DeliveryService(
            DeliveryOrderRepository deliveryRepository,
            JobOrderRepository orderRepository,
            UserRepository userRepository,
            NotificationService notificationService,
            FirestoreSyncService firestoreSyncService,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties
    ) {
        this.deliveryRepository = deliveryRepository;
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
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
            resolvedPhone = driverUser.getEmail() != null ? driverUser.getEmail() : "-";
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
                .status(DeliveryStatus.PENDING_PICKUP)
                .build();

        DeliveryOrder saved = deliveryRepository.save(delivery);

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

        // Notify Driver by push — use linked User account if available, otherwise fallback to name lookup
        Optional<User> driverOpt = driverUser != null
                ? Optional.of(driverUser)
                : userRepository.findAllByRoleAndFullName(Role.DRIVER, saved.getDriverName()).stream().findFirst();

        driverOpt.ifPresent(driver -> {
            if (driver.getFcmToken() != null) {
                notificationService.enqueuePush(
                        driver.getFcmToken(),
                        "New Delivery Job Assigned",
                        "You have been assigned to order %s. Pickup at %s."
                                .formatted(saved.getJobOrder().getTrackingNumber(), saved.getJobOrder().getBranch()),
                        "DELIVERY_ASSIGNED",
                        String.valueOf(saved.getId())
                );
            }
        });

        firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    /** Driver-only: returns all deliveries assigned to the calling driver's account. */
    public List<DeliveryResponse> listMy(AuthUserDetails principal) {
        User driver = principal.getUser();
        return deliveryRepository.findByDriverUser_IdOrderByUpdatedAtDesc(driver.getId())
                .stream().map(this::toResponse).toList();
    }

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
            enforceStaffBranchScope(actor, response.branch());
            return response;
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            DeliveryOrder delivery = findDeliveryByIdMysql(deliveryId);
            enforceStaffBranchScope(actor, delivery.getJobOrder().getBranch());
            return toResponse(delivery);
        }

        throw new IllegalArgumentException("Delivery not found.");
    }

    public DeliveryResponse trackByTrackingNumber(String trackingNumber) {
        String normalized = normalizeTracking(trackingNumber);

        if (!dataReadProperties.prefersFirestoreReads()) {
            List<DeliveryOrder> deliveries = deliveryRepository.findByJobOrder_TrackingNumber(normalized);
            if (deliveries.isEmpty()) throw new IllegalArgumentException("Delivery not found.");
            return toResponse(deliveries.get(0));
        }

        Optional<DeliveryResponse> firestoreDelivery = firestoreReadService.findDeliveryByTracking(normalized);
        if (firestoreDelivery.isPresent()) {
            return firestoreDelivery.get();
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
        enforceStaffBranchScope(actor, delivery.getJobOrder().getBranch());

        if (delivery.getStatus() != req.status() && !isValidTransition(delivery.getStatus(), req.status())) {
            throw new IllegalStateException("Invalid delivery status transition from " + delivery.getStatus() + " to " + req.status() + ".");
        }
        delivery.setStatus(req.status());
        if (req.notes() != null) {
            delivery.setNotes(blankToNull(req.notes()));
        }

        DeliveryOrder saved = deliveryRepository.save(delivery);
        
        // Sync with Job Order status based on Leg
        JobOrder jobOrder = saved.getJobOrder();
        if (saved.getLeg() == DeliveryLeg.PICKUP_FROM_CUSTOMER) {
            if (saved.getStatus() == DeliveryStatus.PICKED_UP) {
                jobOrder.setStatus(JobOrderStatus.PICKED_UP); // In driver's hands
            } else if (saved.getStatus() == DeliveryStatus.DELIVERED) {
                jobOrder.setStatus(JobOrderStatus.WASHING); // Arrived at shop, ready to wash
            }
        } else if (saved.getLeg() == DeliveryLeg.DELIVERY_TO_CUSTOMER) {
            if (saved.getStatus() == DeliveryStatus.PICKED_UP) {
                jobOrder.setStatus(JobOrderStatus.PICKED_UP); // Out for delivery
            } else if (saved.getStatus() == DeliveryStatus.DELIVERED) {
                jobOrder.setStatus(JobOrderStatus.DELIVERED); // Finished entirely
            }
        }
        orderRepository.save(jobOrder);

        // Notify Customer
        notificationService.enqueueEmail(
                saved.getJobOrder().getCustomerEmail(),
                "WashAlert Delivery Status Update",
                "Tracking Number: %s\nDelivery status is now: %s"
                        .formatted(saved.getJobOrder().getTrackingNumber(), saved.getStatus()),
                "DELIVERY_STATUS",
                String.valueOf(saved.getId())
        );

        // Push notification to Customer
        userRepository.findByEmail(saved.getJobOrder().getCustomerEmail())
                .ifPresent(customer -> {
                    if (customer.getFcmToken() != null) {
                        String title = "Delivery Update";
                        String body = "Your laundry is now %s!".formatted(saved.getStatus().toString().toLowerCase().replace('_', ' '));
                        if (saved.getStatus() == DeliveryStatus.PICKED_UP) {
                             body = "Your driver has picked up your laundry and is now heading to you!";
                        } else if (saved.getStatus() == DeliveryStatus.DELIVERED) {
                             body = "Your laundry has been delivered. Thank you for using WashAlert!";
                        }
                        notificationService.enqueuePush(
                                customer.getFcmToken(),
                                title,
                                body,
                                "DELIVERY_UPDATE",
                                saved.getJobOrder().getTrackingNumber()
                        );
                    }
                });

        firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    @Transactional
    public DeliveryResponse updateAssignment(Long deliveryId, UpdateDeliveryAssignmentRequest req, AuthUserDetails principal) {
        DeliveryOrder delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> new IllegalArgumentException("Delivery not found."));

        User actor = principal.getUser();
        enforceStaffBranchScope(actor, delivery.getJobOrder().getBranch());

        delivery.setDriverName(req.driverName().trim());
        delivery.setDriverPhone(req.driverPhone().trim());
        delivery.setEstimatedArrivalAt(req.estimatedArrivalAt());
        if (req.notes() != null) {
            delivery.setNotes(blankToNull(req.notes()));
        }

        DeliveryOrder saved = deliveryRepository.save(delivery);
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
        firestoreSyncService.upsert("deliveries", saved.getJobOrder().getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
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

    private DeliveryResponse toResponse(DeliveryOrder d) {
        return new DeliveryResponse(
                d.getId(),
                d.getJobOrder().getTrackingNumber(),
                d.getJobOrder().getBranch(),
                d.getJobOrder().getCustomerName(),
                d.getJobOrder().getDeliveryAddress(),
                d.getDriverName(),
                d.getDriverPhone(),
                d.getLeg(),
                d.getStatus(),
                d.getCurrentLatitude(),
                d.getCurrentLongitude(),
                d.getEstimatedArrivalAt(),
                d.getNotes(),
                d.getUpdatedAt(),
                d.getJobOrder().getBranchLatitude(),
                d.getJobOrder().getBranchLongitude(),
                d.getJobOrder().getDeliveryLatitude(),
                d.getJobOrder().getDeliveryLongitude()
        );
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

    private boolean isValidTransition(DeliveryStatus from, DeliveryStatus to) {
        return switch (from) {
            case PENDING_PICKUP -> to == DeliveryStatus.EN_ROUTE_TO_PICKUP || to == DeliveryStatus.PICKED_UP || to == DeliveryStatus.IN_TRANSIT || to == DeliveryStatus.FAILED;
            case EN_ROUTE_TO_PICKUP -> to == DeliveryStatus.PICKED_UP || to == DeliveryStatus.IN_TRANSIT || to == DeliveryStatus.FAILED;
            case PICKED_UP -> to == DeliveryStatus.IN_TRANSIT || to == DeliveryStatus.DELIVERED || to == DeliveryStatus.FAILED;
            case IN_TRANSIT -> to == DeliveryStatus.DELIVERED || to == DeliveryStatus.FAILED;
            case DELIVERED, FAILED -> false;
        };
    }
}
