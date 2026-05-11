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
                    .itemName(req.itemName().trim())
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
        String itemName = req.itemName().trim();

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

        deductConsumable(branch, order.getDetergentPreference(), order.getTrackingNumber(), actor);
        deductConsumable(branch, order.getFabricConditionerPreference(), order.getTrackingNumber(), actor);
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

    private void deductConsumable(String branch, String itemName, String trackingNumber, String actor) {
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
            BigDecimal next = item.getCurrentStock().subtract(BigDecimal.ONE);
            if (next.compareTo(BigDecimal.ZERO) < 0) {
                log.warn("[INVENTORY] Deduct skipped — negative stock would result for '{}' in '{}'", itemName, branch);
                return;
            }
            boolean wasLow = isLowStock(item);
            item.setCurrentStock(next);
            InventoryItem saved = itemRepository.save(item);
            InventoryMovement movement = InventoryMovement.builder()
                    .inventoryItem(saved)
                    .quantityDelta(BigDecimal.ONE.negate())
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

            return new InventoryForecastResponse(
                    item.id(),
                    item.branch(),
                    item.itemName(),
                    item.currentStock(),
                    dailyUsage,
                    projected,
                    daysUntilStockout
            );
        }).toList();
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
        return !normalized.isBlank() && !normalized.equals("none");
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
