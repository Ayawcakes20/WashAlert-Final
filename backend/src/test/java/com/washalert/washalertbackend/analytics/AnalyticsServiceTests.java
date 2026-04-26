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

