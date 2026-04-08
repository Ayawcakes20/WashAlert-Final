package com.washalert.washalertbackend.notification;

import com.washalert.washalertbackend.dashboard.DashboardService;
import com.washalert.washalertbackend.inventory.InventoryService;
import com.washalert.washalertbackend.notification.dto.AppNotificationResponse;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class NotificationCenterService {

    private final DashboardService dashboardService;
    private final InventoryService inventoryService;

    public NotificationCenterService(
            DashboardService dashboardService,
            InventoryService inventoryService
    ) {
        this.dashboardService = dashboardService;
        this.inventoryService = inventoryService;
    }

    public List<AppNotificationResponse> list(AuthUserDetails principal) {
        var summary = dashboardService.summary(principal);
        LocalDateTime now = LocalDateTime.now();
        List<AppNotificationResponse> items = new ArrayList<>();

        if (summary.orders().pending() > 0) {
            items.add(new AppNotificationResponse(
                    "orders-pending",
                    "Pending Orders",
                    summary.orders().pending() + " orders are waiting for processing.",
                    "/orders",
                    "warning",
                    now
            ));
        }

        if (summary.orders().ready() > 0) {
            items.add(new AppNotificationResponse(
                    "orders-ready",
                    "Orders Ready",
                    summary.orders().ready() + " orders are ready for pickup or delivery.",
                    "/orders",
                    "success",
                    now
            ));
        }

        if (summary.machines().maintenance() > 0) {
            items.add(new AppNotificationResponse(
                    "machines-maintenance",
                    "Machines Under Maintenance",
                    summary.machines().maintenance() + " machine(s) currently marked for maintenance.",
                    "/machines",
                    "info",
                    now
            ));
        }

        int lowStockCount = inventoryService.lowStockAlerts(principal).size();
        if (lowStockCount > 0) {
            items.add(new AppNotificationResponse(
                    "inventory-low-stock",
                    "Low Stock Alert",
                    lowStockCount + " inventory item(s) reached low stock threshold.",
                    "/inventory",
                    "warning",
                    now
            ));
        }

        summary.recentOrders().stream()
                .limit(6)
                .map(this::toRecentOrderNotification)
                .forEach(items::add);

        return items.stream()
                .sorted(Comparator.comparing(AppNotificationResponse::createdAt).reversed())
                .toList();
    }

    private AppNotificationResponse toRecentOrderNotification(JobOrderResponse order) {
        LocalDateTime createdAt = order.updatedAt() != null ? order.updatedAt() : order.createdAt();
        return new AppNotificationResponse(
                "order-" + order.id(),
                "Order Update: " + order.trackingNumber(),
                order.customerName() + " is now in " + order.status().name() + ".",
                "/orders",
                "info",
                createdAt == null ? LocalDateTime.now() : createdAt
        );
    }
}
