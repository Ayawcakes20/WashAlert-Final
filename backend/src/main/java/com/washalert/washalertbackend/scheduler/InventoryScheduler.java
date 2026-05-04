package com.washalert.washalertbackend.scheduler;

import com.washalert.washalertbackend.inventory.InventoryItem;
import com.washalert.washalertbackend.inventory.InventoryItemRepository;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

/**
 * Predictive Inventory Scheduler
 * Calculates weekly consumption rates and projects remaining days of stock.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InventoryScheduler {

    private final InventoryItemRepository inventoryRepository;
    private final JobOrderRepository bookingRepository;

    @Scheduled(cron = "0 0 0 * * *") // Daily at midnight
    @Transactional
    public void calculateInventoryProjections() {
        log.info("[INVENTORY] Starting daily inventory projection task...");

        // 1. Query bookings with status DELIVERED in past 28 days
        LocalDateTime twentyEightDaysAgo = LocalDateTime.now().minusDays(28);
        List<JobOrderStatus> completedStatuses = List.of(JobOrderStatus.DELIVERED);
        List<JobOrder> recentOrders = bookingRepository.findByStatusInAndCreatedAtAfter(completedStatuses, twentyEightDaysAgo);

        // 2. Count usage per item name
        Map<String, Integer> usageCounts = new HashMap<>();
        usageCounts.put("SURF", 0);
        usageCounts.put("ARIEL", 0);
        usageCounts.put("CHARM", 0);
        usageCounts.put("DOWNY", 0);

        for (JobOrder order : recentOrders) {
            String detergent = order.getDetergentPreference();
            String conditioner = order.getFabricConditionerPreference();

            if (detergent != null) {
                String detUpper = detergent.toUpperCase();
                if (detUpper.contains("SURF")) usageCounts.merge("SURF", 1, Integer::sum);
                else if (detUpper.contains("ARIEL")) usageCounts.merge("ARIEL", 1, Integer::sum);
            }

            if (conditioner != null) {
                String condUpper = conditioner.toUpperCase();
                if (condUpper.contains("CHARM")) usageCounts.merge("CHARM", 1, Integer::sum);
                else if (condUpper.contains("DOWNY")) usageCounts.merge("DOWNY", 1, Integer::sum);
            }
        }

        int flaggedItemsCount = 0;

        // Process each tracked item
        for (String itemName : usageCounts.keySet()) {
            // 3. Weekly average consumption rate (Total / 4)
            double weeklyAverage = usageCounts.get(itemName) / 4.0;

            // 4. Query all inventory items matching this name (across all branches)
            List<InventoryItem> items = inventoryRepository.findByItemNameIgnoreCase(itemName);
            
            for (InventoryItem item : items) {
                int projectedDays;
                boolean lowStock;

                // 5. Calculate projectedDaysRemaining
                if (weeklyAverage <= 0) {
                    // Edge case: item never ordered in past 28 days
                    projectedDays = 999;
                    lowStock = false;
                } else {
                    double currentQty = (item.getCurrentStock() != null) ? item.getCurrentStock().doubleValue() : 0.0;
                    projectedDays = (int) Math.round((currentQty / weeklyAverage) * 7);
                    
                    // 6. Set warning flag if 7 days or less remaining
                    lowStock = projectedDays <= 7;
                }

                // 7. Save updated projections back to database
                item.setProjectedDaysRemaining(projectedDays);
                item.setLowStockWarning(lowStock);
                inventoryRepository.save(item);

                if (lowStock) {
                    flaggedItemsCount++;
                }
            }
        }

        log.info("Inventory projection updated: {} items flagged as low stock.", flaggedItemsCount);
    }
}
