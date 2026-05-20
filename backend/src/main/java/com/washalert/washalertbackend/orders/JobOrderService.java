package com.washalert.washalertbackend.orders;

import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.common.dto.PagedResponse;
import com.washalert.washalertbackend.delivery.DeliveryService;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.booking.PricingService;
import com.washalert.washalertbackend.inventory.InventoryService;
import com.washalert.washalertbackend.machines.MachineRepository;
import com.washalert.washalertbackend.machines.MachineStatus;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.dto.CreateJobOrderRequest;
import com.washalert.washalertbackend.orders.dto.DashboardSummaryResponse;
import com.washalert.washalertbackend.orders.dto.EditJobOrderRequest;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.orders.dto.OrderTrackingEventResponse;
import com.washalert.washalertbackend.orders.dto.OrderTrackingResponse;
import com.washalert.washalertbackend.orders.dto.SetPriceRequest;
import com.washalert.washalertbackend.orders.dto.UpdateJobOrderRequest;
import com.washalert.washalertbackend.payment.PaymentRecord;
import com.washalert.washalertbackend.payment.PaymentRecordRepository;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import com.washalert.washalertbackend.orders.dto.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.washalert.washalertbackend.user.UserStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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
    private final UserRepository userRepository;
    private final InventoryService inventoryService;
    private final MachineRepository machineRepository;
    private final PricingService pricingService;

    public JobOrderService(
            JobOrderRepository repo,
            JobOrderStatusHistoryRepository historyRepository,
            JobOrderTimelineService timelineService,
            NotificationService notificationService,
            FirestoreSyncService firestoreSyncService,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties,
            PaymentRecordRepository paymentRepository,
            DeliveryService deliveryService,
            UserRepository userRepository,
            InventoryService inventoryService,
            MachineRepository machineRepository,
            PricingService pricingService) {
        this.repo = repo;
        this.historyRepository = historyRepository;
        this.timelineService = timelineService;
        this.notificationService = notificationService;
        this.firestoreSyncService = firestoreSyncService;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
        this.paymentRepository = paymentRepository;
        this.deliveryService = deliveryService;
        this.userRepository = userRepository;
        this.inventoryService = inventoryService;
        this.machineRepository = machineRepository;
        this.pricingService = pricingService;
    }

    @Transactional(readOnly = true)
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

    @Transactional(readOnly = true)
    public PagedResponse<JobOrderResponse> listPaged(
            AuthUserDetails principal,
            String branch,
            String status,
            String search,
            String paymentStatus,
            String paymentMethod,
            LocalDate fromDate,
            LocalDate toDate,
            Pageable pageable) {
        User actor = principal.getUser();
        String effectiveBranch = actor.getRole() == Role.STAFF ? actor.getBranch() : normalizeBranchFilter(branch);
        String normalizedBranch = normalizeBranchName(effectiveBranch);

        List<JobOrderStatus> parsedStatuses = parseOrderStatuses(status);
        boolean statusesEmpty = parsedStatuses.isEmpty();

        PaymentStatus parsedPaymentStatus = parsePaymentStatus(paymentStatus);
        boolean includeOrderPaid = parsedPaymentStatus == PaymentStatus.PAID;
        boolean includeImplicitPending = parsedPaymentStatus == PaymentStatus.PENDING;

        Page<JobOrder> page = repo.findPagedWithFilters(
                normalizedBranch,
                parsedStatuses,
                statusesEmpty,
                normalizeSearch(search),
                parsedPaymentStatus,
                includeOrderPaid,
                includeImplicitPending,
                normalizeSearch(paymentMethod),
                atStartOfDay(fromDate),
                atEndOfDay(toDate),
                pageable);

        Map<Long, PaymentStatus> paymentStatusByOrderId = resolvePaymentStatusByOrderId(page.getContent());
        Page<JobOrderResponse> mapped = page.map(order -> toResponse(order, paymentStatusByOrderId.get(order.getId())));
        return PagedResponse.from(mapped);
    }

    private List<JobOrderStatus> parseOrderStatuses(String status) {
        String normalized = normalizeSearch(status);
        if (normalized == null || "all".equalsIgnoreCase(normalized))
            return List.of();

        return Arrays.stream(normalized.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try {
                        return JobOrderStatus.valueOf(s.toUpperCase());
                    } catch (IllegalArgumentException ex) {
                        throw new IllegalArgumentException("Invalid order status: " + s);
                    }
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PagedResponse<JobOrderResponse> listMyPaged(
            AuthUserDetails principal,
            String statusGroup,
            String search,
            Pageable pageable) {
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
                pageable);

        Map<Long, PaymentStatus> paymentStatusByOrderId = resolvePaymentStatusByOrderId(page.getContent());
        Page<JobOrderResponse> mapped = page.map(order -> toResponse(order, paymentStatusByOrderId.get(order.getId())));
        return PagedResponse.from(mapped);
    }

    @Transactional(readOnly = true)
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
            enforceBranchScope(actor, order.getBranch());
            return order;
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            JobOrder order = findByIdOrThrow(id);
            enforceBranchScope(actor, order.getBranch());
            return toResponse(order);
        }

        throw new OrderNotFoundException("Job order not found.");
    }

    @Transactional(readOnly = true)
    public List<JobOrderResponse> recent(AuthUserDetails principal) {
        return listAll(principal).stream().limit(10).toList();
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public DashboardSummaryResponse summary(AuthUserDetails principal) {
        List<JobOrderResponse> all = listAll(principal);
        long pending = all.stream().filter(o -> o.getStatus() == JobOrderStatus.PENDING).count();
        long washing = all.stream().filter(o -> o.getStatus() == JobOrderStatus.WASHING).count();
        long drying = all.stream().filter(o -> o.getStatus() == JobOrderStatus.DRYING).count();
        long ready = all.stream().filter(o -> o.getStatus() == JobOrderStatus.READY).count();
        return new DashboardSummaryResponse(pending, washing, drying, ready, recent(principal));
    }

    @Transactional(readOnly = true)
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

        if (req.serviceType() == ServiceType.PICKUP_DELIVERY
                && (req.deliveryAddress() == null || req.deliveryAddress().isBlank())) {
            throw new IllegalArgumentException("Delivery address is required for pickup and delivery orders.");
        }

        JobOrder jo = JobOrder.builder()
                .trackingNumber("TMP-" + UUID.randomUUID())
                .customerName(req.customerName().trim())
                .customerPhone(req.customerPhone())
                .customerEmail(req.customerEmail())
                .deliveryAddress(req.deliveryAddress())
                .deliveryContactName(req.deliveryContactName())
                .deliveryContactPhone(req.deliveryContactPhone())
                .paymentMethod(req.paymentMethod())
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
                String.valueOf(saved.getId()));
        notificationService.enqueuePushToUserEmail(
                saved.getCustomerEmail(),
                "Order Created",
                "Your order %s has been created."
                        .formatted(saved.getTrackingNumber()),
                "ORDER_CREATED",
                saved.getTrackingNumber() + ":created");
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
        order.setCustomerPhone(req.customerPhone());
        order.setCustomerEmail(req.customerEmail());
        order.setDeliveryAddress(req.deliveryAddress());
        order.setDeliveryContactName(req.deliveryContactName());
        order.setDeliveryContactPhone(req.deliveryContactPhone());
        order.setPaymentMethod(req.paymentMethod());
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
                throw new IllegalStateException(
                        "Invalid job order status transition from " + jo.getStatus() + " to " + req.status() + ".");
            }
            // Block DELIVERED for online (GCash) orders that have not been paid yet.
            if (req.status() == JobOrderStatus.DELIVERED) {
                String pm = jo.getPaymentMethod();
                boolean isOnlinePayment = pm != null && pm.toUpperCase().contains("GCASH");
                if (isOnlinePayment && !jo.isPaid()) {
                    throw new IllegalStateException(
                            "Payment must be verified before marking this order as delivered. "
                            + "Ask the customer to complete their GCash payment first.");
                }
                // If staff confirms COD collection at delivery time, mark the order as paid.
                if (Boolean.TRUE.equals(req.codCollected()) && !jo.isPaid()) {
                    jo.setPaid(true);
                    jo.setCodCollected(true);
                    jo.setCodCollectedAt(java.time.LocalDateTime.now());
                    paymentRepository.findByJobOrder_TrackingNumber(jo.getTrackingNumber())
                            .filter(pr -> pr.getStatus() != com.washalert.washalertbackend.payment.PaymentStatus.PAID)
                            .ifPresent(pr -> {
                                pr.setStatus(com.washalert.washalertbackend.payment.PaymentStatus.PAID);
                                pr.setVerifiedAt(java.time.LocalDateTime.now());
                                pr.setVerifiedBy("Staff — COD collected");
                                paymentRepository.save(pr);
                            });
                }
            }
            jo.setStatus(req.status());
            if (req.status() == JobOrderStatus.WASHING) {
                // Block WASHING for GCash orders that have not paid yet.
                // COD orders may proceed to washing before collection.
                String pmCheck = jo.getPaymentMethod();
                if (pmCheck != null && pmCheck.toUpperCase().contains("GCASH") && !jo.isPaid()) {
                    throw new IllegalStateException(
                            "GCash payment must be confirmed before washing can start. "
                            + "Please wait for the customer's GCash payment to be verified.");
                }
                int detQty = (jo.getDetergentQuantity() != null && jo.getDetergentQuantity() > 0)
                        ? jo.getDetergentQuantity() : 1;
                int conQty = (jo.getConditionerQuantity() != null && jo.getConditionerQuantity() > 0)
                        ? jo.getConditionerQuantity() : 1;
                // Validate load-count and dry-only rules against what is stored on the order.
                pricingService.validateAddonQuantities(
                        jo.getServiceName(),
                        jo.getEstimatedWeightKg(),
                        jo.getDetergentPreference(),
                        detQty,
                        jo.getFabricConditionerPreference(),
                        conQty
                );
                // Re-validate inventory availability in case stock changed since booking.
                inventoryService.validateSuppliesForBooking(
                        jo.getBranch(),
                        jo.getDetergentPreference(),
                        jo.getFabricConditionerPreference(),
                        detQty,
                        conQty
                );
                inventoryService.deductForOrder(jo);
            }
            timelineService.log(jo, jo.getStatus(), actor.getEmail(), "Status updated by staff/admin");
            notificationService.enqueueEmail(
                    jo.getCustomerEmail(),
                    "WashAlert Order Status Update",
                    "Tracking Number: %s\nYour order status is now: %s"
                            .formatted(jo.getTrackingNumber(), jo.getStatus()),
                    "ORDER_STATUS",
                    String.valueOf(jo.getId()));
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
                    jo.getTrackingNumber() + ":" + jo.getStatus().name());

            if (jo.getStatus() == JobOrderStatus.READY) {
                try {
                    deliveryService.initializePhaseB(jo);
                } catch (DataIntegrityViolationException ex) {
                    throw new IllegalStateException(
                            "Unable to move order to Ready for Pickup due to delivery initialization constraints.");
                }
            }
            deliveryService.syncWithOrderStatus(jo, actor.getEmail());
        }

        JobOrder saved = repo.save(jo);
        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsertBlocking("orders", saved.getTrackingNumber(), response);
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
        JobOrderResponse response = toResponse(jo, PaymentStatus.PAID);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional
    public void delete(Long id) {
        JobOrder jo = findByIdOrThrow(id);
        repo.delete(jo);
        firestoreSyncService.delete("orders", jo.getTrackingNumber());
    }

    // ── PRICE CONFIRMATION FLOW ───────────────────────────────────────────────

    /**
     * Staff weighs the laundry and sets the actual price.
     * Advances order to AWAITING_PRICE_CONFIRMATION.
     * Fires an FCM push to the customer so the Price Confirmation modal appears.
     * Sets a 1-hour auto-proceed deadline.
     */
    @Transactional
    public JobOrderResponse setActualWeight(Long id, SetPriceRequest req, AuthUserDetails principal) {
        User actor = principal.getUser();
        JobOrder jo = findByIdOrThrow(id);
        enforceBranchScope(actor, jo.getBranch());

        // Allow from PENDING or ORDER_RECEIVED
        // Allow setting weight if PENDING, ORDER_RECEIVED, or already
        // AWAITING_PRICE_CONFIRMATION (to allow corrections)
        if (jo.getStatus() != JobOrderStatus.PENDING &&
                jo.getStatus() != JobOrderStatus.ORDER_RECEIVED &&
                jo.getStatus() != JobOrderStatus.AWAITING_PRICE_CONFIRMATION) {
            throw new IllegalStateException(
                    "Can only set weight for orders in PENDING, RECEIVED, or AWAITING_CONFIRMATION status. Current status: "
                            + jo.getStatus());
        }

        jo.setActualWeightKg(req.actualWeightKg());
        jo.setFinalPrice(req.finalPrice());
        if (req.deliveryFee() != null) {
            jo.setDeliveryPrice(req.deliveryFee());
        }
        jo.setTotalPrice(
                req.finalPrice().add(req.deliveryFee() != null ? req.deliveryFee() : java.math.BigDecimal.ZERO));
        jo.setStatus(JobOrderStatus.AWAITING_PRICE_CONFIRMATION);
        jo.setPriceConfirmationDeadline(LocalDateTime.now().plusMinutes(40));

        timelineService.log(jo, jo.getStatus(), actor.getEmail(),
                "Staff set actual weight: " + req.actualWeightKg() + "kg, final price: ₱" + req.finalPrice());

        String formattedWeight = req.actualWeightKg().stripTrailingZeros().toPlainString();
        String formattedTotal = jo.getTotalPrice().stripTrailingZeros().toPlainString();

        notificationService.enqueuePushToUserEmail(
                jo.getCustomerEmail(),
                "WashAlert — Receipt Ready",
                "Order %s: %skg | Total: ₱%s. Tap to view your receipt and confirm washing."
                        .formatted(jo.getTrackingNumber(), formattedWeight, formattedTotal),
                "PRICE_CONFIRMATION_REQUIRED",
                jo.getId() + ":" + jo.getTrackingNumber());
        notificationService.enqueueEmail(
                jo.getCustomerEmail(),
                "WashAlert — Price Confirmation Required",
                "Your laundry order " + jo.getTrackingNumber() + " has been weighed.\n"
                        + "Actual weight: " + formattedWeight + " kg\n"
                        + "Total amount: ₱" + formattedTotal + "\n\n"
                        + "Please open the WashAlert app to confirm. "
                        + "If no response is received within 40 minutes, washing will begin automatically.",
                "PRICE_CONFIRMATION",
                String.valueOf(jo.getId()));

        JobOrder saved = repo.save(jo);
        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    /**
     * Customer explicitly confirms the price.
     * Advances order to WASHING.
     */
    @Transactional
    public JobOrderResponse confirmPrice(Long id, AuthUserDetails principal) {
        User actor = principal.getUser();
        JobOrder jo = findByIdOrThrow(id);

        // Customers can only confirm their own orders
        if (jo.getCustomerEmail() == null || !jo.getCustomerEmail().equalsIgnoreCase(actor.getEmail())) {
            throw new IllegalArgumentException("You can only confirm your own orders.");
        }

        if (jo.getStatus() == JobOrderStatus.PRICE_CONFIRMED) {
            return toResponse(jo);
        }

        if (jo.getStatus() != JobOrderStatus.AWAITING_PRICE_CONFIRMATION) {
            throw new IllegalStateException(
                    "Order is not awaiting price confirmation. Current status: " + jo.getStatus());
        }

        // Advance to PRICE_CONFIRMED.
        jo.setStatus(JobOrderStatus.PRICE_CONFIRMED);
        jo.setPriceConfirmedByCustomer(true);
        jo.setPriceConfirmedAt(LocalDateTime.now());
        timelineService.log(jo, jo.getStatus(), actor.getEmail(), "Price confirmed by customer. Ready for washing.");

        notificationService.enqueuePushToRoles(
                List.of(Role.STAFF),
                jo.getBranch(),
                "Price Confirmed",
                "Customer confirmed price for Order #" + jo.getTrackingNumber() + ". You may begin washing.",
                "ORDER_STATUS_STAFF",
                jo.getTrackingNumber() + ":WASHING_CONFIRMED");

        JobOrder saved = repo.save(jo);
        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
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

    @Transactional(readOnly = true)
    private List<JobOrderResponse> listFromFirestore(User actor) {
        List<JobOrderResponse> scoped = firestoreReadService.listOrders().stream()
                .filter(order -> actor.getRole() == Role.ADMIN || safeEquals(actor.getBranch(), order.getBranch()))
                .sorted((a, b) -> compareDateDesc(a.getCreatedAt(), b.getCreatedAt()))
                .toList();

        if (scoped.isEmpty()) {
            return scoped;
        }

        Map<Long, PaymentStatus> paymentStatusByOrderId = paymentRepository
                .findByJobOrder_IdIn(
                        scoped.stream()
                                .map(JobOrderResponse::getId)
                                .filter(id -> id != null)
                                .toList())
                .stream()
                .filter(record -> record.getJobOrder() != null && record.getJobOrder().getId() != null)
                .collect(Collectors.toMap(
                        record -> record.getJobOrder().getId(),
                        PaymentRecord::getStatus,
                        (left, right) -> right));

        return scoped.stream()
                .map(order -> withPaymentStatus(order, paymentStatusByOrderId.get(order.getId())))
                .toList();
    }

    private Map<Long, PaymentStatus> resolvePaymentStatusByOrderId(Collection<JobOrder> orders) {
        if (orders == null || orders.isEmpty())
            return Map.of();
        return paymentRepository
                .findByJobOrder_IdIn(
                        orders.stream()
                                .map(JobOrder::getId)
                                .filter(id -> id != null)
                                .toList())
                .stream()
                .filter(record -> record.getJobOrder() != null && record.getJobOrder().getId() != null)
                .collect(Collectors.toMap(
                        record -> record.getJobOrder().getId(),
                        PaymentRecord::getStatus,
                        // Prefer the most authoritative status: PAID/VERIFIED > PENDING > others
                        (left, right) -> {
                            int lw = statusWeight(left);
                            int rw = statusWeight(right);
                            return lw >= rw ? left : right;
                        }));
    }

    private static int statusWeight(PaymentStatus s) {
        if (s == null) return 0;
        return switch (s) {
            case PAID, VERIFIED -> 3;
            case PENDING -> 1;
            default -> 0;
        };
    }

    @Transactional(readOnly = true)
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
                        h.getNotes()))
                .toList();
        if (timeline.isEmpty()) {
            timeline = List.of(new OrderTrackingEventResponse(
                    order.getStatus(),
                    order.getUpdatedAt(),
                    "system",
                    "Current order status"));
        }

        return new OrderTrackingResponse(
                order.getTrackingNumber(),
                order.getCustomerName(),
                order.getDeliveryContactName(),
                order.getDeliveryContactPhone(),
                order.getBranch(),
                order.getServiceType(),
                order.getStatus(),
                order.getBookingDate(),
                order.getSlotStartTime(),
                order.getSlotEndTime(),
                order.getUpdatedAt(),
                order.getCreatedBy() != null ? order.getCreatedBy().getFullName() : "System",
                timeline);
    }

    private OrderTrackingResponse toTrackingResponse(JobOrderResponse order) {
        LocalDateTime changedAt = order.getUpdatedAt() != null
                ? order.getUpdatedAt()
                : (order.getCreatedAt() != null ? order.getCreatedAt() : LocalDateTime.now());

        List<OrderTrackingEventResponse> timeline = List.of(
                new OrderTrackingEventResponse(order.getStatus(), changedAt, "system", "Current order status"));

        return new OrderTrackingResponse(
                order.getTrackingNumber(),
                order.getCustomerName(),
                order.getDeliveryContactName(),
                order.getDeliveryContactPhone(),
                order.getBranch(),
                order.getServiceType(),
                order.getStatus(),
                order.getBookingDate(),
                order.getSlotStartTime(),
                order.getSlotEndTime(),
                changedAt,
                order.getCreatedByName(),
                timeline);
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
        return JobOrderResponse.from(jo, effectivePaymentStatus);
    }

    private JobOrderResponse withPaymentStatus(JobOrderResponse response, PaymentStatus paymentStatus) {
        // Now using builder for a much safer 'copy-with'
        return JobOrderResponse.builder()
                .id(response.getId())
                .trackingNumber(response.getTrackingNumber())
                .customerName(response.getCustomerName())
                .branch(response.getBranch())
                .status(response.getStatus())
                .createdAt(response.getCreatedAt())
                .updatedAt(response.getUpdatedAt())
                .serviceType(response.getServiceType())
                .bookingDate(response.getBookingDate())
                .slotStartTime(response.getSlotStartTime())
                .slotEndTime(response.getSlotEndTime())
                .detergentPreference(response.getDetergentPreference())
                .fabricConditionerPreference(response.getFabricConditionerPreference())
                .serviceName(response.getServiceName())
                .loadSize(response.getLoadSize())
                .estimatedWeightKg(response.getEstimatedWeightKg())
                .specialInstructions(response.getSpecialInstructions())
                .customerPhone(response.getCustomerPhone())
                .customerEmail(response.getCustomerEmail())
                .deliveryAddress(response.getDeliveryAddress())
                .servicePrice(response.getServicePrice())
                .suppliesPrice(response.getSuppliesPrice())
                .deliveryPrice(response.getDeliveryPrice())
                .rushPrice(response.getRushPrice())
                .totalPrice(response.getTotalPrice())
                .isPaid(response.isPaid())
                .paymentMethod(response.getPaymentMethod())
                .paymentStatus(resolvePaymentStatus(response.isPaid(), paymentStatus))
                .deliveryLatitude(response.getDeliveryLatitude())
                .deliveryLongitude(response.getDeliveryLongitude())
                .deliveryUnitFloor(response.getDeliveryUnitFloor())
                .deliveryContactName(response.getDeliveryContactName())
                .deliveryContactPhone(response.getDeliveryContactPhone())
                .branchLatitude(response.getBranchLatitude())
                .branchLongitude(response.getBranchLongitude())
                .actualWeightKg(response.getActualWeightKg())
                .finalPrice(response.getFinalPrice())
                .priceConfirmationDeadline(response.getPriceConfirmationDeadline())
                .priceConfirmedAt(response.getPriceConfirmedAt())
                .priceConfirmedByCustomer(response.isPriceConfirmedByCustomer())
                .assignedDriverId(response.getAssignedDriverId())
                .assignedDriverName(response.getAssignedDriverName())
                .assignedAt(response.getAssignedAt())
                .pickupConfirmedAt(response.getPickupConfirmedAt())
                .deliveredAt(response.getDeliveredAt())
                .codCollected(response.isCodCollected())
                .codCollectedAt(response.getCodCollectedAt())
                .deliveryFailedReason(response.getDeliveryFailedReason())
                .driverLat(response.getDriverLat())
                .driverLng(response.getDriverLng())
                .build();
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
        if (branch == null || branch.isBlank() || "all".equalsIgnoreCase(branch.trim())) {
            return null;
        }
        return branch.trim();
    }

    private String normalizeBranchName(String branch) {
        if (branch == null) return null;
        String normalized = branch.trim().toUpperCase();
        if (normalized.endsWith(" BRANCH")) {
            normalized = normalized.substring(0, normalized.length() - 7).trim();
        }
        return normalized;
    }

    private String normalizeSearch(String value) {
        if (value == null)
            return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private JobOrderStatus parseOrderStatus(String status) {
        String normalized = normalizeSearch(status);
        if (normalized == null) return null;
        return JobOrderStatus.fromValueOrFallback(normalized, null);
    }

    private PaymentStatus parsePaymentStatus(String paymentStatus) {
        String normalized = normalizeSearch(paymentStatus);
        if (normalized == null)
            return null;
        try {
            return PaymentStatus.valueOf(normalized.toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private LocalDateTime atStartOfDay(LocalDate date) {
        if (date == null)
            return null;
        return date.atStartOfDay();
    }

    private LocalDateTime atEndOfDay(LocalDate date) {
        if (date == null)
            return null;
        return date.atTime(LocalTime.MAX);
    }

    private List<JobOrderStatus> resolveCustomerStatusGroup(String statusGroup) {
        String normalized = normalizeSearch(statusGroup);
        if (normalized == null || "all".equalsIgnoreCase(normalized))
            return List.of();
        return switch (normalized.toLowerCase()) {
            case "active" -> List.of(
                    JobOrderStatus.PENDING,
                    JobOrderStatus.WASHING,
                    JobOrderStatus.DRYING,
                    JobOrderStatus.READY,
                    JobOrderStatus.ORDER_RECEIVED);
            case "completed" -> List.of(JobOrderStatus.DELIVERED);
            case "cancelled", "canceled" -> List.of(JobOrderStatus.CANCELLED);
            default -> throw new IllegalArgumentException("Invalid status group filter.");
        };
    }

    private boolean safeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return normalizeBranchName(a).equals(normalizeBranchName(b));
    }

    private int compareDateDesc(LocalDateTime a, LocalDateTime b) {
        if (a == null && b == null)
            return 0;
        if (a == null)
            return 1;
        if (b == null)
            return -1;
        return b.compareTo(a);
    }

    @Transactional(readOnly = true)
    public PagedResponse<JobOrderResponse> listDriverTasks(AuthUserDetails principal, Pageable pageable) {
        User driver = principal.getUser();
        Page<JobOrder> page = repo.findDriverTasksPaged(
                driver,
                List.of(
                        JobOrderStatus.ASSIGNED_FOR_PICKUP,
                        JobOrderStatus.EN_ROUTE_TO_CUSTOMER,
                        JobOrderStatus.LAUNDRY_COLLECTED,
                        JobOrderStatus.EN_ROUTE_TO_BRANCH,
                        JobOrderStatus.ASSIGNED_FOR_DELIVERY,
                        JobOrderStatus.OUT_FOR_DELIVERY,
                        JobOrderStatus.COLLECTION_FAILED),
                pageable);
        Map<Long, PaymentStatus> paymentStatusByOrderId = resolvePaymentStatusByOrderId(page.getContent());
        Page<JobOrderResponse> mapped = page.map(order -> toResponse(order, paymentStatusByOrderId.get(order.getId())));
        return PagedResponse.from(mapped);
    }

    @Transactional
    public JobOrderResponse assignPickupRider(Long id, Long driverId, AuthUserDetails principal) {
        JobOrder order = findByIdOrThrow(id);
        if (order.getStatus() != JobOrderStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order must be PENDING to assign pickup rider.");
        }
        if (order.getServiceType() != ServiceType.PICKUP_DELIVERY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only PICKUP_DELIVERY orders require pickup assignment.");
        }
        User driver = userRepository.findById(driverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));

        order.setAssignedPickupDriver(driver);
        order.setStatus(JobOrderStatus.ASSIGNED_FOR_PICKUP);
        order.setAssignedAt(LocalDateTime.now());
        JobOrder saved = repo.save(order);

        String displayCust = (saved.getCustomerName() != null &&
                (saved.getCustomerName().toLowerCase().contains("jeya") ||
                        (saved.getCreatedBy() != null && saved.getCustomerName().toLowerCase()
                                .contains(saved.getCreatedBy().getFullName().toLowerCase().split(" ")[0]))))
                                        ? "Customer"
                                        : (saved.getCustomerName() != null ? saved.getCustomerName() : "Customer");

        notificationService.enqueuePushToUser(driver, "New pickup task",
                String.format("New pickup task — %s · %s · %s", saved.getTrackingNumber(), displayCust,
                        saved.getDeliveryAddress()),
                "ORDER", saved.getId().toString());

        notificationService.enqueuePushToUserEmail(saved.getCustomerEmail(), "Rider assigned",
                "Rider assigned — on the way to collect your laundry",
                "ORDER", saved.getId().toString());

        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional
    public JobOrderResponse startPickupLeg(Long id, AuthUserDetails principal) {
        JobOrder order = findByIdOrThrow(id);
        if (order.getStatus() != JobOrderStatus.ASSIGNED_FOR_PICKUP) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status for starting pickup leg.");
        }
        User driver = principal.getUser();
        if (order.getAssignedPickupDriver() == null
                || !order.getAssignedPickupDriver().getId().equals(driver.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not the assigned pickup rider.");
        }

        // Schedule guard: driver cannot start pickup before the booking date.
        LocalDate bookingDate = order.getBookingDate();
        if (bookingDate != null && bookingDate.isAfter(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This pickup is scheduled for " + bookingDate
                    + ". You can only start pickup on or after the day of the booking.");
        }

        order.setStatus(JobOrderStatus.EN_ROUTE_TO_CUSTOMER);
        JobOrder saved = repo.save(order);

        notificationService.enqueuePushToRoles(List.of(Role.STAFF, Role.ADMIN), saved.getBranch(),
                "Driver started pickup",
                String.format("%s heading to customer for %s", driver.getFullName(), saved.getTrackingNumber()),
                "ORDER", saved.getId().toString());

        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional
    public JobOrderResponse confirmLaundryCollected(Long id, AuthUserDetails principal) {
        JobOrder order = findByIdOrThrow(id);
        if (order.getStatus() != JobOrderStatus.EN_ROUTE_TO_CUSTOMER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status for laundry collection.");
        }
        User driver = principal.getUser();
        if (order.getAssignedPickupDriver() == null
                || !order.getAssignedPickupDriver().getId().equals(driver.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not the assigned pickup rider.");
        }

        order.setStatus(JobOrderStatus.LAUNDRY_COLLECTED);
        order.setLaundryCollectedAt(LocalDateTime.now());
        JobOrder saved = repo.save(order);

        notificationService.enqueuePushToUserEmail(saved.getCustomerEmail(), "Laundry collected",
                "Laundry collected — heading to branch",
                "ORDER", saved.getId().toString());

        notificationService.enqueuePushToRoles(List.of(Role.STAFF, Role.ADMIN), saved.getBranch(),
                "Laundry collected",
                String.format("%s laundry collected, driver en route to branch", saved.getTrackingNumber()),
                "ORDER", saved.getId().toString());

        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional
    public JobOrderResponse confirmArrivedAtBranch(Long id, AuthUserDetails principal) {
        JobOrder order = findByIdOrThrow(id);
        if (order.getStatus() != JobOrderStatus.LAUNDRY_COLLECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status for branch arrival.");
        }
        User driver = principal.getUser();
        if (order.getAssignedPickupDriver() == null
                || !order.getAssignedPickupDriver().getId().equals(driver.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not the assigned pickup rider.");
        }

        order.setStatus(JobOrderStatus.ORDER_RECEIVED);
        order.setArrivedAtBranchAt(LocalDateTime.now());
        JobOrder saved = repo.save(order);

        notificationService.enqueuePushToRoles(List.of(Role.STAFF, Role.ADMIN), saved.getBranch(),
                "Laundry arrived at branch",
                String.format("%s laundry arrived at branch. Weigh and set price to proceed.",
                        saved.getTrackingNumber()),
                "ORDER", saved.getId().toString());

        notificationService.enqueuePushToUserEmail(saved.getCustomerEmail(), "Arrived at branch",
                String.format("Your laundry is now at %s. Staff will send you the final price shortly.",
                        saved.getBranch()),
                "ORDER", saved.getId().toString());

        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional
    public JobOrderResponse assignDeliveryRider(Long id, Long driverId, AuthUserDetails principal) {
        JobOrder order = findByIdOrThrow(id);
        if (order.getStatus() != JobOrderStatus.READY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order must be READY to assign delivery rider.");
        }
        User driver = userRepository.findById(driverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Driver not found."));

        order.setAssignedDeliveryDriver(driver);
        order.setStatus(JobOrderStatus.ASSIGNED_FOR_DELIVERY);
        order.setAssignedAt(LocalDateTime.now());
        JobOrder saved = repo.save(order);

        notificationService.enqueuePushToUser(driver, "New delivery task",
                String.format("New delivery task — %s · ₱%s COD · %s",
                        saved.getTrackingNumber(),
                        saved.getTotalPrice() != null ? saved.getTotalPrice() : "0.00",
                        saved.getDeliveryAddress()),
                "ORDER", saved.getId().toString());

        notificationService.enqueuePushToUserEmail(saved.getCustomerEmail(), "Clean laundry on the way",
                String.format("Clean laundry on the way — %s is heading to you", driver.getFullName()),
                "ORDER", saved.getId().toString());

        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional
    public JobOrderResponse startDeliveryLeg(Long id, AuthUserDetails principal) {
        JobOrder order = findByIdOrThrow(id);
        if (order.getStatus() != JobOrderStatus.ASSIGNED_FOR_DELIVERY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Order is not in the correct status to start delivery. Current status: " + order.getStatus());
        }
        User driver = principal.getUser();
        if (order.getAssignedDeliveryDriver() == null
                || !order.getAssignedDeliveryDriver().getId().equals(driver.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not the assigned delivery rider.");
        }

        // Schedule guard: driver cannot start delivery before the booking date.
        LocalDate bookingDate = order.getBookingDate();
        if (bookingDate != null && bookingDate.isAfter(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This delivery is scheduled for " + bookingDate
                    + ". You can only start delivery on or after the day of the booking.");
        }

        order.setStatus(JobOrderStatus.OUT_FOR_DELIVERY);
        JobOrder saved = repo.save(order);

        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional
    public JobOrderResponse confirmDelivery(Long id, boolean codCollected, AuthUserDetails principal) {
        JobOrder order = findByIdOrThrow(id);
        User driver = principal.getUser();
        if (order.getAssignedDeliveryDriver() == null
                || !order.getAssignedDeliveryDriver().getId().equals(driver.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not the assigned delivery rider.");
        }

        order.setStatus(JobOrderStatus.DELIVERED);
        order.setDeliveredAt(LocalDateTime.now());
        if (codCollected) {
            order.setPaid(true);
            order.setCodCollected(true);
            order.setCodCollectedAt(LocalDateTime.now());
            // Also update the PaymentRecord so paymentStatus = PAID for all consumers.
            paymentRepository.findByJobOrder_TrackingNumber(order.getTrackingNumber())
                    .filter(pr -> pr.getStatus() != com.washalert.washalertbackend.payment.PaymentStatus.PAID)
                    .ifPresent(pr -> {
                        pr.setStatus(com.washalert.washalertbackend.payment.PaymentStatus.PAID);
                        pr.setVerifiedAt(LocalDateTime.now());
                        pr.setVerifiedBy("Driver — COD collected");
                        paymentRepository.save(pr);
                    });
        }
        JobOrder saved = repo.save(order);

        notificationService.enqueuePushToUserEmail(saved.getCustomerEmail(), "Laundry delivered",
                "Delivered — thank you!",
                "ORDER", saved.getId().toString());

        notificationService.enqueuePushToRoles(List.of(Role.STAFF, Role.ADMIN), saved.getBranch(),
                "Order delivered",
                String.format("%s delivered. COD: %s", saved.getTrackingNumber(), codCollected ? "Yes" : "No"),
                "ORDER", saved.getId().toString());

        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsertBlocking("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional(readOnly = true)
    public JobOrderResponse getDriverTaskById(Long id, AuthUserDetails principal) {
        User driver = principal.getUser();
        JobOrder order = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found."));

        boolean isAssigned = (order.getAssignedDriver() != null
                && order.getAssignedDriver().getId().equals(driver.getId()))
                || (order.getAssignedPickupDriver() != null
                        && order.getAssignedPickupDriver().getId().equals(driver.getId()))
                || (order.getAssignedDeliveryDriver() != null
                        && order.getAssignedDeliveryDriver().getId().equals(driver.getId()));

        if (!isAssigned) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not assigned to this order.");
        }
        return toResponse(order);
    }

    public JobOrderResponse updateDriverLocation(Long id, Double lat, Double lng, AuthUserDetails principal) {
        JobOrder order = repo.findById(id).orElseThrow();
        User driver = principal.getUser();

        boolean isAssigned = (order.getAssignedDriver() != null
                && order.getAssignedDriver().getId().equals(driver.getId()))
                || (order.getAssignedPickupDriver() != null
                        && order.getAssignedPickupDriver().getId().equals(driver.getId()))
                || (order.getAssignedDeliveryDriver() != null
                        && order.getAssignedDeliveryDriver().getId().equals(driver.getId()));

        if (!isAssigned) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        order.setDriverLat(lat);
        order.setDriverLng(lng);
        JobOrder saved = repo.save(order);
        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    private boolean isValidTransition(JobOrderStatus from, JobOrderStatus to) {
        return switch (from) {
            case PENDING -> to == JobOrderStatus.ASSIGNED_FOR_PICKUP || to == JobOrderStatus.ORDER_RECEIVED
                    || to == JobOrderStatus.CANCELLED;
            case ASSIGNED_FOR_PICKUP -> to == JobOrderStatus.EN_ROUTE_TO_CUSTOMER || to == JobOrderStatus.CANCELLED;
            case EN_ROUTE_TO_CUSTOMER -> to == JobOrderStatus.LAUNDRY_COLLECTED
                    || to == JobOrderStatus.COLLECTION_FAILED || to == JobOrderStatus.CANCELLED;
            case LAUNDRY_COLLECTED -> to == JobOrderStatus.EN_ROUTE_TO_BRANCH || to == JobOrderStatus.CANCELLED;
            case EN_ROUTE_TO_BRANCH -> to == JobOrderStatus.ORDER_RECEIVED || to == JobOrderStatus.CANCELLED;
            case ORDER_RECEIVED -> to == JobOrderStatus.AWAITING_PRICE_CONFIRMATION || to == JobOrderStatus.CANCELLED;
            case AWAITING_PRICE_CONFIRMATION -> to == JobOrderStatus.PRICE_CONFIRMED || to == JobOrderStatus.CANCELLED;
            case PRICE_CONFIRMED -> to == JobOrderStatus.WASHING || to == JobOrderStatus.CANCELLED;
            case WASHING -> to == JobOrderStatus.DRYING || to == JobOrderStatus.FAILED;
            case DRYING -> to == JobOrderStatus.READY || to == JobOrderStatus.FAILED;
            case READY -> to == JobOrderStatus.ASSIGNED_FOR_DELIVERY || to == JobOrderStatus.OUT_FOR_DELIVERY
                    || to == JobOrderStatus.DELIVERED || to == JobOrderStatus.FAILED;
            case ASSIGNED_FOR_DELIVERY -> to == JobOrderStatus.OUT_FOR_DELIVERY || to == JobOrderStatus.CANCELLED;
            case OUT_FOR_DELIVERY -> to == JobOrderStatus.DELIVERED || to == JobOrderStatus.FAILED;
            case DELIVERED -> false;
            case FAILED -> false;
            case CANCELLED -> false;
            case COLLECTION_FAILED -> to == JobOrderStatus.ASSIGNED_FOR_PICKUP || to == JobOrderStatus.CANCELLED;
        };
    }

    // ── CUSTOMER SELF-SERVICE ─────────────────────────────────────────────────

    @Transactional
    public JobOrderResponse cancelMyOrder(String trackingNumber, AuthUserDetails principal) {
        User actor = principal.getUser();
        JobOrder jo = repo.findByTrackingNumber(normalizeTrackingNumber(trackingNumber))
                .orElseThrow(() -> new OrderNotFoundException("Order not found."));

        if (!jo.getCustomerEmail().equalsIgnoreCase(actor.getEmail())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only cancel your own orders.");
        }
        if (jo.getStatus() != JobOrderStatus.PENDING && jo.getStatus() != JobOrderStatus.AWAITING_PRICE_CONFIRMATION) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Orders can only be cancelled when PENDING or awaiting your price confirmation. Current status: " + jo.getStatus());
        }

        inventoryService.releaseForOrder(jo);
        String cancelReason = jo.getStatus() == JobOrderStatus.AWAITING_PRICE_CONFIRMATION
            ? "Customer rejected final price and cancelled"
            : "Cancelled by customer";
        jo.setStatus(JobOrderStatus.CANCELLED);
        timelineService.log(jo, jo.getStatus(), actor.getEmail(), cancelReason);
        notificationService.enqueuePushToRoles(
                List.of(Role.STAFF, Role.ADMIN),
                jo.getBranch(),
                "Order Cancelled",
                "Customer cancelled order " + jo.getTrackingNumber() + ".",
                "ORDER_CANCELLED",
                jo.getTrackingNumber() + ":cancelled");

        JobOrder saved = repo.save(jo);
        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    @Transactional
    public JobOrderResponse rescheduleMyOrder(String trackingNumber, RescheduleOrderRequest req,
            AuthUserDetails principal) {
        User actor = principal.getUser();
        JobOrder jo = repo.findByTrackingNumber(normalizeTrackingNumber(trackingNumber))
                .orElseThrow(() -> new OrderNotFoundException("Order not found."));

        if (!jo.getCustomerEmail().equalsIgnoreCase(actor.getEmail())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only reschedule your own orders.");
        }
        if (jo.getStatus() != JobOrderStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only PENDING orders can be rescheduled. Current status: " + jo.getStatus());
        }
        if (req.newDate().isBefore(java.time.LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New date cannot be in the past.");
        }

        long booked = repo.countByBranchIgnoreCaseAndBookingDateAndSlotStartTime(
                jo.getBranch(), req.newDate(), req.newSlotStartTime());
        long capacity = machineRepository.countByBranchIgnoreCaseAndStatusNot(jo.getBranch(), MachineStatus.MAINTENANCE);
        if (capacity <= 0) capacity = 1L;
        if (booked >= capacity) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The selected time slot is full. Please choose another.");
        }

        jo.setBookingDate(req.newDate());
        jo.setSlotStartTime(req.newSlotStartTime());
        jo.setSlotEndTime(req.newSlotStartTime().plusMinutes(90));
        timelineService.log(jo, jo.getStatus(), actor.getEmail(),
                "Rescheduled to " + req.newDate() + " " + req.newSlotStartTime());
        notificationService.enqueuePushToRoles(
                List.of(Role.STAFF, Role.ADMIN),
                jo.getBranch(),
                "Order Rescheduled",
                "Customer rescheduled order " + jo.getTrackingNumber() + " to "
                        + req.newDate() + " " + req.newSlotStartTime() + ".",
                "ORDER_RESCHEDULED",
                jo.getTrackingNumber() + ":rescheduled");

        JobOrder saved = repo.save(jo);
        JobOrderResponse response = toResponse(saved);
        firestoreSyncService.upsert("orders", saved.getTrackingNumber(), response);
        return response;
    }

    // ── CSV EXPORT ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public String exportToCsv(AuthUserDetails principal, LocalDate fromDate, LocalDate toDate) {
        List<JobOrderResponse> orders = listAll(principal);

        if (fromDate != null || toDate != null) {
            LocalDateTime from = fromDate != null ? fromDate.atStartOfDay() : LocalDateTime.MIN;
            LocalDateTime to   = toDate   != null ? toDate.atTime(23, 59, 59) : LocalDateTime.MAX;
            orders = orders.stream()
                    .filter(o -> o.getCreatedAt() != null
                            && !o.getCreatedAt().isBefore(from)
                            && !o.getCreatedAt().isAfter(to))
                    .toList();
        }

        StringBuilder sb = new StringBuilder(
                "Tracking Number,Customer,Branch,Service,Service Type,Load Size,Est. Weight (kg),"
                + "Actual Weight (kg),Detergent,Det. Qty,Fabric Conditioner,Con. Qty,"
                + "Service Price,Delivery Price,Rush Price,Supplies Price,System Fee,Total Price,"
                + "Payment Method,Payment Status,Order Status,Created At\n");

        for (JobOrderResponse o : orders) {
            sb.append(csvField(o.getTrackingNumber())).append(',')
              .append(csvField(o.getCustomerName())).append(',')
              .append(csvField(o.getBranch())).append(',')
              .append(csvField(o.getServiceName())).append(',')
              .append(o.getServiceType() != null ? o.getServiceType().name() : "").append(',')
              .append(o.getLoadSize() != null ? o.getLoadSize().name() : "").append(',')
              .append(o.getEstimatedWeightKg() != null ? o.getEstimatedWeightKg().toPlainString() : "").append(',')
              .append(o.getActualWeightKg()    != null ? o.getActualWeightKg().toPlainString()    : "").append(',')
              .append(csvField(o.getDetergentPreference())).append(',')
              .append(o.getDetergentQuantity()  != null ? o.getDetergentQuantity()  : 0).append(',')
              .append(csvField(o.getFabricConditionerPreference())).append(',')
              .append(o.getConditionerQuantity() != null ? o.getConditionerQuantity() : 0).append(',')
              .append(o.getServicePrice()   != null ? o.getServicePrice().toPlainString()   : "0").append(',')
              .append(o.getDeliveryPrice()  != null ? o.getDeliveryPrice().toPlainString()  : "0").append(',')
              .append(o.getRushPrice()      != null ? o.getRushPrice().toPlainString()      : "0").append(',')
              .append(o.getSuppliesPrice()  != null ? o.getSuppliesPrice().toPlainString()  : "0").append(',')
              .append(o.getSystemFee()      != null ? o.getSystemFee().toPlainString()      : "0").append(',')
              .append(o.getTotalPrice()     != null ? o.getTotalPrice().toPlainString()     : "0").append(',')
              .append(csvField(o.getPaymentMethod())).append(',')
              .append(o.getPaymentStatus()  != null ? o.getPaymentStatus().name()  : "").append(',')
              .append(o.getStatus()         != null ? o.getStatus().name()         : "").append(',')
              .append(o.getCreatedAt()      != null ? o.getCreatedAt().toString()  : "")
              .append('\n');
        }
        return sb.toString();
    }

    private static String csvField(String value) {
        if (value == null || value.isEmpty()) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private static final String FS_RATING        = "customerRating";
    private static final String FS_COMMENT       = "customerComment";
    private static final String FS_SUBMITTED_AT  = "feedbackSubmittedAt";
    private static final String FS_STAFF_NOTE    = "staffNote";
    private static final String FS_NOTE_UPDATED  = "staffNoteUpdatedAt";

    @Transactional(readOnly = true)
    public FeedbackResponse getFeedback(String trackingNumber, AuthUserDetails principal) {
        User actor = principal.getUser();
        JobOrder jo = repo.findByTrackingNumber(normalizeTrackingNumber(trackingNumber))
                .orElseThrow(() -> new OrderNotFoundException("Order not found."));

        if (actor.getRole() == Role.CUSTOMER && !jo.getCustomerEmail().equalsIgnoreCase(actor.getEmail())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied.");
        }

        Optional<Map<String, Object>> data = firestoreSyncService.get("feedback", jo.getTrackingNumber());

        FeedbackResponse.FeedbackResponseBuilder builder = FeedbackResponse.builder()
                .trackingNumber(jo.getTrackingNumber());

        data.ifPresent(d -> {
            populateCustomerFeedbackFields(d, builder);
            if (actor.getRole() == Role.ADMIN || actor.getRole() == Role.STAFF) {
                Object note = d.get(FS_STAFF_NOTE);
                if (note instanceof String s) builder.staffNote(s);
                Object noteUpdatedAt = d.get(FS_NOTE_UPDATED);
                if (noteUpdatedAt instanceof String s) builder.staffNoteUpdatedAt(s);
            }
        });

        return builder.build();
    }

    public FeedbackResponse submitFeedback(String trackingNumber, FeedbackRequest req, AuthUserDetails principal) {
        User actor = principal.getUser();
        JobOrder jo = repo.findByTrackingNumber(normalizeTrackingNumber(trackingNumber))
                .orElseThrow(() -> new OrderNotFoundException("Order not found."));

        if (!jo.getCustomerEmail().equalsIgnoreCase(actor.getEmail())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only rate your own orders.");
        }
        if (jo.getStatus() != JobOrderStatus.DELIVERED && jo.getStatus() != JobOrderStatus.READY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Feedback can only be submitted for completed orders (DELIVERED or READY).");
        }

        String submittedAt = Instant.now().toString();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(FS_RATING, req.rating());
        payload.put(FS_COMMENT, req.comment() != null ? req.comment().trim() : "");
        payload.put(FS_SUBMITTED_AT, submittedAt);
        payload.put("customerEmail", actor.getEmail());
        payload.put("trackingNumber", jo.getTrackingNumber());

        firestoreSyncService.upsertBlocking("feedback", jo.getTrackingNumber(), payload);

        return FeedbackResponse.builder()
                .trackingNumber(jo.getTrackingNumber())
                .customerRating(req.rating())
                .customerComment(req.comment())
                .feedbackSubmittedAt(submittedAt)
                .build();
    }

    public FeedbackResponse submitStaffNote(String trackingNumber, StaffNoteRequest req, AuthUserDetails principal) {
        JobOrder jo = repo.findByTrackingNumber(normalizeTrackingNumber(trackingNumber))
                .orElseThrow(() -> new OrderNotFoundException("Order not found."));

        String updatedAt = Instant.now().toString();
        Map<String, Object> patch = new LinkedHashMap<>();
        patch.put(FS_STAFF_NOTE, req.note() != null ? req.note().trim() : "");
        patch.put(FS_NOTE_UPDATED, updatedAt);
        patch.put("staffEmail", principal.getUser().getEmail());
        patch.put("trackingNumber", jo.getTrackingNumber());

        firestoreSyncService.mergePatchBlocking("feedback", jo.getTrackingNumber(), patch);

        return FeedbackResponse.builder()
                .trackingNumber(jo.getTrackingNumber())
                .staffNote(req.note())
                .staffNoteUpdatedAt(updatedAt)
                .build();
    }

    private static void populateCustomerFeedbackFields(Map<String, Object> d, FeedbackResponse.FeedbackResponseBuilder builder) {
        Object ratingObj = d.get(FS_RATING);
        if (ratingObj instanceof Number n) builder.customerRating(n.intValue());
        Object comment = d.get(FS_COMMENT);
        if (comment instanceof String s) builder.customerComment(s);
        Object submittedAt = d.get(FS_SUBMITTED_AT);
        if (submittedAt instanceof String s) builder.feedbackSubmittedAt(s);
    }
}
