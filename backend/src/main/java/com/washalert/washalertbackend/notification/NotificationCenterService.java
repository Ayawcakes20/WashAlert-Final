package com.washalert.washalertbackend.notification;

import com.washalert.washalertbackend.announcement.Announcement;
import com.washalert.washalertbackend.announcement.AnnouncementService;
import com.washalert.washalertbackend.announcement.AnnouncementType;
import com.washalert.washalertbackend.common.dto.PagedResponse;
import com.washalert.washalertbackend.dashboard.DashboardService;
import com.washalert.washalertbackend.inventory.InventoryService;
import com.washalert.washalertbackend.notification.dto.AppNotificationResponse;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class NotificationCenterService {

    private final DashboardService dashboardService;
    private final InventoryService inventoryService;
    private final AnnouncementService announcementService;

    public NotificationCenterService(
            DashboardService dashboardService,
            InventoryService inventoryService,
            AnnouncementService announcementService
    ) {
        this.dashboardService = dashboardService;
        this.inventoryService = inventoryService;
        this.announcementService = announcementService;
    }

    public List<AppNotificationResponse> list(AuthUserDetails principal) {
        List<AppNotificationResponse> items = new ArrayList<>();
        Role role = principal.getUser().getRole();

        if (role == Role.ADMIN || role == Role.STAFF) {
            var summary = dashboardService.summary(principal);
            LocalDateTime now = LocalDateTime.now();

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
        }

        announcementService.listForUser(principal.getUser()).stream()
                .limit(12)
                .map(this::toAnnouncementNotification)
                .forEach(items::add);

        return items.stream()
                .sorted(Comparator.comparing(AppNotificationResponse::createdAt).reversed())
                .toList();
    }

    public PagedResponse<AppNotificationResponse> listPaged(AuthUserDetails principal, int page, int size) {
        List<AppNotificationResponse> all = list(principal);
        int safeSize = Math.max(1, size);
        int safePage = Math.max(0, page);
        int fromIndex = safePage * safeSize;
        int total = all.size();
        if (fromIndex >= total) {
            return new PagedResponse<>(
                    List.of(),
                    safePage,
                    safeSize,
                    total,
                    total == 0 ? 0 : (int) Math.ceil((double) total / safeSize),
                    false,
                    safePage > 0
            );
        }
        int toIndex = Math.min(fromIndex + safeSize, total);
        int totalPages = (int) Math.ceil((double) total / safeSize);
        return new PagedResponse<>(
                all.subList(fromIndex, toIndex),
                safePage,
                safeSize,
                total,
                totalPages,
                safePage + 1 < totalPages,
                safePage > 0
        );
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

    private AppNotificationResponse toAnnouncementNotification(Announcement announcement) {
        String scope = announcement.isTargetAllBranches()
                ? "All branches"
                : (announcement.getBranch() == null ? "Assigned branch" : announcement.getBranch());
        String title = switch (announcement.getType()) {
            case CLOSURE -> "Branch Closure Notice";
            case HOLIDAY -> "Holiday Advisory";
            case GENERAL -> "Branch Announcement";
        };

        return new AppNotificationResponse(
                "announcement-" + announcement.getId(),
                title + " (" + scope + ")",
                announcement.getMessage(),
                "/announcements",
                announcement.getType() == AnnouncementType.CLOSURE ? "warning" : "info",
                announcement.getCreatedAt() == null ? LocalDateTime.now() : announcement.getCreatedAt()
        );
    }
}
