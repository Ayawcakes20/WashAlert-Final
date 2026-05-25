package com.washalert.washalertbackend.inventory;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Component
@Slf4j
public class InventorySeeder {

    private static final String BRANCH = "Triplets - Makati";

    private final InventoryItemRepository repository;

    public InventorySeeder(InventoryItemRepository repository) {
        this.repository = repository;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seed() {
        List<SeedItem> items = List.of(
            // ── Consumables ──────────────────────────────────────────────────
            new SeedItem("Surf Detergent",             "Detergent",          "packs",   new BigDecimal("10"), 50, "Consumable", null, null, null, null),
            new SeedItem("Ariel Detergent",            "Detergent",          "packs",   new BigDecimal("10"), 40, "Consumable", null, null, null, null),
            new SeedItem("Champion Detergent",         "Detergent",          "packs",   new BigDecimal("10"), 30, "Consumable", null, null, null, null),
            new SeedItem("Tide Detergent",             "Detergent",          "packs",   new BigDecimal("10"), 30, "Consumable", null, null, null, null),
            new SeedItem("Charm Fabric Conditioner",   "Fabric Conditioner", "packs",   new BigDecimal("10"), 40, "Consumable", null, null, null, null),
            new SeedItem("Downy Fabric Conditioner",   "Fabric Conditioner", "packs",   new BigDecimal("10"), 40, "Consumable", null, null, null, null),
            new SeedItem("Surf Fabric Conditioner",    "Fabric Conditioner", "packs",   new BigDecimal("10"), 30, "Consumable", null, null, null, null),
            new SeedItem("Cuddle Fabric Conditioner",  "Fabric Conditioner", "packs",   new BigDecimal("10"), 20, "Consumable", null, null, null, null),
            new SeedItem("Zonrox Bleach",              "Bleach",             "bottles", new BigDecimal("5"),  20, "Consumable", null, null, null, null),
            new SeedItem("Generic Dryer Sheet",        "Dryer Sheet",        "pieces",  new BigDecimal("5"),  50, "Consumable", null, null, null, null),
            // ── Assets ───────────────────────────────────────────────────────
            new SeedItem("LG Washing Machine #1",      "Washing Machine",    "units",   BigDecimal.ZERO,       0, "Asset",
                LocalDate.of(2022, 3, 15), LocalDate.of(2024, 9, 1), 180, "Active"),
            new SeedItem("LG Washing Machine #2",      "Washing Machine",    "units",   BigDecimal.ZERO,       0, "Asset",
                LocalDate.of(2022, 3, 15), LocalDate.of(2024, 6, 1), 180, "Active"),
            new SeedItem("Samsung Dryer #1",           "Dryer",              "units",   BigDecimal.ZERO,       0, "Asset",
                LocalDate.of(2021, 11, 10), LocalDate.of(2024, 8, 15), 180, "Active"),
            new SeedItem("Panasonic Aircon #1",        "Aircon",             "units",   BigDecimal.ZERO,       0, "Asset",
                LocalDate.of(2023, 1, 20), LocalDate.of(2024, 7, 1), 90, "Active"),
            new SeedItem("Generic Electric Fan #1",    "Electric Fan",       "units",   BigDecimal.ZERO,       0, "Asset",
                LocalDate.of(2023, 5, 5), LocalDate.of(2024, 5, 5), 365, "Active"),
            new SeedItem("Panasonic Iron #1",          "Iron",               "units",   BigDecimal.ZERO,       0, "Asset",
                LocalDate.of(2022, 8, 1), LocalDate.of(2024, 2, 1), 365, "Under Maintenance"),
            new SeedItem("Hikvision CCTV #1",          "CCTV",               "units",   BigDecimal.ZERO,       0, "Asset",
                LocalDate.of(2021, 6, 10), LocalDate.of(2024, 6, 10), 365, "Active")
        );

        for (SeedItem item : items) {
            boolean exists = repository.findByBranchIgnoreCaseAndItemNameIgnoreCase(BRANCH, item.name()).isPresent();
            if (!exists) {
                InventoryItem entity = InventoryItem.builder()
                        .branch(BRANCH)
                        .itemName(item.name())
                        .category(item.category())
                        .unit(item.unit())
                        .currentStock(item.initialStock())
                        .reorderLevel(BigDecimal.valueOf(item.reorderLevel()))
                        .lowStockWarning(false)
                        .assetType(item.assetType())
                        .purchaseDate(item.purchaseDate())
                        .lastServicedDate(item.lastServicedDate())
                        .maintenanceIntervalDays(item.maintenanceIntervalDays())
                        .assetStatus(item.assetStatus())
                        .build();
                repository.save(entity);
                log.info("[INVENTORY SEEDER] Created '{}' ({}) for branch '{}'", item.name(), item.assetType(), BRANCH);
            }
        }
    }

    private record SeedItem(
            String name,
            String category,
            String unit,
            BigDecimal initialStock,
            int reorderLevel,
            String assetType,
            LocalDate purchaseDate,
            LocalDate lastServicedDate,
            Integer maintenanceIntervalDays,
            String assetStatus
    ) {}
}
