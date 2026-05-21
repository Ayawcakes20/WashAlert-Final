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

        // ── job_orders table — all columns that may have been added after initial deploy ──
        addColumnIfMissing("job_orders", "branch_id",                   "BIGINT");
        addColumnIfMissing("job_orders", "customer_phone",              "VARCHAR(30)");
        addColumnIfMissing("job_orders", "delivery_address",            "VARCHAR(255)");
        addColumnIfMissing("job_orders", "delivery_unit_floor",         "VARCHAR(100)");
        addColumnIfMissing("job_orders", "delivery_contact_name",       "VARCHAR(120)");
        addColumnIfMissing("job_orders", "delivery_contact_phone",      "VARCHAR(30)");
        addColumnIfMissing("job_orders", "delivery_latitude",           "DOUBLE");
        addColumnIfMissing("job_orders", "delivery_longitude",          "DOUBLE");
        addColumnIfMissing("job_orders", "branch_latitude",             "DOUBLE");
        addColumnIfMissing("job_orders", "branch_longitude",            "DOUBLE");
        addColumnIfMissing("job_orders", "detergent_quantity",          "INT");
        addColumnIfMissing("job_orders", "conditioner_quantity",        "INT");
        addColumnIfMissing("job_orders", "service_price",               "DECIMAL(10,2)");
        addColumnIfMissing("job_orders", "supplies_price",              "DECIMAL(10,2)");
        addColumnIfMissing("job_orders", "delivery_price",              "DECIMAL(10,2)");
        addColumnIfMissing("job_orders", "rush_price",                  "DECIMAL(10,2)");
        addColumnIfMissing("job_orders", "final_price",                 "DECIMAL(10,2)");
        addColumnIfMissing("job_orders", "actual_weight_kg",            "DECIMAL(7,2)");
        addColumnIfMissing("job_orders", "price_confirmed_at",          "DATETIME(6)");
        addColumnIfMissing("job_orders", "price_confirmed_by_customer", "TINYINT(1) NOT NULL DEFAULT 0");
        addColumnIfMissing("job_orders", "price_confirmation_deadline", "DATETIME(6)");
        addColumnIfMissing("job_orders", "service_name",                "VARCHAR(100)");
        addColumnIfMissing("job_orders", "load_size",                   "VARCHAR(20)");
        addColumnIfMissing("job_orders", "assigned_pickup_driver_id",   "BIGINT");
        addColumnIfMissing("job_orders", "assigned_delivery_driver_id", "BIGINT");
        addColumnIfMissing("job_orders", "assigned_at",                 "DATETIME(6)");
        addColumnIfMissing("job_orders", "pickup_confirmed_at",         "DATETIME(6)");
        addColumnIfMissing("job_orders", "laundry_collected_at",        "DATETIME(6)");
        addColumnIfMissing("job_orders", "arrived_at_branch_at",        "DATETIME(6)");
        addColumnIfMissing("job_orders", "delivered_at",                "DATETIME(6)");
        addColumnIfMissing("job_orders", "cod_collected",               "TINYINT(1) NOT NULL DEFAULT 0");
        addColumnIfMissing("job_orders", "cod_collected_at",            "DATETIME(6)");
        addColumnIfMissing("job_orders", "delivery_failed_reason",      "VARCHAR(300)");
        addColumnIfMissing("job_orders", "driver_lat",                  "DOUBLE");
        addColumnIfMissing("job_orders", "driver_lng",                  "DOUBLE");

        // ── users table ────────────────────────────────────────────────────────
        addColumnIfMissing("users", "mobile_number",      "VARCHAR(20)");
        addColumnIfMissing("users", "profile_image_url",  "VARCHAR(1000)");
        addColumnIfMissing("users", "branch_id",          "BIGINT");
        addColumnIfMissing("users", "fcm_token",          "VARCHAR(500)");

        // ── FK indexes (best-effort, ignored if they already exist) ────────────
        addIndexIfMissing("job_orders", "idx_jo_pickup_driver",   "assigned_pickup_driver_id");
        addIndexIfMissing("job_orders", "idx_jo_delivery_driver", "assigned_delivery_driver_id");

        log.info("[SchemaMigration] Schema migration complete.");
    }

    private void addColumnIfMissing(String table, String column, String definition) {
        try {
            String checkSql = "SELECT count(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?";
            Integer count = jdbc.queryForObject(checkSql, Integer.class, table, column);
            
            if (count == null || count == 0) {
                String sql = String.format("ALTER TABLE `%s` ADD COLUMN `%s` %s", table, column, definition);
                jdbc.execute(sql);
                log.info("[SchemaMigration] Added column {}.{}", table, column);
            } else {
                log.debug("[SchemaMigration] Column {}.{} already exists", table, column);
            }
        } catch (Exception e) {
            log.warn("[SchemaMigration] Error adding {}.{}: {}", table, column, e.getMessage());
        }
    }

    private void addIndexIfMissing(String table, String indexName, String column) {
        try {
            String checkSql = "SELECT count(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?";
            Integer count = jdbc.queryForObject(checkSql, Integer.class, table, indexName);
            
            if (count == null || count == 0) {
                String sql = String.format("CREATE INDEX `%s` ON `%s` (`%s`)", indexName, table, column);
                jdbc.execute(sql);
                log.info("[SchemaMigration] Added index {}", indexName);
            }
        } catch (Exception e) {
            log.warn("[SchemaMigration] Error adding index {}: {}", indexName, e.getMessage());
        }
    }
}
