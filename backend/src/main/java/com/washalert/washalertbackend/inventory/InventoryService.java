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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Slf4j
public class InventoryService {
    private static final BigDecimal FORECAST_DETERGENT_PER_KG = new BigDecimal("0.03");
    private static final BigDecimal FORECAST_CONDITIONER_PER_KG = new BigDecimal("0.02");
    private static final BigDecimal DEFAULT_ORDER_WEIGHT_KG = new BigDecimal("5.00");

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
        if (rawItemName == null || rawItemName.isBlank()) return;
        String lower = rawItemName.trim().toLowerCase(Locale.ROOT);
        if (lower.equals("none") || lower.equals("no detergent") || lower.equals("no fabric conditioner")
                || lower.equals("customer provided")) return;
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
                    .findByBranchIgnoreCaseAndItemNameIgnoreCase(branch.trim(), def.itemName())
                    .orElse(null);
            int qty = (item != null && item.getCurrentStock() != null)
                    ? item.getCurrentStock().intValue() : 0;
            return new SupplyItemAvailability(def.id(), def.itemName(), qty > 0, qty);
        }).toList();

        var fabItems = fabDefs.stream().map(def -> {
            InventoryItem item = itemRepository
                    .findByBranchIgnoreCaseAndItemNameIgnoreCase(branch.trim(), def.itemName())
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
                    .lowStockWarning(false) // Explicitly set default
                    .projectedDaysRemaining(null) // Initially null
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
     * Auto-deducts 1 pack each of the order's detergent and fabric conditioner
     * from branch inventory when washing begins. Failures are swallowed so an
     * inventory gap never blocks an order status transition.
     */
    @Transactional
    public void deductForOrder(JobOrder order) {
        if (order == null || order.getBranch() == null) return;
        String branch = order.getBranch().trim();
        String actor = "system";

        int detQty = (order.getDetergentQuantity() != null && order.getDetergentQuantity() > 0) ? order.getDetergentQuantity() : 1;
        int conQty = (order.getConditionerQuantity() != null && order.getConditionerQuantity() > 0) ? order.getConditionerQuantity() : 1;
        deductConsumable(branch, order.getDetergentPreference(), detQty, order.getTrackingNumber(), actor);
        deductConsumable(branch, order.getFabricConditionerPreference(), conQty, order.getTrackingNumber(), actor);
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

    private void deductConsumable(String branch, String itemName, int qty, String trackingNumber, String actor) {
        if (itemName == null || itemName.isBlank()) return;
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
                    .reason("Order: " + trackingNumber)
                    .performedBy(actor)
                    .build();
            movementRepository.save(movement);
            firestoreSyncService.upsert("inventory", String.valueOf(saved.getId()), toResponse(saved));
            maybeNotifyLowStockCrossed(saved, wasLow, isLowStock(saved), "deducted");
        } catch (Exception ex) {
            log.error("[INVENTORY] Failed to deduct '{}' for order '{}': {}", itemName, trackingNumber, ex.getMessage());
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

        return list(branch, principal).stream().map(item -> {
            BigDecimal dailyUsage = estimateOrderBackedDailyUsage(item, usageByBranch);
            if (dailyUsage.compareTo(BigDecimal.ZERO) == 0 && item.id() != null) {
                dailyUsage = movementBasedDailyUsage(item.id(), since);
            }
            BigDecimal projected = item.currentStock().subtract(dailyUsage.multiply(BigDecimal.valueOf(horizonDays)));
            if (projected.compareTo(BigDecimal.ZERO) < 0) projected = BigDecimal.ZERO;

            BigDecimal daysUntilStockout = null;
            if (dailyUsage.compareTo(BigDecimal.ZERO) > 0) {
                daysUntilStockout = item.currentStock().divide(dailyUsage, 2, RoundingMode.HALF_UP);
            }

            String narrative = buildForecastNarrative(item.itemName(), item.branch(), item.currentStock(),
                    item.reorderLevel(), dailyUsage, daysUntilStockout, horizonDays);
            return new InventoryForecastResponse(
                    item.id(),
                    item.branch(),
                    item.itemName(),
                    item.currentStock(),
                    dailyUsage,
                    projected,
                    daysUntilStockout,
                    narrative
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
        if (value == null) return false;
        String normalized = value.trim().toLowerCase();
        return !normalized.isBlank() && !normalized.equals("none") && !normalized.equals("customer provided");
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

    private String resolveEffectiveBranch(String requestedBranch, User actor) {
        if (actor.getRole() == Role.STAFF) {
            return actor.getBranch();
        }
        if (requestedBranch == null || requestedBranch.isBlank() || requestedBranch.equalsIgnoreCase("All")) {
            return null;
        }
        return requestedBranch.trim();
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
                item.getUpdatedAt()
        );
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
}
