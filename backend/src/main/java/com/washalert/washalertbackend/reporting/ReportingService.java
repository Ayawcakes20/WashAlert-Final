package com.washalert.washalertbackend.reporting;

import com.washalert.washalertbackend.analytics.AnalyticsService;
import com.washalert.washalertbackend.analytics.dto.AnalyticsSummaryResponse;
import com.washalert.washalertbackend.delivery.DeliveryOrderRepository;
import com.washalert.washalertbackend.delivery.DeliveryStatus;
import com.washalert.washalertbackend.inventory.InventoryService;
import com.washalert.washalertbackend.inventory.dto.InventoryItemResponse;
import com.washalert.washalertbackend.reporting.dto.NlReportRequest;
import com.washalert.washalertbackend.reporting.dto.NlReportResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class ReportingService {

    private final AnalyticsService analyticsService;
    private final InventoryService inventoryService;
    private final DeliveryOrderRepository deliveryRepository;

    public ReportingService(
            AnalyticsService analyticsService,
            InventoryService inventoryService,
            DeliveryOrderRepository deliveryRepository
    ) {
        this.analyticsService = analyticsService;
        this.inventoryService = inventoryService;
        this.deliveryRepository = deliveryRepository;
    }

    public NlReportResponse runNaturalLanguageReport(NlReportRequest req, AuthUserDetails principal) {
        String query = req.query().trim().toLowerCase(Locale.ROOT);

        if (query.contains("revenue") || query.contains("sales") || query.contains("peak")) {
            AnalyticsSummaryResponse summary = analyticsService.summary(req.fromDate(), req.toDate(), req.branch(), principal);
            return new NlReportResponse(
                    "analytics_summary",
                    "Here is the analytics summary for the requested period.",
                    summary
            );
        }

        if (query.contains("stock") || query.contains("inventory") || query.contains("supply")) {
            List<InventoryItemResponse> alerts = inventoryService.lowStockAlerts(principal);
            return new NlReportResponse(
                    "inventory_alerts",
                    alerts.isEmpty()
                            ? "No low-stock items found right now."
                            : "These items are currently low on stock.",
                    alerts
            );
        }

        if (query.contains("delivery") || query.contains("transit") || query.contains("driver")) {
            String effectiveBranch = resolveBranch(req.branch(), principal);
            var deliveries = (effectiveBranch == null)
                    ? deliveryRepository.findAllByOrderByUpdatedAtDesc()
                    : deliveryRepository.findByJobOrder_BranchIgnoreCaseOrderByUpdatedAtDesc(effectiveBranch);

            Map<String, Long> counts = new LinkedHashMap<>();
            for (DeliveryStatus status : DeliveryStatus.values()) {
                long count = deliveries.stream().filter(d -> d.getStatus() == status).count();
                counts.put(status.name(), count);
            }

            return new NlReportResponse(
                    "delivery_status_overview",
                    "Here is the current delivery status overview.",
                    counts
            );
        }

        AnalyticsSummaryResponse fallback = analyticsService.summary(req.fromDate(), req.toDate(), req.branch(), principal);
        return new NlReportResponse(
                "default_summary",
                "I interpreted your request as an operations summary.",
                fallback
        );
    }

    private String resolveBranch(String requestedBranch, AuthUserDetails principal) {
        if (principal.getUser().getRole() == Role.STAFF) {
            return principal.getUser().getBranch();
        }
        if (requestedBranch == null || requestedBranch.isBlank() || requestedBranch.equalsIgnoreCase("All")) {
            return null;
        }
        return requestedBranch.trim();
    }
}
