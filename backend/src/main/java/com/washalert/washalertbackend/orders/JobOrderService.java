package com.washalert.washalertbackend.orders;

import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.common.dto.PagedResponse;
import com.washalert.washalertbackend.delivery.DeliveryService;
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
import com.washalert.washalertbackend.payment.PaymentRecord;
import com.washalert.washalertbackend.payment.PaymentRecordRepository;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class JobOrderService {

    private final JobOrderRepository repo;
    private final JobOrderStatusHistoryRepository historyRepository;
    private final JobOrderTimelineService timelineService;
    private final NotificationService notificationService;
    private final FirestoreSyncService firestoreSyncService;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;
    private final PaymentRecordRepository paymentRepository;
    private final DeliveryService deliveryService;

    public JobOrderService(
            JobOrderRepository repo,
            JobOrderStatusHistoryRepository historyRepository,
            JobOrderTimelineService timelineService,
            NotificationService notificationService,
            FirestoreSyncService firestoreSyncService,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties,
            PaymentRecordRepository paymentRepository,
            DeliveryService deliveryService
    ) {
        this.repo = repo;
        this.historyRepository = historyRepository;
        this.timelineService = timelineService;
        this.notificationService = notificationService;
        this.firestoreSyncService = firestoreSyncService;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
        this.paymentRepository = paymentRepository;
        this.deliveryService = deliveryService;
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

    public PagedResponse<JobOrderResponse> listPaged(
            AuthUserDetails principal,
            String branch,
            String status,
            String search,
            String paymentStatus,
            String paymentMethod,
            LocalDate fromDate,
            LocalDate toDate,
            Pageable pageable
    ) {
        User actor = principal.getUser();
        String effectiveBranch = actor.getRole() == Role.STAFF ? actor.getBranch() : normalizeBranchFilter(branch);
        JobOrderStatus parsedStatus = parseOrderStatus(status);
        PaymentStatus parsedPaymentStatus = parsePaymentStatus(paymentStatus);
        boolean includeOrderPaid = parsedPaymentStatus == PaymentStatus.PAID;
        boolean includeImplicitPending = parsedPaymentStatus == PaymentStatus.PENDING;

        Page<JobOrder> page = repo.findPagedWithFilters(
                effectiveBranch,
                parsedStatus,
                normalizeSearch(search),
                parsedPaymentStatus,
                includeOrderPaid,
                includeImplicitPending,
                normalizeSearch(paymentMethod),
                atStartOfDay(fromDate),
                atEndOfDay(toDate),
                pageable
        );

        Map<Long, PaymentStatus> paymentStatusByOrderId = resolvePaymentStatusByOrderId(page.getContent());
        Page<JobOrderResponse> mapped = page.map(order -> toResponse(order, paymentStatusByOrderId.get(order.getId())));
        return PagedResponse.from(mapped);
    }

    public PagedResponse<JobOrderResponse> listMyPaged(
            AuthUserDetails principal,
            String statusGroup,
            String search,
            Pageable pageable
    ) {
        User actor = principal.getUser();
        if (actor.getRole() != Role.CUSTOMER) {
            throw new IllegalArgumentException("Only customers can access personal order history.");
        }

        String customerEmail = actor.getEmail();
        if (customerEmail == null || customerEmail.isBlank()) {
            throw new IllegalArgumentException("Missing customer email in session.");
        }

        List<JobOrderStatus> scopedStatuses = resolveCustomerStatusGroup(statusGroup);
        Page<JobOrder> page = repo.findCustomerOrdersPaged(
                customerEmail,
                normalizeSearch(search),
                scopedStatuses,
                scopedStatuses.isEmpty(),
                pageable
        );

        Map<Long, PaymentStatus> paymentStatusByOrderId = resolvePaymentStatusByOrderId(page.getContent());
        Page<JobOrderResponse> mapped = page.map(order -> toResponse(order, paymentStatusByOrderId.get(order.getId())));
        return PagedResponse.from(mapped);
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
                .branchId(actor.getBranchId())
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
        notificationService.enqueuePushToUserEmail(
                saved.getCustomerEmail(),
                "Order Created",
                "Your order %s has been created."
                        .formatted(saved.getTrackingNumber()),
                "ORDER_CREATED",
                saved.getTrackingNumber() + ":created"
        );
        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
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
        if (actor.getBranchId() != null) {
            order.setBranchId(actor.getBranchId());
        }

        JobOrder saved = repo.save(order);
        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
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
            String pushTitle = "Order Status Updated";
            String pushBody = "Order %s is now %s."
                    .formatted(jo.getTrackingNumber(), jo.getStatus().name().replace('_', ' '));
            String pushType = "ORDER_STATUS";
            if (jo.getStatus() == JobOrderStatus.READY) {
                pushTitle = "Laundry Ready";
                pushBody = "Your laundry for order %s is ready for pickup or delivery."
                        .formatted(jo.getTrackingNumber());
                pushType = "LAUNDRY_READY";
            }
            notificationService.enqueuePushToUserEmail(
                    jo.getCustomerEmail(),
                    pushTitle,
                    pushBody,
                    pushType,
                    jo.getTrackingNumber() + ":" + jo.getStatus().name()
            );

            if (jo.getStatus() == JobOrderStatus.READY) {
                deliveryService.initializePhaseB(jo);
            }
            deliveryService.syncWithOrderStatus(jo, actor.getEmail());
        }

        JobOrder saved = repo.save(jo);
        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional
    public JobOrderResponse markAsPaid(Long id, AuthUserDetails principal) {
        User actor = principal.getUser();
        JobOrder jo = findByIdOrThrow(id);
        enforceBranchScope(actor, jo.getBranch());

        jo.setPaid(true);
        jo.setUpdatedAt(LocalDateTime.now());
        JobOrder saved = repo.save(jo);
        JobOrderResponse response = toResponse(saved, PaymentStatus.PAID);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
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
        List<JobOrder> orders;
        if (actor.getRole() == Role.ADMIN) {
            orders = repo.findAllByOrderByCreatedAtDesc();
        } else {
            orders = repo.findByBranchIgnoreCaseOrderByCreatedAtDesc(actor.getBranch());
        }

        if (orders.isEmpty()) {
            return List.of();
        }

        Map<Long, PaymentStatus> paymentStatusByOrderId = resolvePaymentStatusByOrderId(orders);

        return orders.stream()
                .map(order -> toResponse(order, paymentStatusByOrderId.get(order.getId())))
                .toList();
    }

    private List<JobOrderResponse> listFromFirestore(User actor) {
        List<JobOrderResponse> scoped = firestoreReadService.listOrders().stream()
                .filter(order -> actor.getRole() == Role.ADMIN || safeEquals(actor.getBranch(), order.branch()))
                .sorted((a, b) -> compareDateDesc(a.createdAt(), b.createdAt()))
                .toList();

        if (scoped.isEmpty()) {
            return scoped;
        }

        Map<Long, PaymentStatus> paymentStatusByOrderId = paymentRepository
                .findByJobOrder_IdIn(
                        scoped.stream()
                                .map(JobOrderResponse::id)
                                .filter(id -> id != null)
                                .toList()
                )
                .stream()
                .filter(record -> record.getJobOrder() != null && record.getJobOrder().getId() != null)
                .collect(Collectors.toMap(
                        record -> record.getJobOrder().getId(),
                        PaymentRecord::getStatus,
                        (left, right) -> right
                ));

        return scoped.stream()
                .map(order -> withPaymentStatus(order, paymentStatusByOrderId.get(order.id())))
                .toList();
    }

    private Map<Long, PaymentStatus> resolvePaymentStatusByOrderId(Collection<JobOrder> orders) {
        if (orders == null || orders.isEmpty()) return Map.of();
        return paymentRepository
                .findByJobOrder_IdIn(
                        orders.stream()
                                .map(JobOrder::getId)
                                .filter(id -> id != null)
                                .toList()
                )
                .stream()
                .filter(record -> record.getJobOrder() != null && record.getJobOrder().getId() != null)
                .collect(Collectors.toMap(
                        record -> record.getJobOrder().getId(),
                        PaymentRecord::getStatus,
                        (left, right) -> right
                ));
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
        PaymentStatus paymentStatus = paymentRepository.findByJobOrder_TrackingNumber(jo.getTrackingNumber())
                .map(PaymentRecord::getStatus)
                .orElse(null);
        return toResponse(jo, paymentStatus);
    }

    private JobOrderResponse toResponse(JobOrder jo, PaymentStatus paymentStatus) {
        PaymentStatus effectivePaymentStatus = resolvePaymentStatus(jo.isPaid(), paymentStatus);
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
                effectivePaymentStatus,
                jo.getDeliveryLatitude(),
                jo.getDeliveryLongitude(),
                jo.getDeliveryUnitFloor(),
                jo.getDeliveryContactName(),
                jo.getDeliveryContactPhone(),
                jo.getBranchLatitude(),
                jo.getBranchLongitude()
        );
    }

    private JobOrderResponse withPaymentStatus(JobOrderResponse response, PaymentStatus paymentStatus) {
        PaymentStatus effectivePaymentStatus = resolvePaymentStatus(response.isPaid(), paymentStatus);
        return new JobOrderResponse(
                response.id(),
                response.trackingNumber(),
                response.customerName(),
                response.branch(),
                response.status(),
                response.createdAt(),
                response.updatedAt(),
                response.serviceType(),
                response.bookingDate(),
                response.slotStartTime(),
                response.slotEndTime(),
                response.detergentPreference(),
                response.fabricConditionerPreference(),
                response.loadSize(),
                response.estimatedWeightKg(),
                response.specialInstructions(),
                response.customerPhone(),
                response.customerEmail(),
                response.deliveryAddress(),
                response.servicePrice(),
                response.suppliesPrice(),
                response.deliveryPrice(),
                response.totalPrice(),
                response.isPaid(),
                response.paymentMethod(),
                effectivePaymentStatus,
                response.deliveryLatitude(),
                response.deliveryLongitude(),
                response.deliveryUnitFloor(),
                response.deliveryContactName(),
                response.deliveryContactPhone(),
                response.branchLatitude(),
                response.branchLongitude()
        );
    }

    private PaymentStatus resolvePaymentStatus(boolean orderPaid, PaymentStatus paymentStatus) {
        if (paymentStatus != null) {
            return paymentStatus;
        }
        return orderPaid ? PaymentStatus.PAID : null;
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

    private String normalizeBranchFilter(String branch) {
        if (branch == null || branch.isBlank() || "ALL".equalsIgnoreCase(branch.trim())) return null;
        return branch.trim();
    }

    private String normalizeSearch(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private JobOrderStatus parseOrderStatus(String status) {
        String normalized = normalizeSearch(status);
        if (normalized == null) return null;
        try {
            return JobOrderStatus.valueOf(normalized.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid order status filter.");
        }
    }

    private PaymentStatus parsePaymentStatus(String paymentStatus) {
        String normalized = normalizeSearch(paymentStatus);
        if (normalized == null) return null;
        try {
            return PaymentStatus.valueOf(normalized.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Invalid payment status filter.");
        }
    }

    private LocalDateTime atStartOfDay(LocalDate date) {
        if (date == null) return null;
        return date.atStartOfDay();
    }

    private LocalDateTime atEndOfDay(LocalDate date) {
        if (date == null) return null;
        return date.atTime(LocalTime.MAX);
    }

    private List<JobOrderStatus> resolveCustomerStatusGroup(String statusGroup) {
        String normalized = normalizeSearch(statusGroup);
        if (normalized == null || "all".equalsIgnoreCase(normalized)) return List.of();
        return switch (normalized.toLowerCase()) {
            case "active" -> List.of(
                    JobOrderStatus.PENDING,
                    JobOrderStatus.WASHING,
                    JobOrderStatus.DRYING,
                    JobOrderStatus.READY,
                    JobOrderStatus.PICKED_UP
            );
            case "completed" -> List.of(JobOrderStatus.DELIVERED);
            case "cancelled", "canceled" -> List.of(JobOrderStatus.CANCELLED);
            default -> throw new IllegalArgumentException("Invalid status group filter.");
        };
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
            default -> false;
        };
    }
}
