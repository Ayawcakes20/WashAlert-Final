package com.washalert.washalertbackend.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class DatabaseInitializationService {
    private static final Logger log = LoggerFactory.getLogger(DatabaseInitializationService.class);
    private final JdbcTemplate jdbcTemplate;

    public DatabaseInitializationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void init() {
        log.info("[DB-INIT] Manually expanding status column lengths to 50...");
        try {
            // Force expand JobOrder status column
            jdbcTemplate.execute("ALTER TABLE job_orders MODIFY status VARCHAR(50)");
            log.info("[DB-INIT] Successfully expanded job_orders.status to 50");
        } catch (Exception e) {
            log.warn("[DB-INIT] Failed to modify job_orders.status (might already be expanded): {}", e.getMessage());
        }

        try {
            // Force expand JobOrderStatusHistory status column
            jdbcTemplate.execute("ALTER TABLE job_order_status_history MODIFY status VARCHAR(50)");
            log.info("[DB-INIT] Successfully expanded job_order_status_history.status to 50");
        } catch (Exception e) {
            log.warn("[DB-INIT] Failed to modify job_order_status_history.status: {}", e.getMessage());
        }
        
        log.info("[DB-INIT] Database schema hardening complete.");
    }
}
