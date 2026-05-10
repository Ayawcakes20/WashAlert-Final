package com.washalert.washalertbackend.inventory;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
                new SeedItem("Surf Detergent",           "Detergent",           "packs", new BigDecimal("10")),
                new SeedItem("Ariel Detergent",          "Detergent",           "packs", new BigDecimal("10")),
                new SeedItem("Charm Fabric Conditioner", "Fabric Conditioner",  "packs", new BigDecimal("10")),
                new SeedItem("Downy Fabric Conditioner", "Fabric Conditioner",  "packs", new BigDecimal("10"))
        );

        for (SeedItem item : items) {
            boolean exists = repository.findByBranchIgnoreCaseAndItemNameIgnoreCase(BRANCH, item.name()).isPresent();
            if (!exists) {
                InventoryItem entity = InventoryItem.builder()
                        .branch(BRANCH)
                        .itemName(item.name())
                        .category(item.category())
                        .unit(item.unit())
                        .currentStock(BigDecimal.ZERO)
                        .reorderLevel(item.reorderLevel())
                        .lowStockWarning(false)
                        .build();
                repository.save(entity);
                log.info("[INVENTORY SEEDER] Created '{}' for branch '{}'", item.name(), BRANCH);
            }
        }
    }

    private record SeedItem(String name, String category, String unit, BigDecimal reorderLevel) {}
}
