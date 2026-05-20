package com.washalert.washalertbackend.migration;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * SchemaMigrationRunner — runs safe ALTER TABLE / ADD COLUMN statements on startup.
 *
 * Each statement uses "ADD COLUMN IF NOT EXISTS" so it is idempotent — safe to run
 * repeatedly even if the column already exists. This supplements ddl-auto and ensures
 * the production Railway DB is always up to date regardless of JPA_DDL_AUTO env var.
 */
@Slf4j
@Component
public class SchemaMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    public SchemaMigrationRunner(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info("[SchemaMigration] Starting safe schema migration...");

        // ── job_orders table ───────────────────────────────────────────────────
        addColumnIfMissing("job_orders", "assigned_pickup_driver_id",   "BIGINT");
        addColumnIfMissing("job_orders", "assigned_delivery_driver_id", "BIGINT");
        addColumnIfMissing("job_orders", "laundry_collected_at",        "DATETIME(6)");
        addColumnIfMissing("job_orders", "arrived_at_branch_at",        "DATETIME(6)");
        addColumnIfMissing("job_orders", "driver_lat",                  "DOUBLE");
        addColumnIfMissing("job_orders", "driver_lng",                  "DOUBLE");
        addColumnIfMissing("job_orders", "detergent_quantity",          "INT");
        addColumnIfMissing("job_orders", "conditioner_quantity",        "INT");
        addColumnIfMissing("job_orders", "branch_id",                   "BIGINT");
        addColumnIfMissing("job_orders", "cod_collected",               "TINYINT(1) NOT NULL DEFAULT 0");
        addColumnIfMissing("job_orders", "cod_collected_at",            "DATETIME(6)");
        addColumnIfMissing("job_orders", "delivery_failed_reason",      "VARCHAR(300)");
        addColumnIfMissing("job_orders", "pickup_confirmed_at",         "DATETIME(6)");

        // ── users table ────────────────────────────────────────────────────────
        addColumnIfMissing("users", "mobile_number",      "VARCHAR(20)");
        addColumnIfMissing("users", "profile_image_url",  "VARCHAR(1000)");
        addColumnIfMissing("users", "branch_id",          "BIGINT");

        // ── FK indexes (best-effort, ignored if they already exist) ────────────
        addIndexIfMissing("job_orders", "idx_jo_pickup_driver",   "assigned_pickup_driver_id");
        addIndexIfMissing("job_orders", "idx_jo_delivery_driver", "assigned_delivery_driver_id");

        log.info("[SchemaMigration] Schema migration complete.");
    }

    private void addColumnIfMissing(String table, String column, String definition) {
        try {
            // MySQL 8+ supports IF NOT EXISTS — use it directly
            String sql = String.format(
                    "ALTER TABLE `%s` ADD COLUMN IF NOT EXISTS `%s` %s",
                    table, column, definition);
            jdbc.execute(sql);
            log.debug("[SchemaMigration] Ensured column {}.{}", table, column);
        } catch (Exception e) {
            // Older MySQL / MariaDB may not support IF NOT EXISTS — swallow safely
            log.warn("[SchemaMigration] Could not add {}.{}: {}", table, column, e.getMessage());
        }
    }

    private void addIndexIfMissing(String table, String indexName, String column) {
        try {
            String sql = String.format(
                    "CREATE INDEX IF NOT EXISTS `%s` ON `%s` (`%s`)",
                    indexName, table, column);
            jdbc.execute(sql);
        } catch (Exception e) {
            log.debug("[SchemaMigration] Index {} skipped: {}", indexName, e.getMessage());
        }
    }
}
