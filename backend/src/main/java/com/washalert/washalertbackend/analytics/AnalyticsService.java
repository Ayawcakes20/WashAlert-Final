package com.washalert.washalertbackend.analytics;

import com.washalert.washalertbackend.analytics.dto.AnalyticsSummaryResponse;
import com.washalert.washalertbackend.analytics.dto.BranchAnalyticsResponse;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.payment.PaymentRecord;
import com.washalert.washalertbackend.payment.PaymentRecordRepository;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {
    private static final Logger log = LoggerFactory.getLogger(AnalyticsService.class);
    private static final String UNKNOWN_BRANCH = "Unknown";

    private final JobOrderRepository orderRepository;
    private final PaymentRecordRepository paymentRepository;

    public AnalyticsService(JobOrderRepository orderRepository, PaymentRecordRepository paymentRepository) {
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
    }

    // Removed @Cacheable so analytics reflect live orders and payments in real-time
    @Transactional(readOnly = true)
    public AnalyticsSummaryResponse summary(LocalDate fromDate, LocalDate toDate, String branch, AuthUserDetails principal) {
        LocalDate from = (fromDate == null) ? LocalDate.now().minusDays(6) : fromDate;
        LocalDate to = (toDate == null) ? LocalDate.now() : toDate;
        if (to.isBefore(from)) {
            to = from;
        }

        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.atTime(LocalTime.MAX);

        User actor = principal.getUser();
        String effectiveBranch = resolveBranch(branch, actor);

        List<JobOrder> queriedOrders = (effectiveBranch == null)
                ? orderRepository.findByCreatedAtBetween(start, end)
                : orderRepository.findByNormalizedBranchAndCreatedAtBetween(effectiveBranch, start, end);

        List<PaymentRecord> queriedPayments = (effectiveBranch == null)
                ? paymentRepository.findBySubmittedAtBetween(start, end)
                : paymentRepository.findByJobOrderNormalizedBranchAndSubmittedAtBetween(effectiveBranch, start, end);

        List<JobOrder> orders = safeOrders(queriedOrders);
        List<PaymentRecord> payments = safePayments(queriedPayments);

        long pending = orders.stream().filter(o -> o.getStatus() == JobOrderStatus.PENDING).count();
        long washing = orders.stream().filter(o -> o.getStatus() == JobOrderStatus.WASHING).count();
        long drying = orders.stream().filter(o -> o.getStatus() == JobOrderStatus.DRYING).count();
        long ready = orders.stream().filter(o -> o.getStatus() == JobOrderStatus.READY).count();

        // Order IDs that already have a completed PaymentRecord in queriedPayments
        Set<Long> paidViaPaymentRecord = payments.stream()
                .filter(this::isCompletedPayment)
                .filter(p -> p.getJobOrder() != null && p.getJobOrder().getId() != null)
                .map(p -> p.getJobOrder().getId())
                .collect(Collectors.toSet());

        // Revenue from verified PaymentRecords (GCash, Maya, and staff/driver-created cash records)
        BigDecimal revenueFromRecords = payments.stream()
                .filter(this::isCompletedPayment)
                .map(this::amountOrZero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Revenue from COD / Cash orders that are marked isPaid or codCollected but do not
        // have a completed PaymentRecord in queriedPayments (covers historical COD collections)
        BigDecimal revenueFromCodPaid = orders.stream()
                .filter(o -> o != null && (o.isPaid() || o.isCodCollected()) && !paidViaPaymentRecord.contains(o.getId()))
                .filter(o -> o.getStatus() != JobOrderStatus.CANCELLED && o.getStatus() != JobOrderStatus.FAILED)
                .map(this::orderAmountOrZero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRevenue = revenueFromRecords.add(revenueFromCodPaid);

        Integer peakHour = findPeakHour(orders);

        List<BranchAnalyticsResponse> branchBreakdown = computeBranchBreakdown(orders, payments, effectiveBranch, paidViaPaymentRecord);
        Map<String, Long> hourlyBreakdown = computeHourlyBreakdown(orders);
        Map<String, Long> paymentMethodBreakdown = computePaymentMethodBreakdown(payments, orders, paidViaPaymentRecord);

        return new AnalyticsSummaryResponse(
                from,
                to,
                orders.size(),
                pending,
                washing,
                drying,
                ready,
                totalRevenue,
                peakHour,
                branchBreakdown,
                hourlyBreakdown,
                paymentMethodBreakdown
        );
    }

    private String resolveBranch(String branch, User actor) {
        if (actor.getRole() == Role.STAFF) {
            return actor.getBranch();
        }

        String normalizedBranch = branch == null ? "" : branch.trim();
        if (normalizedBranch.isBlank() || normalizedBranch.equalsIgnoreCase("All")) {
            return null;
        }

        return normalizedBranch;
    }

    private Integer findPeakHour(List<JobOrder> orders) {
        Map<Integer, Long> byHour = new HashMap<>();
        for (JobOrder order : orders) {
            if (order.getCreatedAt() == null) {
                continue;
            }
            int hour = order.getCreatedAt().getHour();
            byHour.put(hour, byHour.getOrDefault(hour, 0L) + 1);
        }

        return byHour.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    private Map<String, Long> computeHourlyBreakdown(List<JobOrder> orders) {
        Map<String, Long> result = new LinkedHashMap<>();
        for (int h = 0; h < 24; h++) {
            result.put(String.format("%02d:00", h), 0L);
        }
        for (JobOrder order : orders) {
            if (order.getCreatedAt() == null) {
                continue;
            }
            String key = String.format("%02d:00", order.getCreatedAt().getHour());
            result.put(key, result.getOrDefault(key, 0L) + 1);
        }
        return result;
    }

    private Map<String, Long> computePaymentMethodBreakdown(
            List<PaymentRecord> payments,
            List<JobOrder> orders,
            Set<Long> paidViaPaymentRecord
    ) {
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("GCASH", 0L);
        result.put("MAYA", 0L);
        result.put("CASH", 0L);

        for (PaymentRecord p : payments) {
            if (!isCompletedPayment(p)) continue;
            String key = p.getMethod() == null ? "CASH" : p.getMethod().name();
            result.put(key, result.getOrDefault(key, 0L) + 1);
        }

        for (JobOrder o : orders) {
            if (o != null && (o.isPaid() || o.isCodCollected()) && !paidViaPaymentRecord.contains(o.getId())) {
                if (o.getStatus() == JobOrderStatus.CANCELLED || o.getStatus() == JobOrderStatus.FAILED) continue;
                String pm = o.getPaymentMethod();
                String key = "CASH";
                if (pm != null) {
                    String upper = pm.toUpperCase();
                    if (upper.contains("GCASH")) {
                        key = "GCASH";
                    } else if (upper.contains("MAYA")) {
                        key = "MAYA";
                    }
                }
                result.put(key, result.getOrDefault(key, 0L) + 1);
            }
        }

        return result;
    }

    private List<BranchAnalyticsResponse> computeBranchBreakdown(
            List<JobOrder> orders,
            List<PaymentRecord> payments,
            String effectiveBranch,
            Set<Long> paidViaPaymentRecord
    ) {
        Map<String, Long> orderCountByBranch = new HashMap<>();
        for (JobOrder o : orders) {
            String key = normalizeBranchName(o.getBranch());
            orderCountByBranch.put(key, orderCountByBranch.getOrDefault(key, 0L) + 1);
        }

        Map<String, BigDecimal> revenueByBranch = new HashMap<>();
        for (PaymentRecord p : payments) {
            if (!isCompletedPayment(p)) continue;
            String key = normalizeBranchName(resolvePaymentBranch(p));
            revenueByBranch.put(key, revenueByBranch.getOrDefault(key, BigDecimal.ZERO).add(amountOrZero(p)));
        }

        for (JobOrder o : orders) {
            if (o != null && (o.isPaid() || o.isCodCollected()) && !paidViaPaymentRecord.contains(o.getId())) {
                if (o.getStatus() == JobOrderStatus.CANCELLED || o.getStatus() == JobOrderStatus.FAILED) continue;
                String key = normalizeBranchName(o.getBranch());
                revenueByBranch.put(key, revenueByBranch.getOrDefault(key, BigDecimal.ZERO).add(orderAmountOrZero(o)));
            }
        }

        if (effectiveBranch != null) {
            String normalizedBranch = normalizeBranchName(effectiveBranch);
            return List.of(new BranchAnalyticsResponse(
                    normalizedBranch,
                    orderCountByBranch.getOrDefault(normalizedBranch, 0L),
                    revenueByBranch.getOrDefault(normalizedBranch, BigDecimal.ZERO)
            ));
        }

        Set<String> allBranches = new HashSet<>(orderCountByBranch.keySet());
        allBranches.addAll(revenueByBranch.keySet());

        return allBranches.stream()
                .sorted(String::compareToIgnoreCase)
                .map(branch -> new BranchAnalyticsResponse(
                        branch,
                        orderCountByBranch.getOrDefault(branch, 0L),
                        revenueByBranch.getOrDefault(branch, BigDecimal.ZERO)
                ))
                .toList();
    }

    private List<JobOrder> safeOrders(List<JobOrder> orders) {
        if (orders == null || orders.isEmpty()) {
            return List.of();
        }
        return orders.stream().filter(Objects::nonNull).toList();
    }

    private List<PaymentRecord> safePayments(List<PaymentRecord> payments) {
        if (payments == null || payments.isEmpty()) {
            return List.of();
        }
        return payments.stream().filter(Objects::nonNull).toList();
    }

    private boolean isCompletedPayment(PaymentRecord payment) {
        if (payment == null) {
            return false;
        }
        if (payment.getJobOrder() != null &&
                (payment.getJobOrder().getStatus() == JobOrderStatus.CANCELLED ||
                 payment.getJobOrder().getStatus() == JobOrderStatus.FAILED)) {
            return false;
        }
        return payment.getStatus() == PaymentStatus.VERIFIED || payment.getStatus() == PaymentStatus.PAID;
    }

    private BigDecimal amountOrZero(PaymentRecord payment) {
        if (payment == null || payment.getAmount() == null) {
            return BigDecimal.ZERO;
        }
        return payment.getAmount();
    }

    private BigDecimal orderAmountOrZero(JobOrder order) {
        if (order == null) return BigDecimal.ZERO;
        if (order.getFinalPrice() != null && order.getFinalPrice().compareTo(BigDecimal.ZERO) > 0) {
            return order.getFinalPrice();
        }
        if (order.getTotalPrice() != null && order.getTotalPrice().compareTo(BigDecimal.ZERO) > 0) {
            return order.getTotalPrice();
        }
        return BigDecimal.ZERO;
    }

    private String resolvePaymentBranch(PaymentRecord payment) {
        try {
            if (payment != null && payment.getJobOrder() != null) {
                return payment.getJobOrder().getBranch();
            }
        } catch (Exception ex) {
            log.warn("[ANALYTICS] Unable to resolve payment branch for paymentId={}", payment == null ? null : payment.getId(), ex);
        }
        return UNKNOWN_BRANCH;
    }

    private String normalizeBranchName(String branch) {
        if (branch == null || branch.isBlank()) {
            return UNKNOWN_BRANCH;
        }
        return branch.trim();
    }
}
