package com.washalert.washalertbackend.inventory;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * One-time (idempotent) startup migration that consolidates inventory rows whose
 * branch is stored under a legacy / short alias (e.g. "JP Rizal") into the
 * canonical form used everywhere else ("JP Rizal Branch").
 *
 * Rules:
 *  - If a canonical row already exists for the same item name:
 *      → Add the legacy row's currentStock into the canonical row.
 *      → Delete the legacy row and its movements (they are historical noise).
 *  - If NO canonical row exists yet:
 *      → Simply rename the legacy row's branch field in-place.
 *
 * This is safe to run repeatedly — once all legacy rows are gone, the query
 * returns an empty list and the method is effectively a no-op.
 */
@Component
@Slf4j
@Order(1) // Run before InventorySeeder so seeder sees the cleaned-up data
public class InventoryBranchMigrationRunner {

    // Maps every known legacy/short alias (lower-case) → canonical DB branch name
    private static final Map<String, String> ALIASES = new LinkedHashMap<>() {{
        put("jp rizal",                         "JP Rizal Branch");
        put("speedywash - jp rizal",            "JP Rizal Branch");
        put("makati",                           "Makati Branch");
        put("triplets laundryhubs - makati",    "Makati Branch");
        put("triplets - makati",                "Makati Branch");
        put("chestnut",                         "Chestnut Branch");
        put("chestnut st",                      "Chestnut Branch");
        put("speedywash - chestnut",            "Chestnut Branch");
        put("republic",                         "Republic Branch");
        put("republic ave",                     "Republic Branch");
        put("speedywash - republic",            "Republic Branch");
        put("holy spirit",                      "Holy Spirit Branch");
        put("tondo",                            "Holy Spirit Branch");
        put("speedywash - t.o.n",              "Holy Spirit Branch");
        put("sta. catalina",                    "Sta. Catalina Branch");
        put("s. catalina",                      "Sta. Catalina Branch");
        put("speedywash - s. catalina",         "Sta. Catalina Branch");
        put("brookside",                        "Brookside Branch");
        put("pasig city",                       "Brookside Branch");
        put("speedywash - pasig",               "Brookside Branch");
        put("luzon",                            "Luzon Branch");
        put("samat st",                         "Luzon Branch");
        put("st. anthony",                      "St. Anthony Branch");
        put("st. nino",                         "St. Anthony Branch");
        put("up diliman",                       "UP Diliman / San Vicente Branch");
        put("speedywash - up diliman",          "UP Diliman / San Vicente Branch");
    }};

    private final InventoryItemRepository itemRepo;
    private final InventoryMovementRepository movementRepo;

    public InventoryBranchMigrationRunner(
            InventoryItemRepository itemRepo,
            InventoryMovementRepository movementRepo
    ) {
        this.itemRepo = itemRepo;
        this.movementRepo = movementRepo;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void migrate() {
        int renamed = 0;
        int merged  = 0;

        // Fetch ALL inventory items once so we can check for canonical matches in memory
        List<InventoryItem> all = itemRepo.findAll();

        for (InventoryItem item : all) {
            if (item.getBranch() == null) continue;

            String legacy = item.getBranch().trim().toLowerCase(java.util.Locale.ROOT);
            String canonical = ALIASES.get(legacy);

            // Skip if this row's branch is already canonical or not in the alias map
            if (canonical == null) continue;
            // Also skip if it somehow already stored the canonical name (case-insensitive)
            if (item.getBranch().trim().equalsIgnoreCase(canonical)) continue;

            // Does a canonical row already exist for the same item name?
            Optional<InventoryItem> canonicalOpt =
                    itemRepo.findByNormalizedBranchAndItemNameIgnoreCase(
                            canonical, item.getItemName());

            if (canonicalOpt.isPresent()) {
                // ── MERGE ──────────────────────────────────────────────────
                // Add the legacy stock into the canonical row, then delete legacy
                InventoryItem canonicalItem = canonicalOpt.get();
                BigDecimal combined = canonicalItem.getCurrentStock()
                        .add(item.getCurrentStock());
                canonicalItem.setCurrentStock(combined);
                itemRepo.save(canonicalItem);

                // Remove movements tied to legacy item, then remove the item itself
                movementRepo.deleteByInventoryItem_Id(item.getId());
                itemRepo.delete(item);

                log.info("[INVENTORY MIGRATE] Merged legacy branch '{}' (id={}, stock={}) → '{}' (id={}) → new stock={}",
                        item.getBranch(), item.getId(), item.getCurrentStock(),
                        canonical, canonicalItem.getId(), combined);
                merged++;

            } else {
                // ── RENAME ─────────────────────────────────────────────────
                // No canonical row exists — just fix the branch name in-place
                String oldBranch = item.getBranch();
                item.setBranch(canonical);
                itemRepo.save(item);

                log.info("[INVENTORY MIGRATE] Renamed branch '{}' → '{}' for item '{}' (id={})",
                        oldBranch, canonical, item.getItemName(), item.getId());
                renamed++;
            }
        }

        if (renamed + merged > 0) {
            log.info("[INVENTORY MIGRATE] Done — {} row(s) renamed, {} row(s) merged.", renamed, merged);
        } else {
            log.debug("[INVENTORY MIGRATE] No legacy branch rows found — nothing to do.");
        }
    }
}
