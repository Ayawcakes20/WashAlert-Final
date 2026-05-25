package com.washalert.washalertbackend.inventory;

import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.inventory.dto.AdjustInventoryRequest;
import com.washalert.washalertbackend.inventory.dto.CreateInventoryItemRequest;
import com.washalert.washalertbackend.inventory.dto.InventoryForecastResponse;
import com.washalert.washalertbackend.inventory.dto.InventoryItemResponse;
import com.washalert.washalertbackend.inventory.dto.UpdateInventoryItemRequest;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import com.washalert.washalertbackend.common.dto.PagedResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.washalert.washalertbackend.inventory.dto.BookingPipelineResponse;
import com.washalert.washalertbackend.inventory.dto.DailyConsumptionResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

@Service
@Slf4j
public class InventoryService {
    private static final BigDecimal FORECAST_DETERGENT_PER_KG = new BigDecimal("0.03");
    private static final BigDecimal FORECAST_CONDITIONER_PER_KG = new BigDecimal("0.02");
    private static final BigDecimal DEFAULT_ORDER_WEIGHT_KG = new BigDecimal("5.00");
    private static final Set<String> NO_SUPPLY_LABELS = Set.of(
            "none",
            "customer provided",
            "customer-provided",
            "customer supplied",
            "no detergent",
            "no fabric conditioner",
            "no fabcon",
            "no conditioner",
            "without detergent",
            "without fabric conditioner",
            "own detergent",
            "own fabcon",
            "own fabric conditioner"
    );

    private static final java.util.Map<String, String> CANONICAL_ITEM_NAMES = new java.util.LinkedHashMap<>() {{
        put("surf", "Surf Detergent");
        put("ariel", "Ariel Detergent");
        put("charm", "Charm Fabric Conditioner");
        put("downy", "Downy Fabric Conditioner");
    }};

    private String normalizeItemName(String rawName) {
        if (rawName == null) return rawName;
        String lower = rawName.trim().toLowerCase(java.util.Locale.ROOT);
        for (java.util.Map.Entry<String, String> entry : CANONICAL_ITEM_NAMES.entrySet()) {
            if (lower.contains(entry.getKey())) return entry.getValue();
        }
        return rawName.trim();
    }

    private final InventoryItemRepository itemRepository;
    private final InventoryMovementRepository movementRepository;
    private final JobOrderRepository jobOrderRepository;
    private final FirestoreSyncService firestoreSyncService;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;
    private final NotificationService notificationService;

    public InventoryService(
            InventoryItemRepository itemRepository,
            InventoryMovementRepository movementRepository,
            JobOrderRepository jobOrderRepository,
            FirestoreSyncService firestoreSyncService,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties,
            NotificationService notificationService
    ) {
        this.itemRepository = itemRepository;
        this.movementRepository = movementRepository;
        this.jobOrderRepository = jobOrderRepository;
        this.firestoreSyncService = firestoreSyncService;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
        this.notificationService = notificationService;
    }

    /**
     * Validates that sufficient stock exists for a single consumable at the given branch.
     * Does NOT deduct stock — validation only.
     *
     * @throws IllegalArgumentException with a clear user-facing message if stock is insufficient
     */
    public void validateConsumableAvailability(String branch, String rawItemName, int requiredQty) {
        if (isNoSupplySelection(rawItemName)) return;
        if (requiredQty <= 0) return;

        String resolvedName = resolveInventoryItemName(rawItemName);
        InventoryItem item = itemRepository
                .findByBranchIgnoreCaseAndItemNameIgnoreCase(branch.trim(), resolvedName)
                .orElse(null);

        BigDecimal required = BigDecimal.valueOf(requiredQty);
        BigDecimal available = (item != null && item.getCurrentStock() != null)
                ? item.getCurrentStock() : BigDecimal.ZERO;

        if (available.compareTo(required) < 0) {
            String availableStr = available.stripTrailingZeros().toPlainString();
            throw new IllegalArgumentException(
                    "Insufficient inventory at this branch. " + resolvedName +
                    " requires " + requiredQty + " pack(s) but only " +
                    availableStr + " are available. Please contact the branch or choose a different product.");
        }
    }

    /**
     * Validates both detergent and fabric conditioner availability before a booking or status change.
     * Does NOT deduct stock — validation only.
     *
     * @throws IllegalArgumentException if either consumable has insufficient stock
     */
    public void validateSuppliesForBooking(String branch, String detergent, String conditioner,
                                           int detQty, int conQty) {
        if (branch == null || branch.isBlank()) return;
        validateConsumableAvailability(branch, detergent, detQty);
        validateConsumableAvailability(branch, conditioner, conQty);
    }

    // Response types for the customer-facing supplies availability endpoint
    public record SupplyItemAvailability(String id, String label, boolean available, int availableQty) {}
    public record SuppliesAvailability(
            List<SupplyItemAvailability> detergent,
            List<SupplyItemAvailability> conditioner,
            boolean allUnavailable,
            String message
    ) {}

    // Returns current availability for each customer-selectable supply at the given branch.
    // No auth required — does NOT expose stock levels for non-selectable items.
    public SuppliesAvailability getSuppliesAvailability(String branch) {
        // Normalize to canonical branch name so "JP Rizal" finds "JP Rizal Branch" rows.
        String canonicalBranch = normalizeBranchName(branch);
        if (canonicalBranch == null || canonicalBranch.isBlank()) canonicalBranch = branch;
        final String effectiveBranch = canonicalBranch;

        record ItemDef(String id, String itemName) {}


        List<ItemDef> detDefs = List.of(
                new ItemDef("surf",  "Surf Detergent"),
                new ItemDef("ariel", "Ariel Detergent")
        );
        List<ItemDef> fabDefs = List.of(
                new ItemDef("charm", "Charm Fabric Conditioner"),
                new ItemDef("downy", "Downy Fabric Conditioner")
        );

        var detItems = detDefs.stream().map(def -> {
            InventoryItem item = itemRepository
                    .findByBranchIgnoreCaseAndItemNameIgnoreCase(effectiveBranch, def.itemName())
                    .orElse(null);
            int qty = (item != null && item.getCurrentStock() != null)
                    ? item.getCurrentStock().intValue() : 0;
            return new SupplyItemAvailability(def.id(), def.itemName(), qty > 0, qty);
        }).toList();

        var fabItems = fabDefs.stream().map(def -> {
            InventoryItem item = itemRepository
                    .findByBranchIgnoreCaseAndItemNameIgnoreCase(effectiveBranch, def.itemName())
                    .orElse(null);
            int qty = (item != null && item.getCurrentStock() != null)
                    ? item.getCurrentStock().intValue() : 0;
            return new SupplyItemAvailability(def.id(), def.itemName(), qty > 0, qty);
        }).toList();

        boolean allUnavailable = detItems.stream().noneMatch(SupplyItemAvailability::available)
                && fabItems.stream().noneMatch(SupplyItemAvailability::available);
        boolean someUnavailable = detItems.stream().anyMatch(i -> !i.available())
                || fabItems.stream().anyMatch(i -> !i.available());

        String message = null;
        if (allUnavailable) {
            message = "All add-on supplies are currently unavailable at this branch. Please select None or choose another branch.";
        } else if (someUnavailable) {
            List<String> names = new ArrayList<>();
            detItems.stream().filter(i -> !i.available()).forEach(i -> names.add(i.label()));
            fabItems.stream().filter(i -> !i.available()).forEach(i -> names.add(i.label()));
            message = "Some supplies are unavailable at this branch: " + String.join(", ", names) + ".";
        }

        return new SuppliesAvailability(detItems, fabItems, allUnavailable, message);
    }

    public List<InventoryItemResponse> list(String branch, AuthUserDetails principal) {
        User actor = principal.getUser();
        String effectiveBranch = resolveEffectiveBranch(branch, actor);

        if (!dataReadProperties.prefersFirestoreReads()) {
            return listFromMysql(effectiveBranch);
        }

        List<InventoryItemResponse> firestoreRows = listFromFirestore(effectiveBranch);
        if (!firestoreRows.isEmpty()) {
            return firestoreRows;
        }

        if (dataReadProperties.allowsMysqlFallback() || !firestoreReadService.isAvailable()) {
            return listFromMysql(effectiveBranch);
        }

        return firestoreRows;
    }

    /** Returns a map of canonical supply name → number of pending orders that will consume it. */
    public java.util.Map<String, Long> getPendingConsumption(String branch, AuthUserDetails principal) {
        User actor = principal.getUser();
        String effectiveBranch = resolveEffectiveBranch(branch, actor);
        java.util.List<com.washalert.washalertbackend.orders.JobOrderStatus> prewashStatuses = java.util.List.of(
                com.washalert.washalertbackend.orders.JobOrderStatus.PENDING,
                com.washalert.washalertbackend.orders.JobOrderStatus.ASSIGNED_FOR_PICKUP,
                com.washalert.washalertbackend.orders.JobOrderStatus.ORDER_RECEIVED
        );
        java.util.List<com.washalert.washalertbackend.orders.JobOrder> orders =
                effectiveBranch == null
                        ? jobOrderRepository.findByStatusInAndCreatedAtAfter(
                                prewashStatuses, java.time.LocalDateTime.now().minusDays(30))
                        : jobOrderRepository.findByBranchIgnoreCaseAndStatusIn(effectiveBranch, prewashStatuses);
        java.util.Map<String, Long> result = new java.util.LinkedHashMap<>();
        for (com.washalert.washalertbackend.orders.JobOrder jo : orders) {
            String det = jo.getDetergentPreference();
            String fab = jo.getFabricConditionerPreference();
            if (det != null && !det.isBlank()) {
                String key = normalizeItemName(det);
                result.merge(key, 1L, Long::sum);
            }
            if (fab != null && !fab.isBlank()) {
                String key = normalizeItemName(fab);
                result.merge(key, 1L, Long::sum);
            }
        }
        return result;
    }

    /**
     * Layer 2 of the forecast: confirmed future demand from upcoming bookings within {@code horizonDays}.
     * Returns a map keyed by "{branchLower}||{canonicalItemName}" → total units already requested by
     * customers in scheduled bookings that have not yet entered the wash cycle.
     */
    private Map<String, BigDecimal> computeConfirmedDemand(String effectiveBranch, int horizonDays) {
        java.util.List<JobOrderStatus> upcomingStatuses = java.util.List.of(
                JobOrderStatus.PENDING,
                JobOrderStatus.ASSIGNED_FOR_PICKUP,
                JobOrderStatus.EN_ROUTE_TO_CUSTOMER,
                JobOrderStatus.LAUNDRY_COLLECTED,
                JobOrderStatus.EN_ROUTE_TO_BRANCH,
                JobOrderStatus.ORDER_RECEIVED,
                JobOrderStatus.AWAITING_PRICE_CONFIRMATION,
                JobOrderStatus.PRICE_CONFIRMED
        );
        List<JobOrder> candidates = effectiveBranch == null
                ? jobOrderRepository.findByStatusInAndCreatedAtAfter(upcomingStatuses, LocalDateTime.now().minusDays(60))
                : jobOrderRepository.findByBranchIgnoreCaseAndStatusIn(effectiveBranch, upcomingStatuses);

        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDate horizon = today.plusDays(horizonDays);
        Map<String, BigDecimal> demand = new java.util.LinkedHashMap<>();

        for (JobOrder jo : candidates) {
            java.time.LocalDate booked = jo.getBookingDate();
            if (booked == null || booked.isBefore(today) || booked.isAfter(horizon)) continue;
            if (jo.getBranch() == null || jo.getBranch().isBlank()) continue;
            String branchKey = jo.getBranch().trim().toLowerCase(Locale.ROOT);

            String det = jo.getDetergentPreference();
            if (hasConsumableSelection(det)) {
                int qty = (jo.getDetergentQuantity() != null && jo.getDetergentQuantity() > 0) ? jo.getDetergentQuantity() : 1;
                demand.merge(branchKey + "||" + normalizeItemName(det), BigDecimal.valueOf(qty), BigDecimal::add);
            }
            String fab = jo.getFabricConditionerPreference();
            if (hasConsumableSelection(fab)) {
                int qty = (jo.getConditionerQuantity() != null && jo.getConditionerQuantity() > 0) ? jo.getConditionerQuantity() : 1;
                demand.merge(branchKey + "||" + normalizeItemName(fab), BigDecimal.valueOf(qty), BigDecimal::add);
            }
        }
        return demand;
    }

    @Transactional
    public InventoryItemResponse create(CreateInventoryItemRequest req) {
        log.info("[INVENTORY] Attempting to create item: {} in branch: {}", req.itemName(), req.branch());
        try {
            itemRepository.findByBranchIgnoreCaseAndItemNameIgnoreCase(req.branch().trim(), req.itemName().trim())
                    .ifPresent(existing -> {
                        throw new IllegalStateException("Inventory item already exists for this branch.");
                    });

            InventoryItem item = InventoryItem.builder()
                    .branch(req.branch().trim())
                    .itemName(normalizeItemName(req.itemName()))
                    .category(req.category().trim())
                    .unit(req.unit().trim())
                    .currentStock(req.currentStock())
                    .reorderLevel(req.reorderLevel())
                    .lowStockWarning(false)
                    .projectedDaysRemaining(null)
                    .assetType(req.assetType())
                    .purchaseDate(req.purchaseDate())
                    .lastServicedDate(req.lastServicedDate())
                    .maintenanceIntervalDays(req.maintenanceIntervalDays())
                    .assetStatus(req.assetStatus())
                    .supplierLeadTimeDays(req.supplierLeadTimeDays() != null ? req.supplierLeadTimeDays() : 3)
                    .build();

            InventoryItem saved = itemRepository.save(item);
            log.info("[INVENTORY] Successfully saved item to DB with ID: {}", saved.getId());

            InventoryItemResponse response = toResponse(saved);
            
            try {
                firestoreSyncService.upsert("inventory", String.valueOf(saved.getId()), response);
            } catch (Exception fe) {
                log.warn("[INVENTORY] Firestore sync failed for item ID: {}, but DB save succeeded: {}", saved.getId(), fe.getMessage());
                // Don't fail the whole transaction if only Firestore sync fails (optional design choice)
            }

            maybeNotifyLowStockCrossed(saved, false, isLowStock(saved), "created");
            return response;
        } catch (Exception ex) {
            log.error("[INVENTORY] CRITICAL ERROR while creating inventory item: {}", ex.getMessage(), ex);
            throw ex;
        }
    }

    @Transactional
    public InventoryItemResponse update(Long itemId, UpdateInventoryItemRequest req) {
        InventoryItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Inventory item not found."));

        String branch = req.branch().trim();
        String itemName = normalizeItemName(req.itemName());

        itemRepository.findByBranchIgnoreCaseAndItemNameIgnoreCase(branch, itemName)
                .ifPresent(existing -> {
                    if (!existing.getId().equals(item.getId())) {
                        throw new IllegalStateException("Inventory item already exists for this branch.");
                    }
                });

        boolean wasLowStock = isLowStock(item);
        item.setBranch(branch);
        item.setItemName(itemName);
        item.setCategory(req.category().trim());
        item.setUnit(req.unit().trim());
        item.setReorderLevel(req.reorderLevel());
        if (req.assetType() != null) item.setAssetType(req.assetType());
        if (req.purchaseDate() != null) item.setPurchaseDate(req.purchaseDate());
        if (req.lastServicedDate() != null) item.setLastServicedDate(req.lastServicedDate());
        if (req.maintenanceIntervalDays() != null) item.setMaintenanceIntervalDays(req.maintenanceIntervalDays());
        if (req.assetStatus() != null) item.setAssetStatus(req.assetStatus());
        if (req.supplierLeadTimeDays() != null) item.setSupplierLeadTimeDays(req.supplierLeadTimeDays());

        InventoryItem saved = itemRepository.save(item);
        firestoreSyncService.upsert("inventory", String.valueOf(saved.getId()), toResponse(saved));
        maybeNotifyLowStockCrossed(saved, wasLowStock, isLowStock(saved), "updated");
        return toResponse(saved);
    }

    @Transactional
    public InventoryItemResponse adjust(Long itemId, AdjustInventoryRequest req, AuthUserDetails principal) {
        User actor = principal.getUser();

        InventoryItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Inventory item not found."));

        if (actor.getRole() == Role.STAFF && !sameBranch(actor.getBranch(), item.getBranch())) {
            throw new IllegalArgumentException("You can only adjust inventory in your branch.");
        }

        BigDecimal signedDelta = toSignedDelta(req.quantityDelta(), req.direction());
        BigDecimal nextStock = item.getCurrentStock().add(signedDelta);
        if (nextStock.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Stock adjustment would result in negative stock.");
        }

        boolean wasLowStock = isLowStock(item);
        item.setCurrentStock(nextStock);
        InventoryItem savedItem = itemRepository.save(item);

        InventoryMovement movement = InventoryMovement.builder()
                .inventoryItem(savedItem)
                .quantityDelta(signedDelta)
                .reason(req.reason().trim())
                .performedBy(actor.getEmail())
                .build();
        movementRepository.save(movement);
        firestoreSyncService.upsert("inventory", String.valueOf(savedItem.getId()), toResponse(savedItem));
        maybeNotifyLowStockCrossed(savedItem, wasLowStock, isLowStock(savedItem), "adjusted");

        return toResponse(savedItem);
    }

    @Transactional
    public void delete(Long itemId) {
        InventoryItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Inventory item not found."));

        movementRepository.deleteByInventoryItem_Id(item.getId());
        itemRepository.delete(item);
        firestoreSyncService.delete("inventory", String.valueOf(item.getId()));
    }

    public PagedResponse<InventoryItemResponse> listPaged(String branch, AuthUserDetails principal, Pageable pageable) {
        User actor = principal.getUser();
        String effectiveBranch = resolveEffectiveBranch(branch, actor);

        Page<InventoryItem> page = effectiveBranch == null
                ? itemRepository.findAll(pageable)
                : itemRepository.findByBranchIgnoreCase(effectiveBranch, pageable);

        return PagedResponse.from(page.map(this::toResponse));
    }

    public List<InventoryItemResponse> lowStockAlerts(AuthUserDetails principal) {
        return list(null, principal).stream()
                .filter(InventoryItemResponse::lowStock)
                .toList();
    }

    /**
     * Deducts stock at booking time so inventory reflects reserved supplies immediately.
     * Uses reason prefix "Booking: TN" so WASHING can detect and skip double-deduction.
     */
    @Transactional
    public void deductAtBooking(JobOrder order) {
        if (order == null || order.getBranch() == null) return;
        String branch = order.getBranch().trim();
        int detQty = (order.getDetergentQuantity() != null && order.getDetergentQuantity() > 0) ? order.getDetergentQuantity() : 1;
        int conQty = (order.getConditionerQuantity() != null && order.getConditionerQuantity() > 0) ? order.getConditionerQuantity() : 1;
        deductConsumable(branch, order.getDetergentPreference(), detQty, "Booking: " + order.getTrackingNumber(), "system");
        deductConsumable(branch, order.getFabricConditionerPreference(), conQty, "Booking: " + order.getTrackingNumber(), "system");
    }

    /**
     * Releases inventory reserved at booking when an order is cancelled.
     * Adds stock back using reason "Booking-Release: TN".
     */
    @Transactional
    public void releaseForOrder(JobOrder order) {
        if (order == null || order.getBranch() == null) return;
        String branch = order.getBranch().trim();
        int detQty = (order.getDetergentQuantity() != null && order.getDetergentQuantity() > 0) ? order.getDetergentQuantity() : 1;
        int conQty = (order.getConditionerQuantity() != null && order.getConditionerQuantity() > 0) ? order.getConditionerQuantity() : 1;
        releaseConsumable(branch, order.getDetergentPreference(), detQty, "Booking-Release: " + order.getTrackingNumber(), "system");
        releaseConsumable(branch, order.getFabricConditionerPreference(), conQty, "Booking-Release: " + order.getTrackingNumber(), "system");
    }

    /**
     * Auto-deducts at WASHING. Skips if booking-time deduction already happened
     * (identified by "Booking: TN" movement) to prevent double-deduction.
     */
    @Transactional
    public void deductForOrder(JobOrder order) {
        if (order == null || order.getBranch() == null) return;
        if (movementRepository.existsByReasonStartingWith("Booking: " + order.getTrackingNumber())) {
            log.info("[INVENTORY] Booking-time deduction already exists for {} — skipping WASHING deduct", order.getTrackingNumber());
            return;
        }
        String branch = order.getBranch().trim();
        int detQty = (order.getDetergentQuantity() != null && order.getDetergentQuantity() > 0) ? order.getDetergentQuantity() : 1;
        int conQty = (order.getConditionerQuantity() != null && order.getConditionerQuantity() > 0) ? order.getConditionerQuantity() : 1;
        deductConsumable(branch, order.getDetergentPreference(), detQty, "Order: " + order.getTrackingNumber(), "system");
        deductConsumable(branch, order.getFabricConditionerPreference(), conQty, "Order: " + order.getTrackingNumber(), "system");
    }

    private String resolveInventoryItemName(String preference) {
        if (preference == null) return "";
        String p = preference.toLowerCase(Locale.ROOT);
        if (p.contains("surf")) return "Surf Detergent";
        if (p.contains("ariel")) return "Ariel Detergent";
        if (p.contains("charm")) return "Charm Fabric Conditioner";
        if (p.contains("downy")) return "Downy Fabric Conditioner";
        return preference.trim();
    }

    private void deductConsumable(String branch, String itemName, int qty, String reason, String actor) {
        if (!hasConsumableSelection(itemName) || qty <= 0) return;
        try {
            String resolvedName = resolveInventoryItemName(itemName);
            InventoryItem item = itemRepository
                    .findByBranchIgnoreCaseAndItemNameIgnoreCase(branch, resolvedName)
                    .orElse(null);
            if (item == null) {
                log.warn("[INVENTORY] Deduct skipped — item '{}' (resolved: '{}') not found in branch '{}'", itemName, resolvedName, branch);
                return;
            }
            BigDecimal deductAmount = BigDecimal.valueOf(qty);
            BigDecimal next = item.getCurrentStock().subtract(deductAmount);
            if (next.compareTo(BigDecimal.ZERO) < 0) {
                log.warn("[INVENTORY] Deduct skipped — negative stock would result for '{}' in '{}'", itemName, branch);
                return;
            }
            boolean wasLow = isLowStock(item);
            item.setCurrentStock(next);
            InventoryItem saved = itemRepository.save(item);
            InventoryMovement movement = InventoryMovement.builder()
                    .inventoryItem(saved)
                    .quantityDelta(deductAmount.negate())
                    .reason(reason)
                    .performedBy(actor)
                    .build();
            movementRepository.save(movement);
            firestoreSyncService.upsert("inventory", String.valueOf(saved.getId()), toResponse(saved));
            maybeNotifyLowStockCrossed(saved, wasLow, isLowStock(saved), "deducted");
        } catch (Exception ex) {
            log.error("[INVENTORY] Failed to deduct '{}' for reason '{}': {}", itemName, reason, ex.getMessage());
        }
    }

    private void releaseConsumable(String branch, String itemName, int qty, String reason, String actor) {
        if (!hasConsumableSelection(itemName) || qty <= 0) return;
        try {
            String resolvedName = resolveInventoryItemName(itemName);
            InventoryItem item = itemRepository
                    .findByBranchIgnoreCaseAndItemNameIgnoreCase(branch, resolvedName)
                    .orElse(null);
            if (item == null) {
                log.warn("[INVENTORY] Release skipped — item '{}' not found in branch '{}'", resolvedName, branch);
                return;
            }
            BigDecimal releaseAmount = BigDecimal.valueOf(qty);
            item.setCurrentStock(item.getCurrentStock().add(releaseAmount));
            InventoryItem saved = itemRepository.save(item);
            InventoryMovement movement = InventoryMovement.builder()
                    .inventoryItem(saved)
                    .quantityDelta(releaseAmount)
                    .reason(reason)
                    .performedBy(actor)
                    .build();
            movementRepository.save(movement);
            firestoreSyncService.upsert("inventory", String.valueOf(saved.getId()), toResponse(saved));
        } catch (Exception ex) {
            log.error("[INVENTORY] Failed to release '{}' for reason '{}': {}", itemName, reason, ex.getMessage());
        }
    }

    public List<InventoryForecastResponse> forecast(String branch, Integer days, AuthUserDetails principal) {
        int horizonDays = (days == null || days <= 0) ? 7 : Math.min(days, 30);
        LocalDateTime since = LocalDateTime.now().minusDays(30);
        String effectiveBranch = resolveEffectiveBranch(branch, principal.getUser());

        // Data flow note:
        // 1) Mobile/Web bookings write to the shared job_orders table.
        // 2) Forecast reads those shared orders to estimate branch consumable usage.
        // 3) Inventory projection then uses branch usage for low-stock forecasting.
        List<JobOrder> scopedOrders = effectiveBranch == null
                ? jobOrderRepository.findByCreatedAtBetween(since, LocalDateTime.now())
                : jobOrderRepository.findByBranchIgnoreCaseAndCreatedAtBetween(
                effectiveBranch,
                since,
                LocalDateTime.now()
        );
        Map<String, BranchConsumableUsage> usageByBranch = buildBranchConsumableUsage(scopedOrders);
        Map<String, BigDecimal> confirmedDemandByItem = computeConfirmedDemand(effectiveBranch, horizonDays);

        return list(branch, principal).stream().map(item -> {
            // Layer 1 — historical daily average (30-day window of completed/active orders)
            BigDecimal historical = estimateOrderBackedDailyUsage(item, usageByBranch);
            if (historical.compareTo(BigDecimal.ZERO) == 0 && item.id() != null) {
                historical = movementBasedDailyUsage(item.id(), since);
            }

            // Layer 2 — confirmed future demand from upcoming bookings, expressed as a daily rate
            BigDecimal confirmedDemand7D = BigDecimal.ZERO;
            if (item.branch() != null && item.itemName() != null) {
                String key = item.branch().trim().toLowerCase(Locale.ROOT) + "||" + normalizeItemName(item.itemName());
                confirmedDemand7D = confirmedDemandByItem.getOrDefault(key, BigDecimal.ZERO);
            }
            BigDecimal confirmedDailyRate = confirmedDemand7D.compareTo(BigDecimal.ZERO) > 0
                    ? confirmedDemand7D.divide(BigDecimal.valueOf(horizonDays), 4, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            // Combined — 60% historical trend + 40% confirmed future demand; fall back to whichever signal exists
            BigDecimal projectedDaily;
            if (historical.compareTo(BigDecimal.ZERO) > 0 && confirmedDailyRate.compareTo(BigDecimal.ZERO) > 0) {
                projectedDaily = historical.multiply(new BigDecimal("0.6"))
                        .add(confirmedDailyRate.multiply(new BigDecimal("0.4")))
                        .setScale(4, RoundingMode.HALF_UP);
            } else if (historical.compareTo(BigDecimal.ZERO) > 0) {
                projectedDaily = historical;
            } else {
                projectedDaily = confirmedDailyRate;
            }

            BigDecimal projected = item.currentStock().subtract(projectedDaily.multiply(BigDecimal.valueOf(horizonDays)));
            if (projected.compareTo(BigDecimal.ZERO) < 0) projected = BigDecimal.ZERO;

            BigDecimal daysUntilStockout = null;
            if (projectedDaily.compareTo(BigDecimal.ZERO) > 0) {
                daysUntilStockout = item.currentStock().divide(projectedDaily, 2, RoundingMode.HALF_UP);
            }

            String narrative = buildForecastNarrative(item.itemName(), item.branch(), item.currentStock(),
                    item.reorderLevel(), projectedDaily, daysUntilStockout, horizonDays);
            return new InventoryForecastResponse(
                    item.id(),
                    item.branch(),
                    item.itemName(),
                    item.currentStock(),
                    projectedDaily,
                    projected,
                    daysUntilStockout,
                    narrative,
                    historical,
                    confirmedDemand7D,
                    projectedDaily
            );
        }).toList();
    }

    private String buildForecastNarrative(
            String itemName, String branch, BigDecimal currentStock,
            BigDecimal reorderLevel, BigDecimal dailyUsage,
            BigDecimal daysUntilStockout, int horizonDays) {
        if (dailyUsage == null || dailyUsage.compareTo(BigDecimal.ZERO) == 0) {
            return itemName + " at " + branch + " shows no recent usage. No restock action needed.";
        }
        if (daysUntilStockout == null) {
            return itemName + " at " + branch + " has sufficient stock for the foreseeable future.";
        }
        int daysLeft = daysUntilStockout.intValue();
        if (currentStock != null && reorderLevel != null && currentStock.compareTo(reorderLevel) <= 0) {
            long restockQty = Math.max(10, reorderLevel.multiply(new BigDecimal("2")).longValue() - currentStock.longValue());
            return itemName + " at " + branch + " has ALREADY reached the reorder level (" + currentStock.stripTrailingZeros().toPlainString() + " remaining). " +
                   "Recommended immediate restock: " + restockQty + " units.";
        }
        if (daysLeft <= horizonDays) {
            long restockQty = Math.max(10, reorderLevel != null
                    ? reorderLevel.multiply(new BigDecimal("2")).longValue()
                    : 20L);
            return itemName + " at " + branch + " is projected to reach critical level in " + daysLeft + " day(s). " +
                   "Estimated daily usage: " + dailyUsage.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString() + " units/day. " +
                   "Recommended restock: " + restockQty + " units.";
        }
        return itemName + " at " + branch + " is sufficient for the next " + daysLeft + " day(s). Monitor regularly.";
    }

    private Map<String, BranchConsumableUsage> buildBranchConsumableUsage(List<JobOrder> orders) {
        Map<String, BranchConsumableUsage> usage = new HashMap<>();
        for (JobOrder order : orders) {
            if (order == null || order.getBranch() == null || order.getBranch().isBlank()) {
                continue;
            }
            if (order.getStatus() == JobOrderStatus.CANCELLED) {
                continue;
            }

            BigDecimal weightKg = order.getEstimatedWeightKg() == null
                    ? DEFAULT_ORDER_WEIGHT_KG
                    : order.getEstimatedWeightKg().max(BigDecimal.ZERO);

            BigDecimal detergentUsage = hasConsumableSelection(order.getDetergentPreference())
                    ? weightKg.multiply(FORECAST_DETERGENT_PER_KG)
                    : BigDecimal.ZERO;
            BigDecimal conditionerUsage = hasConsumableSelection(order.getFabricConditionerPreference())
                    ? weightKg.multiply(FORECAST_CONDITIONER_PER_KG)
                    : BigDecimal.ZERO;

            usage.merge(
                    order.getBranch().trim().toLowerCase(),
                    new BranchConsumableUsage(detergentUsage, conditionerUsage),
                    BranchConsumableUsage::add
            );
        }
        return usage;
    }

    private BigDecimal estimateOrderBackedDailyUsage(
            InventoryItemResponse item,
            Map<String, BranchConsumableUsage> usageByBranch
    ) {
        if (item.branch() == null || item.branch().isBlank()) {
            return BigDecimal.ZERO;
        }

        BranchConsumableUsage branchUsage = usageByBranch.get(item.branch().trim().toLowerCase());
        if (branchUsage == null) {
            return BigDecimal.ZERO;
        }

        BigDecimal monthlyUsage = BigDecimal.ZERO;
        if (isDetergentItem(item)) {
            monthlyUsage = branchUsage.detergent();
        } else if (isConditionerItem(item)) {
            monthlyUsage = branchUsage.conditioner();
        }

        return monthlyUsage.divide(BigDecimal.valueOf(30), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal movementBasedDailyUsage(Long itemId, LocalDateTime since) {
        BigDecimal totalUsage = movementRepository
                .findByInventoryItem_IdAndCreatedAtAfter(itemId, since)
                .stream()
                .map(InventoryMovement::getQuantityDelta)
                .filter(delta -> delta.compareTo(BigDecimal.ZERO) < 0)
                .map(BigDecimal::abs)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return totalUsage.divide(BigDecimal.valueOf(30), 4, RoundingMode.HALF_UP);
    }

    private boolean hasConsumableSelection(String value) {
        return !isNoSupplySelection(value);
    }

    private boolean isNoSupplySelection(String value) {
        if (value == null) return true;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) return true;
        return NO_SUPPLY_LABELS.contains(normalized);
    }

    private boolean isDetergentItem(InventoryItemResponse item) {
        String haystack = ((item.itemName() == null ? "" : item.itemName()) + " "
                + (item.category() == null ? "" : item.category())).toLowerCase();
        return haystack.contains("detergent") || haystack.contains("surf") || haystack.contains("ariel");
    }

    private boolean isConditionerItem(InventoryItemResponse item) {
        String haystack = ((item.itemName() == null ? "" : item.itemName()) + " "
                + (item.category() == null ? "" : item.category())).toLowerCase();
        return haystack.contains("conditioner")
                || haystack.contains("fabric")
                || haystack.contains("fabcon")
                || haystack.contains("downy")
                || haystack.contains("charm");
    }

    private record BranchConsumableUsage(BigDecimal detergent, BigDecimal conditioner) {
        private BranchConsumableUsage add(BranchConsumableUsage other) {
            return new BranchConsumableUsage(
                    detergent.add(other.detergent),
                    conditioner.add(other.conditioner)
            );
        }
    }

    private List<InventoryItemResponse> listFromMysql(String effectiveBranch) {
        if (effectiveBranch == null) {
            return itemRepository.findAllByOrderByBranchAscItemNameAsc().stream()
                    .map(this::toResponse)
                    .toList();
        }

        return itemRepository.findByBranchIgnoreCaseOrderByItemNameAsc(effectiveBranch).stream()
                .map(this::toResponse)
                .toList();
    }

    private List<InventoryItemResponse> listFromFirestore(String effectiveBranch) {
        Comparator<InventoryItemResponse> byBranchThenName = Comparator
                .comparing(InventoryItemResponse::branch, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(InventoryItemResponse::itemName, String.CASE_INSENSITIVE_ORDER);

        Comparator<InventoryItemResponse> byName = Comparator
                .comparing(InventoryItemResponse::itemName, String.CASE_INSENSITIVE_ORDER);

        return firestoreReadService.listInventoryItems().stream()
                .filter(item -> effectiveBranch == null || sameBranch(item.branch(), effectiveBranch))
                .sorted(effectiveBranch == null ? byBranchThenName : byName)
                .toList();
    }

    // Canonical branch name aliases — maps any known short/legacy name to the canonical stored form.
    // These must match the values in MachineSeeder.BRANCHES and the inventory DB rows.
    private static final java.util.Map<String, String> BRANCH_ALIASES = new java.util.LinkedHashMap<>() {{
        put("jp rizal",                          "JP Rizal Branch");
        put("jp rizal branch",                   "JP Rizal Branch");
        put("speedywash - jp rizal",             "JP Rizal Branch");
        put("makati",                            "Makati Branch");
        put("makati branch",                     "Makati Branch");
        put("triplets laundryhubs - makati",     "Makati Branch");
        put("triplets - makati",                 "Makati Branch");
        put("chestnut",                          "Chestnut Branch");
        put("chestnut branch",                   "Chestnut Branch");
        put("chestnut st",                       "Chestnut Branch");
        put("speedywash - chestnut",             "Chestnut Branch");
        put("republic",                          "Republic Branch");
        put("republic branch",                   "Republic Branch");
        put("republic ave",                      "Republic Branch");
        put("speedywash - republic",             "Republic Branch");
        put("holy spirit",                       "Holy Spirit Branch");
        put("holy spirit branch",                "Holy Spirit Branch");
        put("tondo",                             "Holy Spirit Branch");
        put("speedywash - t.o.n",               "Holy Spirit Branch");
        put("sta. catalina",                     "Sta. Catalina Branch");
        put("sta. catalina branch",              "Sta. Catalina Branch");
        put("s. catalina",                       "Sta. Catalina Branch");
        put("speedywash - s. catalina",          "Sta. Catalina Branch");
        put("brookside",                         "Brookside Branch");
        put("brookside branch",                  "Brookside Branch");
        put("pasig city",                        "Brookside Branch");
        put("speedywash - pasig",                "Brookside Branch");
        put("luzon",                             "Luzon Branch");
        put("luzon branch",                      "Luzon Branch");
        put("samat st",                          "Luzon Branch");
        put("st. anthony",                       "St. Anthony Branch");
        put("st. anthony branch",                "St. Anthony Branch");
        put("st. nino",                          "St. Anthony Branch");
        put("up diliman",                        "UP Diliman / San Vicente Branch");
        put("up diliman / san vicente branch",   "UP Diliman / San Vicente Branch");
        put("speedywash - up diliman",           "UP Diliman / San Vicente Branch");
    }};

    /**
     * Normalizes a branch name to its canonical form so that short aliases used in
     * User.branch (e.g. "JP Rizal") resolve to the same DB value ("JP Rizal Branch").
     */
    private String normalizeBranchName(String branch) {
        if (branch == null || branch.isBlank()) return branch;
        String canonical = BRANCH_ALIASES.get(branch.trim().toLowerCase(java.util.Locale.ROOT));
        return canonical != null ? canonical : branch.trim();
    }

    private String resolveEffectiveBranch(String requestedBranch, User actor) {
        if (actor.getRole() == Role.STAFF) {
            // Normalize staff branch to canonical name so their short branch alias
            // (e.g. "JP Rizal") matches the inventory rows stored as "JP Rizal Branch".
            return normalizeBranchName(actor.getBranch());
        }
        if (requestedBranch == null || requestedBranch.isBlank() || requestedBranch.equalsIgnoreCase("All")) {
            return null;
        }
        return normalizeBranchName(requestedBranch);
    }


    private InventoryItemResponse toResponse(InventoryItem item) {
        return new InventoryItemResponse(
                item.getId(),
                item.getBranch(),
                item.getItemName(),
                item.getCategory(),
                item.getUnit(),
                item.getCurrentStock(),
                item.getReorderLevel(),
                item.getCurrentStock().compareTo(item.getReorderLevel()) <= 0,
                item.getProjectedDaysRemaining(),
                item.isLowStockWarning(),
                item.getUpdatedAt(),
                item.getAssetType(),
                item.getPurchaseDate(),
                item.getLastServicedDate(),
                item.getMaintenanceIntervalDays(),
                item.getAssetStatus(),
                item.getSupplierLeadTimeDays()
        );
    }

    @Transactional
    public InventoryItemResponse markServiced(Long itemId) {
        InventoryItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Inventory item not found."));
        item.setLastServicedDate(java.time.LocalDate.now());
        if (item.getAssetStatus() == null || "Under Maintenance".equals(item.getAssetStatus())) {
            item.setAssetStatus("Active");
        }
        InventoryItem saved = itemRepository.save(item);
        firestoreSyncService.upsert("inventory", String.valueOf(saved.getId()), toResponse(saved));
        return toResponse(saved);
    }

    private BigDecimal toSignedDelta(BigDecimal quantityDelta, StockDirection direction) {
        return switch (direction) {
            case IN -> quantityDelta;
            case OUT -> quantityDelta.negate();
        };
    }

    private boolean sameBranch(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
    }

    private boolean isLowStock(InventoryItem item) {
        return item != null
                && item.getCurrentStock() != null
                && item.getReorderLevel() != null
                && item.getCurrentStock().compareTo(item.getReorderLevel()) <= 0;
    }

    private void maybeNotifyLowStockCrossed(
            InventoryItem item,
            boolean wasLowStock,
            boolean isLowStock,
            String changeType
    ) {
        if (item == null || wasLowStock || !isLowStock) {
            return;
        }

        notificationService.enqueuePushToRoles(
                List.of(Role.ADMIN, Role.STAFF),
                item.getBranch(),
                "Low Stock Alert",
                "Inventory item %s at %s is low (%s %s remaining)."
                        .formatted(
                                item.getItemName(),
                                item.getBranch(),
                                item.getCurrentStock(),
                                item.getUnit()
                        ),
                "LOW_STOCK",
                item.getId() + ":" + changeType
        );
    }

    private static final Set<JobOrderStatus> CONSUMPTION_STATUSES = Set.of(
            JobOrderStatus.WASHING, JobOrderStatus.DRYING, JobOrderStatus.READY,
            JobOrderStatus.ASSIGNED_FOR_DELIVERY, JobOrderStatus.OUT_FOR_DELIVERY,
            JobOrderStatus.DELIVERED);

    /**
     * Returns per-day consumption derived from order activity (detergent/fabcon preferences per booking).
     * Uses orders in WASHING→DELIVERED statuses so data appears as soon as orders start processing.
     */
    public List<DailyConsumptionResponse> orderActivityStats(int daysBack, String branchParam, AuthUserDetails principal) {
        int effectiveDays = (daysBack > 0 && daysBack <= 365) ? daysBack : 60;
        LocalDateTime since = LocalDateTime.now().minusDays(effectiveDays);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");

        List<JobOrder> orders;
        if (principal.getUser().getRole() == Role.STAFF) {
            String staffBranch = principal.getUser().getBranch();
            orders = jobOrderRepository.findByBranchIgnoreCaseAndStatusInAndCreatedAtAfter(staffBranch, CONSUMPTION_STATUSES, since);
        } else if (branchParam != null && !branchParam.isBlank()) {
            orders = jobOrderRepository.findByBranchIgnoreCaseAndStatusInAndCreatedAtAfter(branchParam.trim(), CONSUMPTION_STATUSES, since);
        } else {
            orders = jobOrderRepository.findByStatusInAndCreatedAtAfter(CONSUMPTION_STATUSES, since);
        }

        // key = "branch||itemName"
        Map<String, Map<String, Double>> grouped = new LinkedHashMap<>();

        for (JobOrder order : orders) {
            String branch = order.getBranch() != null ? order.getBranch() : "Unknown";
            String dateKey = (order.getBookingDate() != null
                    ? order.getBookingDate()
                    : order.getCreatedAt().toLocalDate()).format(fmt);

            // Detergent
            String rawDet = order.getDetergentPreference();
            if (rawDet != null && !NO_SUPPLY_LABELS.contains(rawDet.trim().toLowerCase(Locale.ROOT))) {
                String detName = normalizeItemName(rawDet);
                if (CANONICAL_ITEM_NAMES.containsValue(detName) && detName.contains("Detergent")) {
                    int qty = order.getDetergentQuantity() != null && order.getDetergentQuantity() > 0
                            ? order.getDetergentQuantity() : 1;
                    grouped.computeIfAbsent(branch + "||" + detName, k -> new LinkedHashMap<>())
                           .merge(dateKey, (double) qty, Double::sum);
                }
            }

            // Fabric conditioner
            String rawFab = order.getFabricConditionerPreference();
            if (rawFab != null && !NO_SUPPLY_LABELS.contains(rawFab.trim().toLowerCase(Locale.ROOT))) {
                String fabName = normalizeItemName(rawFab);
                if (CANONICAL_ITEM_NAMES.containsValue(fabName) && fabName.contains("Conditioner")) {
                    int qty = order.getConditionerQuantity() != null && order.getConditionerQuantity() > 0
                            ? order.getConditionerQuantity() : 1;
                    grouped.computeIfAbsent(branch + "||" + fabName, k -> new LinkedHashMap<>())
                           .merge(dateKey, (double) qty, Double::sum);
                }
            }
        }

        if (grouped.isEmpty()) return List.of();

        List<String> allDates = Stream.iterate(
                LocalDate.now().minusDays(effectiveDays - 1L), d -> d.plusDays(1))
                .limit(effectiveDays)
                .map(d -> d.format(fmt))
                .toList();

        return grouped.entrySet().stream().map(entry -> {
            String[] parts = entry.getKey().split("\\|\\|", 2);
            String branch = parts[0];
            String itemName = parts.length > 1 ? parts[1] : "";
            List<DailyConsumptionResponse.DailyUsage> days = allDates.stream()
                    .map(date -> new DailyConsumptionResponse.DailyUsage(
                            date, entry.getValue().getOrDefault(date, 0.0)))
                    .toList();
            return new DailyConsumptionResponse(itemName, branch, "packs", days);
        }).toList();
    }

    /**
     * Returns upcoming confirmed demand from scheduled bookings within the next {@code horizonDays}.
     * Groups by canonical supply name and date so the frontend can plot a pipeline bar chart.
     */
    public List<BookingPipelineResponse> bookingPipeline(String branchParam, int horizonDays, AuthUserDetails principal) {
        int effectiveDays = (horizonDays > 0 && horizonDays <= 30) ? horizonDays : 14;
        String effectiveBranch = resolveEffectiveBranch(branchParam, principal.getUser());

        List<JobOrderStatus> pipelineStatuses = List.of(
                JobOrderStatus.PENDING,
                JobOrderStatus.ASSIGNED_FOR_PICKUP,
                JobOrderStatus.EN_ROUTE_TO_CUSTOMER,
                JobOrderStatus.LAUNDRY_COLLECTED,
                JobOrderStatus.EN_ROUTE_TO_BRANCH,
                JobOrderStatus.ORDER_RECEIVED
        );

        LocalDate today = LocalDate.now();
        LocalDate horizon = today.plusDays(effectiveDays);

        List<JobOrder> orders = effectiveBranch == null
                ? jobOrderRepository.findByStatusInAndBookingDateBetween(pipelineStatuses, today, horizon)
                : jobOrderRepository.findByBranchIgnoreCaseAndStatusInAndBookingDateBetween(effectiveBranch, pipelineStatuses, today, horizon);

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        Map<String, Map<String, Double>> itemDayDemand = new LinkedHashMap<>();

        for (JobOrder jo : orders) {
            LocalDate bookingDate = jo.getBookingDate();
            if (bookingDate == null) continue;
            String dateKey = bookingDate.format(fmt);

            String det = jo.getDetergentPreference();
            if (hasConsumableSelection(det)) {
                String name = normalizeItemName(det);
                int qty = (jo.getDetergentQuantity() != null && jo.getDetergentQuantity() > 0) ? jo.getDetergentQuantity() : 1;
                itemDayDemand.computeIfAbsent(name, k -> new LinkedHashMap<>()).merge(dateKey, (double) qty, Double::sum);
            }

            String fab = jo.getFabricConditionerPreference();
            if (hasConsumableSelection(fab)) {
                String name = normalizeItemName(fab);
                int qty = (jo.getConditionerQuantity() != null && jo.getConditionerQuantity() > 0) ? jo.getConditionerQuantity() : 1;
                itemDayDemand.computeIfAbsent(name, k -> new LinkedHashMap<>()).merge(dateKey, (double) qty, Double::sum);
            }
        }

        if (itemDayDemand.isEmpty()) return List.of();

        List<LocalDate> dates = Stream.iterate(today, d -> d.plusDays(1))
                .limit(effectiveDays)
                .toList();

        String[] dowNames = { "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN" };

        return itemDayDemand.entrySet().stream().map(entry -> {
            String itemName = entry.getKey();
            Map<String, Double> dayMap = entry.getValue();
            List<BookingPipelineResponse.DailyDemand> upcoming = dates.stream()
                    .map(d -> {
                        String dk = d.format(fmt);
                        int dowIdx = d.getDayOfWeek().getValue() - 1; // Mon=0, Sun=6
                        String dayLabel = dowNames[dowIdx];
                        double qty = dayMap.getOrDefault(dk, 0.0);
                        return new BookingPipelineResponse.DailyDemand(dk, dayLabel, qty);
                    }).toList();
            return new BookingPipelineResponse(itemName, upcoming);
        }).toList();
    }

    /**
     * Returns per-day OUT (consumption) totals per item for the requested lookback period.
     * Only negative quantityDelta movements (stock consumed/adjusted out) are counted.
     */
    public List<DailyConsumptionResponse> dailyStats(int daysBack, String branchParam, AuthUserDetails principal) {
        int effectiveDays = (daysBack > 0 && daysBack <= 365) ? daysBack : 60;
        LocalDateTime since = LocalDateTime.now().minusDays(effectiveDays);

        List<InventoryMovement> movements;
        if (principal.getUser().getRole() == Role.STAFF) {
            String branch = principal.getUser().getBranch();
            movements = movementRepository.findOutMovementsByBranchSince(branch, since);
        } else if (branchParam != null && !branchParam.isBlank()) {
            movements = movementRepository.findOutMovementsByBranchSince(branchParam.trim(), since);
        } else {
            movements = movementRepository.findAllOutMovementsSince(since);
        }

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        List<String> allDates = Stream.iterate(
                LocalDate.now().minusDays(effectiveDays - 1L), d -> d.plusDays(1))
                .limit(effectiveDays)
                .map(d -> d.format(fmt))
                .toList();

        // key = "branch||itemName"
        Map<String, Map<String, Double>> grouped = new LinkedHashMap<>();
        Map<String, String> keyToUnit = new LinkedHashMap<>();

        for (InventoryMovement m : movements) {
            String key = m.getInventoryItem().getBranch() + "||" + m.getInventoryItem().getItemName();
            String dateKey = m.getCreatedAt().format(fmt);
            grouped.computeIfAbsent(key, k -> new LinkedHashMap<>())
                   .merge(dateKey, m.getQuantityDelta().abs().doubleValue(), Double::sum);
            keyToUnit.putIfAbsent(key, m.getInventoryItem().getUnit());
        }

        return grouped.entrySet().stream().map(entry -> {
            String[] parts = entry.getKey().split("\\|\\|", 2);
            String branch = parts[0];
            String itemName = parts.length > 1 ? parts[1] : "";
            String unit = keyToUnit.getOrDefault(entry.getKey(), "units");
            List<DailyConsumptionResponse.DailyUsage> days = allDates.stream()
                    .map(date -> new DailyConsumptionResponse.DailyUsage(
                            date, entry.getValue().getOrDefault(date, 0.0)))
                    .toList();
            return new DailyConsumptionResponse(itemName, branch, unit, days);
        }).toList();
    }
}
