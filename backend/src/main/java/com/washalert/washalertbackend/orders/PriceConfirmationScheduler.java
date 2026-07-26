package com.washalert.washalertbackend.orders;

import com.washalert.washalertbackend.booking.PricingService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.inventory.InventoryService;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.payment.PaymentRecord;
import com.washalert.washalertbackend.payment.PaymentRecordRepository;
import com.washalert.washalertbackend.payment.PaymentStatus;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Handles the tiered auto-proceed logic for unresponsive customers:
 *
 * • At T+30 min: send a warning push ("We'll begin washing in 30 minutes if unconfirmed")
 * • At T+1 hour: auto-confirm the order → status advances to WASHING
 *
 * This scheduler runs every 5 minutes to catch orders promptly.
 */
@Component
public class PriceConfirmationScheduler {

    private static final Logger log = LoggerFactory.getLogger(PriceConfirmationScheduler.class);

    private final JobOrderRepository repo;
    private final JobOrderTimelineService timelineService;
    private final NotificationService notificationService;
    private final FirestoreSyncService firestoreSyncService;
    private final PaymentRecordRepository paymentRepository;
    private final InventoryService inventoryService;
    private final PricingService pricingService;

    public PriceConfirmationScheduler(
            JobOrderRepository repo,
            JobOrderTimelineService timelineService,
            NotificationService notificationService,
            FirestoreSyncService firestoreSyncService,
            PaymentRecordRepository paymentRepository,
            InventoryService inventoryService,
            PricingService pricingService
    ) {
        this.repo = repo;
        this.timelineService = timelineService;
        this.notificationService = notificationService;
        this.firestoreSyncService = firestoreSyncService;
        this.paymentRepository = paymentRepository;
        this.inventoryService = inventoryService;
        this.pricingService = pricingService;
    }

    @Scheduled(fixedDelay = 300_000) // every 5 minutes
    @Transactional
    public void processPendingConfirmations() {
        LocalDateTime now = LocalDateTime.now();

        List<JobOrder> awaitingOrders = repo.findByStatus(JobOrderStatus.PRICE_CONFIRMED);
        if (awaitingOrders.isEmpty()) return;

        for (JobOrder order : awaitingOrders) {
            if (order.getPriceConfirmationDeadline() == null) continue;

            LocalDateTime deadline      = order.getPriceConfirmationDeadline();
            LocalDateTime warningTime   = deadline.minusMinutes(30); // warn at T+30min

            try {
                if (now.isAfter(deadline)) {
                    // ── AUTO-CONFIRM ─────────────────────────────────────────
                    // Mirror the same guards JobOrderService.updateStatus() applies for a
                    // staff-driven PRICE_CONFIRMED → WASHING transition. Without these, an
                    // unpaid GCash order would get washed for free after the deadline, and
                    // inventory would never be deducted for it.
                    String pm = order.getPaymentMethod();
                    boolean isOnlinePayment = pm != null && pm.toUpperCase().contains("GCASH");
                    if (isOnlinePayment && !order.isPaid()) {
                        log.info("[PriceConfirm] Holding order #{} at PRICE_CONFIRMED — GCash payment not yet verified.",
                                order.getTrackingNumber());
                        continue;
                    }

                    log.info("[PriceConfirm] Auto-confirming order #{} (deadline passed)", order.getTrackingNumber());

                    int detQty = (order.getDetergentQuantity() != null && order.getDetergentQuantity() > 0)
                            ? order.getDetergentQuantity() : 1;
                    int conQty = (order.getConditionerQuantity() != null && order.getConditionerQuantity() > 0)
                            ? order.getConditionerQuantity() : 1;
                    pricingService.validateAddonQuantities(
                            order.getServiceName(),
                            order.getEstimatedWeightKg(),
                            order.getDetergentPreference(),
                            detQty,
                            order.getFabricConditionerPreference(),
                            conQty
                    );
                    inventoryService.validateSuppliesForBooking(
                            order.getBranch(),
                            order.getDetergentPreference(),
                            order.getFabricConditionerPreference(),
                            detQty,
                            conQty
                    );

                    order.setStatus(JobOrderStatus.WASHING);
                    order.setPriceConfirmedAt(now);
                    inventoryService.deductForOrder(order);
                    timelineService.log(order, JobOrderStatus.WASHING, "system",
                            "Auto-confirmed after 1 hour of no customer response. Washing started.");

                    String formattedTotal = order.getTotalPrice() != null
                            ? order.getTotalPrice().stripTrailingZeros().toPlainString()
                            : "N/A";

                    notificationService.enqueuePushToUserEmail(
                            order.getCustomerEmail(),
                            "Washing Started",
                            "Your order " + order.getTrackingNumber()
                                    + " has been auto-confirmed (₱" + formattedTotal
                                    + "). Washing has begun. Contact the branch for questions.",
                            "ORDER_STATUS",
                            order.getTrackingNumber() + ":WASHING_AUTO"
                    );

                    JobOrder saved = repo.save(order);
                    firestoreSyncService.upsert("orders", saved.getTrackingNumber(), JobOrderResponse.from(saved, saved.isPaid() ? PaymentStatus.PAID : null));

                } else if (now.isAfter(warningTime) && !hasWarningSent(order)) {
                    // ── 30-MINUTE WARNING ─────────────────────────────────────
                    log.info("[PriceConfirm] Sending 30-min warning for order #{}", order.getTrackingNumber());

                    String formattedTotal = order.getTotalPrice() != null
                            ? order.getTotalPrice().stripTrailingZeros().toPlainString()
                            : "N/A";

                    notificationService.enqueuePushToUserEmail(
                            order.getCustomerEmail(),
                            "Action Required: Confirm Your Laundry Price",
                            "Price confirmed at ₱" + formattedTotal + ". We will begin washing in 30 minutes "
                                    + "unless you confirm or contact the branch.",
                            "PRICE_CONFIRMATION_REMINDER",
                            order.getId() + ":" + order.getTrackingNumber()
                    );
                }
            } catch (Exception ex) {
                log.error("[PriceConfirm] Error processing order #{}: {}", order.getTrackingNumber(), ex.getMessage());
            }
        }
    }

    /**
     * Simple check: if the warning time has passed AND we haven't yet auto-confirmed,
     * we consider the warning "not yet sent" until we can't determine otherwise.
     * A more robust approach would store a `warningSentAt` field but this is sufficient
     * for the scheduler running every 5 minutes (warning fires once in a 5-min window).
     */
    private boolean hasWarningSent(JobOrder order) {
        if (order.getPriceConfirmationDeadline() == null) return false;
        // We approximate: if priceConfirmationDeadline is > 35 min away, warning hasn't been needed yet
        return LocalDateTime.now().isAfter(
                order.getPriceConfirmationDeadline().minusMinutes(25)
        );
    }
}
