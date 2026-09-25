package com.washalert.washalertbackend.analytics;

import com.washalert.washalertbackend.analytics.dto.AnalyticsSummaryResponse;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.payment.PaymentRecord;
import com.washalert.washalertbackend.payment.PaymentRecordRepository;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AnalyticsServiceTests {

    @Test
    void summaryReturnsSafeDefaultsWhenNoOrdersOrPaymentsForAllBranch() {
        JobOrderRepository orderRepository = mock(JobOrderRepository.class);
        PaymentRecordRepository paymentRepository = mock(PaymentRecordRepository.class);
        AnalyticsService service = new AnalyticsService(orderRepository, paymentRepository);

        LocalDate from = LocalDate.of(2026, 4, 18);
        LocalDate to = LocalDate.of(2026, 4, 25);

        when(orderRepository.findByCreatedAtBetween(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());
        when(paymentRepository.findBySubmittedAtBetween(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());

        AnalyticsSummaryResponse response = service.summary(from, to, "All", adminPrincipal());

        assertThat(response.totalOrders()).isZero();
        assertThat(response.pending()).isZero();
        assertThat(response.washing()).isZero();
        assertThat(response.drying()).isZero();
        assertThat(response.ready()).isZero();
        assertThat(response.totalRevenue()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(response.peakHour()).isNull();
        assertThat(response.branchBreakdown()).isEmpty();
        assertThat(response.hourlyBreakdown()).hasSize(24);
        assertThat(response.paymentMethodBreakdown().get("GCASH")).isZero();
        assertThat(response.paymentMethodBreakdown().get("MAYA")).isZero();
        assertThat(response.paymentMethodBreakdown().get("CASH")).isZero();
    }

    @Test
    void summaryIgnoresNullOrIncompleteRecordsInsteadOfThrowing() {
        JobOrderRepository orderRepository = mock(JobOrderRepository.class);
        PaymentRecordRepository paymentRepository = mock(PaymentRecordRepository.class);
        AnalyticsService service = new AnalyticsService(orderRepository, paymentRepository);

        JobOrder invalidOrder = JobOrder.builder()
                .status(null)
                .createdAt(null)
                .branch(null)
                .build();

        PaymentRecord incompletePayment = PaymentRecord.builder()
                .status(PaymentStatus.PAID)
                .amount(null)
                .jobOrder(null)
                .build();

        when(orderRepository.findByCreatedAtBetween(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(invalidOrder));
        when(paymentRepository.findBySubmittedAtBetween(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(incompletePayment));

        AnalyticsSummaryResponse response = service.summary(LocalDate.now().minusDays(1), LocalDate.now(), "All", adminPrincipal());

        assertThat(response.totalOrders()).isEqualTo(1);
        assertThat(response.totalRevenue()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(response.peakHour()).isNull();
        assertThat(response.branchBreakdown()).isNotNull();
    }

    @Test
    void summaryIncludesCodPaidOrdersInRevenueAndCashMethod() {
        JobOrderRepository orderRepository = mock(JobOrderRepository.class);
        PaymentRecordRepository paymentRepository = mock(PaymentRecordRepository.class);
        AnalyticsService service = new AnalyticsService(orderRepository, paymentRepository);

        JobOrder gcashOrder = JobOrder.builder()
                .id(101L)
                .branch("Makati Branch")
                .status(com.washalert.washalertbackend.orders.JobOrderStatus.DELIVERED)
                .createdAt(LocalDateTime.now())
                .isPaid(true)
                .paymentMethod("GCASH")
                .finalPrice(new BigDecimal("300.00"))
                .build();

        JobOrder codOrder = JobOrder.builder()
                .id(102L)
                .branch("Makati Branch")
                .status(com.washalert.washalertbackend.orders.JobOrderStatus.DELIVERED)
                .createdAt(LocalDateTime.now())
                .isPaid(true)
                .codCollected(true)
                .paymentMethod("COD")
                .finalPrice(new BigDecimal("250.00"))
                .build();

        PaymentRecord gcashPayment = PaymentRecord.builder()
                .id(1L)
                .jobOrder(gcashOrder)
                .method(com.washalert.washalertbackend.payment.PaymentMethod.GCASH)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("300.00"))
                .submittedAt(LocalDateTime.now())
                .build();

        when(orderRepository.findByCreatedAtBetween(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(gcashOrder, codOrder));
        // Only gcashPayment is in payment records table; codOrder has no payment record yet
        when(paymentRepository.findBySubmittedAtBetween(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(gcashPayment));

        AnalyticsSummaryResponse response = service.summary(LocalDate.now().minusDays(1), LocalDate.now(), "All", adminPrincipal());

        // Total orders should be 2
        assertThat(response.totalOrders()).isEqualTo(2);
        // Total revenue must combine GCash (300) + COD paid (250) = 550
        assertThat(response.totalRevenue()).isEqualByComparingTo(new BigDecimal("550.00"));
        // Payment methods: 1 GCash, 1 Cash
        assertThat(response.paymentMethodBreakdown().get("GCASH")).isEqualTo(1L);
        assertThat(response.paymentMethodBreakdown().get("CASH")).isEqualTo(1L);
        // Branch breakdown revenue should also reflect 550
        assertThat(response.branchBreakdown()).hasSize(1);
        assertThat(response.branchBreakdown().get(0).revenue()).isEqualByComparingTo(new BigDecimal("550.00"));
        assertThat(response.branchBreakdown().get(0).totalOrders()).isEqualTo(2L);
    }

    @Test
    void summaryExcludesCancelledOrdersFromTotalOrdersAndRevenue() {
        JobOrderRepository orderRepository = mock(JobOrderRepository.class);
        PaymentRecordRepository paymentRepository = mock(PaymentRecordRepository.class);
        AnalyticsService service = new AnalyticsService(orderRepository, paymentRepository);

        JobOrder deliveredOrder = JobOrder.builder()
                .id(201L)
                .branch("Holy Spirit Branch")
                .status(com.washalert.washalertbackend.orders.JobOrderStatus.DELIVERED)
                .createdAt(LocalDateTime.now())
                .isPaid(true)
                .paymentMethod("GCASH")
                .finalPrice(new BigDecimal("300.00"))
                .build();

        JobOrder cancelledOrder = JobOrder.builder()
                .id(202L)
                .branch("Holy Spirit Branch")
                .status(com.washalert.washalertbackend.orders.JobOrderStatus.CANCELLED)
                .createdAt(LocalDateTime.now())
                .isPaid(false)
                .paymentMethod("COD")
                .finalPrice(new BigDecimal("400.00"))
                .build();

        PaymentRecord deliveredPayment = PaymentRecord.builder()
                .id(11L)
                .jobOrder(deliveredOrder)
                .method(com.washalert.washalertbackend.payment.PaymentMethod.GCASH)
                .status(PaymentStatus.PAID)
                .amount(new BigDecimal("300.00"))
                .submittedAt(LocalDateTime.now())
                .build();

        PaymentRecord cancelledPayment = PaymentRecord.builder()
                .id(12L)
                .jobOrder(cancelledOrder)
                .method(com.washalert.washalertbackend.payment.PaymentMethod.CASH)
                .status(PaymentStatus.REJECTED)
                .amount(new BigDecimal("400.00"))
                .submittedAt(LocalDateTime.now())
                .build();

        when(orderRepository.findByCreatedAtBetween(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(deliveredOrder, cancelledOrder));
        when(paymentRepository.findBySubmittedAtBetween(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(deliveredPayment, cancelledPayment));

        AnalyticsSummaryResponse response = service.summary(LocalDate.now().minusDays(1), LocalDate.now(), "All", adminPrincipal());

        // Cancelled order must NOT be counted in total orders: totalOrders = 1 (only deliveredOrder)
        assertThat(response.totalOrders()).isEqualTo(1);
        // Cancelled order must NOT be included in revenue: totalRevenue = 300.00
        assertThat(response.totalRevenue()).isEqualByComparingTo(new BigDecimal("300.00"));
        // Branch breakdown should only count 1 active order and 300 revenue
        assertThat(response.branchBreakdown()).hasSize(1);
        assertThat(response.branchBreakdown().get(0).totalOrders()).isEqualTo(1L);
        assertThat(response.branchBreakdown().get(0).revenue()).isEqualByComparingTo(new BigDecimal("300.00"));
    }

    private AuthUserDetails adminPrincipal() {
        User admin = User.builder()
                .id(1L)
                .email("admin@washalert.ph")
                .fullName("Admin")
                .role(Role.ADMIN)
                .status(UserStatus.ACTIVE)
                .enabled(true)
                .build();
        return new AuthUserDetails(admin);
    }
}

