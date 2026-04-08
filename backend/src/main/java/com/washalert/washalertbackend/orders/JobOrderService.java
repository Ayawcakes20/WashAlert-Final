package com.washalert.washalertbackend.orders;

import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.dto.CreateJobOrderRequest;
import com.washalert.washalertbackend.orders.dto.DashboardSummaryResponse;
import com.washalert.washalertbackend.orders.dto.EditJobOrderRequest;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.orders.dto.OrderTrackingEventResponse;
import com.washalert.washalertbackend.orders.dto.OrderTrackingResponse;
import com.washalert.washalertbackend.orders.dto.UpdateJobOrderRequest;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class JobOrderService {

    private final JobOrderRepository repo;
    private final JobOrderStatusHistoryRepository historyRepository;
    private final JobOrderTimelineService timelineService;
    private final NotificationService notificationService;
    private final FirestoreSyncService firestoreSyncService;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;

    public JobOrderService(
            JobOrderRepository repo,
            JobOrderStatusHistoryRepository historyRepository,
            JobOrderTimelineService timelineService,
            NotificationService notificationService,
            FirestoreSyncService firestoreSyncService,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties
    ) {
        this.repo = repo;
        this.historyRepository = historyRepository;
        this.timelineService = timelineService;
        this.notificationService = notificationService;
        this.firestoreSyncService = firestoreSyncService;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
    }

    public List<JobOrderResponse> listAll(AuthUserDetails principal) {
        User actor = principal.getUser();

        if (!dataReadProperties.prefersFirestoreReads()) {
            return listFromMysql(actor);
        }

        List<JobOrderResponse> firestoreRows = listFromFirestore(actor);
        if (!firestoreRows.isEmpty()) {
            return firestoreRows;
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            return listFromMysql(actor);
        }

        return firestoreRows;
    }

    public JobOrderResponse getById(Long id, AuthUserDetails principal) {
        User actor = principal.getUser();

        if (!dataReadProperties.prefersFirestoreReads()) {
            JobOrder order = findByIdOrThrow(id);
            enforceBranchScope(actor, order.getBranch());
            return toResponse(order);
        }

        Optional<JobOrderResponse> firestoreOrder = firestoreReadService.findOrderById(id);
        if (firestoreOrder.isPresent()) {
            JobOrderResponse order = firestoreOrder.get();
            enforceBranchScope(actor, order.branch());
            return order;
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            JobOrder order = findByIdOrThrow(id);
            enforceBranchScope(actor, order.getBranch());
            return toResponse(order);
        }

        throw new OrderNotFoundException("Job order not found.");
    }

    public List<JobOrderResponse> recent(AuthUserDetails principal) {
        return listAll(principal).stream().limit(10).toList();
    }

    public DashboardSummaryResponse summary(AuthUserDetails principal) {
        List<JobOrderResponse> all = listAll(principal);
        long pending = all.stream().filter(o -> o.status() == JobOrderStatus.PENDING).count();
        long washing = all.stream().filter(o -> o.status() == JobOrderStatus.WASHING).count();
        long drying = all.stream().filter(o -> o.status() == JobOrderStatus.DRYING).count();
        long ready = all.stream().filter(o -> o.status() == JobOrderStatus.READY).count();
        return new DashboardSummaryResponse(pending, washing, drying, ready, recent(principal));
    }

    public OrderTrackingResponse trackByTrackingNumber(String trackingNumber) {
        String cleanTracking = normalizeTrackingNumber(trackingNumber);

        if (!dataReadProperties.prefersFirestoreReads()) {
            return trackByTrackingNumberMysql(cleanTracking);
        }

        Optional<JobOrderResponse> firestoreOrder = firestoreReadService.findOrderByTracking(cleanTracking);
        if (firestoreOrder.isPresent()) {
            return toTrackingResponse(firestoreOrder.get());
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            return trackByTrackingNumberMysql(cleanTracking);
        }

        throw new OrderNotFoundException("Order not found.");
    }

    @Transactional
    public JobOrderResponse create(CreateJobOrderRequest req, AuthUserDetails principal) {
        User actor = principal.getUser();

        String branch = (req.branch() == null || req.branch().trim().isEmpty())
                ? actor.getBranch()
                : req.branch().trim();
        if (branch == null || branch.isBlank()) {
            throw new IllegalArgumentException("Branch is required.");
        }

        enforceBranchScope(actor, branch);

        JobOrder jo = JobOrder.builder()
                .trackingNumber("TMP-" + UUID.randomUUID())
                .customerName(req.customerName().trim())
                .branch(branch)
                .serviceType(req.serviceType())
                .status(JobOrderStatus.PENDING)
                .createdBy(actor)
                .createdAt(LocalDateTime.now())
                .build();

        repo.saveAndFlush(jo);

        jo.setTrackingNumber(formatTrackingNumber(jo.getId()));
        JobOrder saved = repo.save(jo);
        timelineService.log(saved, saved.getStatus(), actor.getEmail(), "Order created");
        notificationService.enqueueEmail(
                saved.getCustomerEmail(),
                "WashAlert Order Created",
                "Your order has been created.\nTracking Number: %s\nCurrent Status: %s"
                        .formatted(saved.getTrackingNumber(), saved.getStatus()),
                "ORDER",
                String.valueOf(saved.getId())
        );
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), toResponse(saved));

        return toResponse(saved);
    }

    @Transactional
    public JobOrderResponse update(Long id, EditJobOrderRequest req, AuthUserDetails principal) {
        User actor = principal.getUser();
        JobOrder order = findByIdOrThrow(id);

        enforceBranchScope(actor, order.getBranch());
        enforceBranchScope(actor, req.branch().trim());

        order.setCustomerName(req.customerName().trim());
        order.setServiceType(req.serviceType());
        order.setBranch(req.branch().trim());

        JobOrder saved = repo.save(order);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    @Transactional
    public JobOrderResponse updateStatus(Long id, UpdateJobOrderRequest req, AuthUserDetails principal) {
        User actor = principal.getUser();

        JobOrder jo = findByIdOrThrow(id);
        enforceBranchScope(actor, jo.getBranch());

        if (jo.getStatus() != req.status()) {
            if (!isValidTransition(jo.getStatus(), req.status())) {
                throw new IllegalStateException("Invalid job order status transition from " + jo.getStatus() + " to " + req.status() + ".");
            }
            jo.setStatus(req.status());
            timelineService.log(jo, jo.getStatus(), actor.getEmail(), "Status updated by staff/admin");
            notificationService.enqueueEmail(
                    jo.getCustomerEmail(),
                    "WashAlert Order Status Update",
                    "Tracking Number: %s\nYour order status is now: %s"
                            .formatted(jo.getTrackingNumber(), jo.getStatus()),
                    "ORDER_STATUS",
                    String.valueOf(jo.getId())
            );
        }

        JobOrder saved = repo.save(jo);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    @Transactional
    public JobOrderResponse markAsPaid(Long id, AuthUserDetails principal) {
        User actor = principal.getUser();
        JobOrder jo = findByIdOrThrow(id);
        enforceBranchScope(actor, jo.getBranch());

        jo.setPaid(true);
        jo.setUpdatedAt(LocalDateTime.now());
        JobOrder saved = repo.save(jo);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), toResponse(saved));
        return toResponse(saved);
    }

    @Transactional
    public void delete(Long id) {
        JobOrder jo = findByIdOrThrow(id);
        repo.delete(jo);
        firestoreSyncService.delete("orders", jo.getTrackingNumber());
    }

    private JobOrder findByIdOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new OrderNotFoundException("Job order not found."));
    }

    private List<JobOrderResponse> listFromMysql(User actor) {
        if (actor.getRole() == Role.ADMIN) {
            return repo.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
        }

        return repo.findByBranchIgnoreCaseOrderByCreatedAtDesc(actor.getBranch())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private List<JobOrderResponse> listFromFirestore(User actor) {
        return firestoreReadService.listOrders().stream()
                .filter(order -> actor.getRole() == Role.ADMIN || safeEquals(actor.getBranch(), order.branch()))
                .sorted((a, b) -> compareDateDesc(a.createdAt(), b.createdAt()))
                .toList();
    }

    private OrderTrackingResponse trackByTrackingNumberMysql(String cleanTracking) {
        JobOrder order = repo.findByTrackingNumber(cleanTracking)
                .orElseThrow(() -> new OrderNotFoundException("Order not found."));

        List<OrderTrackingEventResponse> timeline = historyRepository
                .findByJobOrder_TrackingNumberOrderByChangedAtAsc(cleanTracking)
                .stream()
                .map(h -> new OrderTrackingEventResponse(
                        h.getStatus(),
                        h.getChangedAt(),
                        h.getChangedBy(),
                        h.getNotes()
                ))
                .toList();
        if (timeline.isEmpty()) {
            timeline = List.of(new OrderTrackingEventResponse(
                    order.getStatus(),
                    order.getUpdatedAt(),
                    "system",
                    "Current order status"
            ));
        }

        return new OrderTrackingResponse(
                order.getTrackingNumber(),
                order.getCustomerName(),
                order.getBranch(),
                order.getServiceType(),
                order.getStatus(),
                order.getBookingDate(),
                order.getSlotStartTime(),
                order.getSlotEndTime(),
                order.getUpdatedAt(),
                timeline
        );
    }

    private OrderTrackingResponse toTrackingResponse(JobOrderResponse order) {
        LocalDateTime changedAt = order.updatedAt() != null
                ? order.updatedAt()
                : (order.createdAt() != null ? order.createdAt() : LocalDateTime.now());

        List<OrderTrackingEventResponse> timeline = List.of(
                new OrderTrackingEventResponse(order.status(), changedAt, "system", "Current order status")
        );

        return new OrderTrackingResponse(
                order.trackingNumber(),
                order.customerName(),
                order.branch(),
                order.serviceType(),
                order.status(),
                order.bookingDate(),
                order.slotStartTime(),
                order.slotEndTime(),
                changedAt,
                timeline
        );
    }

    private void enforceBranchScope(User actor, String branch) {
        if (actor.getRole() == Role.STAFF && !safeEquals(actor.getBranch(), branch)) {
            throw new IllegalArgumentException("You can only manage job orders in your branch.");
        }
    }

    private JobOrderResponse toResponse(JobOrder jo) {
        return new JobOrderResponse(
                jo.getId(),
                jo.getTrackingNumber(),
                jo.getCustomerName(),
                jo.getBranch(),
                jo.getStatus(),
                jo.getCreatedAt(),
                jo.getUpdatedAt(),
                jo.getServiceType(),
                jo.getBookingDate(),
                jo.getSlotStartTime(),
                jo.getSlotEndTime(),
                jo.getDetergentPreference(),
                jo.getFabricConditionerPreference(),
                jo.getLoadSize(),
                jo.getEstimatedWeightKg(),
                jo.getSpecialInstructions(),
                jo.getCustomerPhone(),
                jo.getCustomerEmail(),
                jo.getDeliveryAddress(),
                jo.getServicePrice(),
                jo.getSuppliesPrice(),
                jo.getDeliveryPrice(),
                jo.getTotalPrice(),
                jo.isPaid(),
                jo.getPaymentMethod(),
                jo.getDeliveryLatitude(),
                jo.getDeliveryLongitude(),
                jo.getBranchLatitude(),
                jo.getBranchLongitude()
        );
    }

    private String formatTrackingNumber(Long id) {
        if (id == null) {
            throw new IllegalStateException("Job order ID was not generated.");
        }
        return "WA-" + (10000 + id);
    }

    private String normalizeTrackingNumber(String trackingNumber) {
        if (trackingNumber == null || trackingNumber.isBlank()) {
            throw new IllegalArgumentException("Tracking number is required.");
        }
        return trackingNumber.trim().toUpperCase();
    }

    private boolean safeEquals(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
    }

    private int compareDateDesc(LocalDateTime a, LocalDateTime b) {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return b.compareTo(a);
    }

    private boolean isValidTransition(JobOrderStatus from, JobOrderStatus to) {
        return switch (from) {
            case PENDING -> to == JobOrderStatus.WASHING;
            case WASHING -> to == JobOrderStatus.DRYING;
            case DRYING -> to == JobOrderStatus.READY;
            case READY -> to == JobOrderStatus.PICKED_UP;
            case PICKED_UP -> to == JobOrderStatus.DELIVERED;
            case DELIVERED -> false;
            case CANCELLED -> false;
        };
    }
}
