package com.washalert.washalertbackend.analytics;

import com.washalert.washalertbackend.analytics.dto.AnalyticsSummaryResponse;
import com.washalert.washalertbackend.analytics.dto.BranchAnalyticsResponse;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.payment.PaymentMethod;
import com.washalert.washalertbackend.payment.PaymentRecord;
import com.washalert.washalertbackend.payment.PaymentRecordRepository;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class AnalyticsService {

    private final JobOrderRepository orderRepository;
    private final PaymentRecordRepository paymentRepository;

    public AnalyticsService(JobOrderRepository orderRepository, PaymentRecordRepository paymentRepository) {
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
    }

    public AnalyticsSummaryResponse summary(LocalDate fromDate, LocalDate toDate, String branch, AuthUserDetails principal) {
        LocalDate from = (fromDate == null) ? LocalDate.now().minusDays(6) : fromDate;
        LocalDate to = (toDate == null) ? LocalDate.now() : toDate;
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("toDate cannot be earlier than fromDate.");
        }

        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.atTime(LocalTime.MAX);

        User actor = principal.getUser();
        String effectiveBranch = resolveBranch(branch, actor);

        List<JobOrder> orders = (effectiveBranch == null)
                ? orderRepository.findByCreatedAtBetween(start, end)
                : orderRepository.findByBranchIgnoreCaseAndCreatedAtBetween(effectiveBranch, start, end);

        List<PaymentRecord> payments = (effectiveBranch == null)
                ? paymentRepository.findBySubmittedAtBetween(start, end)
                : paymentRepository.findByJobOrder_BranchIgnoreCaseAndSubmittedAtBetween(effectiveBranch, start, end);

        long pending = orders.stream().filter(o -> o.getStatus() == JobOrderStatus.PENDING).count();
        long washing = orders.stream().filter(o -> o.getStatus() == JobOrderStatus.WASHING).count();
        long drying = orders.stream().filter(o -> o.getStatus() == JobOrderStatus.DRYING).count();
        long ready = orders.stream().filter(o -> o.getStatus() == JobOrderStatus.READY).count();

        BigDecimal totalRevenue = payments.stream()
                .filter(p -> p.getStatus() == PaymentStatus.VERIFIED || p.getStatus() == PaymentStatus.PAID)
                .map(PaymentRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Integer peakHour = findPeakHour(orders);

        List<BranchAnalyticsResponse> branchBreakdown = computeBranchBreakdown(orders, payments, effectiveBranch);
        Map<String, Long> hourlyBreakdown = computeHourlyBreakdown(orders);
        Map<String, Long> paymentMethodBreakdown = computePaymentMethodBreakdown(payments);

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

        if (branch == null || branch.isBlank() || branch.equalsIgnoreCase("All")) {
            return null;
        }

        return branch.trim();
    }

    private Integer findPeakHour(List<JobOrder> orders) {
        Map<Integer, Long> byHour = new HashMap<>();
        for (JobOrder order : orders) {
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
        // Initialize all 24 hours to 0
        for (int h = 0; h < 24; h++) {
            result.put(String.format("%02d:00", h), 0L);
        }
        for (JobOrder order : orders) {
            String key = String.format("%02d:00", order.getCreatedAt().getHour());
            result.put(key, result.getOrDefault(key, 0L) + 1);
        }
        return result;
    }

    private Map<String, Long> computePaymentMethodBreakdown(List<PaymentRecord> payments) {
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("GCASH", 0L);
        result.put("MAYA", 0L);
        result.put("CASH", 0L);
        for (PaymentRecord p : payments) {
            if (p.getStatus() != PaymentStatus.VERIFIED && p.getStatus() != PaymentStatus.PAID) continue;
            String key = p.getMethod() == null ? "CASH" : p.getMethod().name();
            result.put(key, result.getOrDefault(key, 0L) + 1);
        }
        return result;
    }

    private List<BranchAnalyticsResponse> computeBranchBreakdown(
            List<JobOrder> orders,
            List<PaymentRecord> payments,
            String effectiveBranch
    ) {
        Map<String, Long> orderCountByBranch = new HashMap<>();
        for (JobOrder o : orders) {
            String key = (o.getBranch() == null) ? "Unknown" : o.getBranch();
            orderCountByBranch.put(key, orderCountByBranch.getOrDefault(key, 0L) + 1);
        }

        Map<String, BigDecimal> revenueByBranch = new HashMap<>();
        for (PaymentRecord p : payments) {
            if (p.getStatus() != PaymentStatus.VERIFIED && p.getStatus() != PaymentStatus.PAID) continue;

            String key = (p.getJobOrder().getBranch() == null) ? "Unknown" : p.getJobOrder().getBranch();
            revenueByBranch.put(key, revenueByBranch.getOrDefault(key, BigDecimal.ZERO).add(p.getAmount()));
        }

        if (effectiveBranch != null) {
            return List.of(new BranchAnalyticsResponse(
                    effectiveBranch,
                    orderCountByBranch.getOrDefault(effectiveBranch, 0L),
                    revenueByBranch.getOrDefault(effectiveBranch, BigDecimal.ZERO)
            ));
        }

        return orderCountByBranch.keySet().stream()
                .sorted(String::compareToIgnoreCase)
                .map(branch -> new BranchAnalyticsResponse(
                        branch,
                        orderCountByBranch.getOrDefault(branch, 0L),
                        revenueByBranch.getOrDefault(branch, BigDecimal.ZERO)
                ))
                .toList();
    }
}
