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
        LocalDate today = LocalDate.now();

        List<SeedItem> items = List.of(
            // Consumables — the 4 real items used in orders
            new SeedItem("Surf Detergent",           "Detergent",          "packs",  new BigDecimal("50"), new BigDecimal("10"),
                "Consumable", null, null, null, null),
            new SeedItem("Ariel Detergent",          "Detergent",          "packs",  new BigDecimal("40"), new BigDecimal("10"),
                "Consumable", null, null, null, null),
            new SeedItem("Charm Fabric Conditioner", "Fabric Conditioner", "packs",  new BigDecimal("40"), new BigDecimal("10"),
                "Consumable", null, null, null, null),
            new SeedItem("Downy Fabric Conditioner", "Fabric Conditioner", "packs",  new BigDecimal("40"), new BigDecimal("10"),
                "Consumable", null, null, null, null),
            // Assets — equipment tracked per branch
            new SeedItem("LG Washing Machine #1",    "Washing Machine",    "units",  BigDecimal.ZERO, BigDecimal.ZERO,
                "Asset", today.minusYears(3), today.minusDays(45), 90, "Active"),
            new SeedItem("LG Washing Machine #2",    "Washing Machine",    "units",  BigDecimal.ZERO, BigDecimal.ZERO,
                "Asset", today.minusYears(3), today.minusDays(20), 90, "Active"),
            new SeedItem("Samsung Dryer #1",         "Dryer",              "units",  BigDecimal.ZERO, BigDecimal.ZERO,
                "Asset", today.minusYears(2), today.minusDays(30), 90, "Active"),
            new SeedItem("Panasonic Aircon #1",      "Aircon",             "units",  BigDecimal.ZERO, BigDecimal.ZERO,
                "Asset", today.minusYears(2), today.minusDays(150), 180, "Active"),
            new SeedItem("Generic Electric Fan #1",  "Electric Fan",       "units",  BigDecimal.ZERO, BigDecimal.ZERO,
                "Asset", today.minusYears(2), today.minusDays(200), 365, "Active")
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
                        .reorderLevel(item.reorderLevel())
                        .lowStockWarning(false)
                        .assetType(item.assetType())
                        .purchaseDate(item.purchaseDate())
                        .lastServicedDate(item.lastServicedDate())
                        .maintenanceIntervalDays(item.maintenanceIntervalDays())
                        .assetStatus(item.assetStatus())
                        .build();
                repository.save(entity);
                log.info("[INVENTORY SEEDER] Created '{}' for branch '{}'", item.name(), BRANCH);
            }
        }
    }

    private record SeedItem(
            String name, String category, String unit,
            BigDecimal initialStock, BigDecimal reorderLevel,
            String assetType, LocalDate purchaseDate, LocalDate lastServicedDate,
            Integer maintenanceIntervalDays, String assetStatus) {}
}
