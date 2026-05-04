package com.washalert.washalertbackend.payment;

import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderTimelineService;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentServiceTests {

    private PaymentRecordRepository paymentRepository;
    private JobOrderRepository orderRepository;
    private NotificationService notificationService;
    private PaymongoService paymongoService;
    private JobOrderTimelineService timelineService;
    private FirestoreSyncService firestoreSyncService;
    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        paymentRepository = mock(PaymentRecordRepository.class);
        orderRepository = mock(JobOrderRepository.class);
        notificationService = mock(NotificationService.class);
        paymongoService = mock(PaymongoService.class);
        timelineService = mock(JobOrderTimelineService.class);
        firestoreSyncService = mock(FirestoreSyncService.class);

        paymentService = new PaymentService(
                paymentRepository,
                orderRepository,
                notificationService,
                paymongoService,
                timelineService,
                firestoreSyncService
        );
    }

    @Test
    void initiateGcashCheckoutCreatesPendingPaymentAndReturnsUrl() {
        JobOrder order = JobOrder.builder()
                .id(17L)
                .trackingNumber("WA-10017")
                .status(JobOrderStatus.PRICE_CONFIRMED)
                .totalPrice(new BigDecimal("450.00"))
                .build();

        when(orderRepository.findByTrackingNumber("WA-10017")).thenReturn(Optional.of(order));
        when(paymentRepository.findByJobOrder_TrackingNumber("WA-10017")).thenReturn(Optional.empty());
        when(paymentRepository.save(any(PaymentRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymongoService.createCheckoutSession(order)).thenReturn("https://checkout.paymongo.com/session/abc123");

        String checkoutUrl = paymentService.initiateGcashCheckout("wa-10017");

        assertThat(checkoutUrl).isEqualTo("https://checkout.paymongo.com/session/abc123");
        verify(paymentRepository).save(any(PaymentRecord.class));
        verify(paymongoService).createCheckoutSession(order);
    }

    @Test
    void initiateGcashCheckoutRejectsUnknownTrackingAsNotFound() {
        when(orderRepository.findByTrackingNumber("WA-99999")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> paymentService.initiateGcashCheckout("WA-99999"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void initiateGcashCheckoutRejectsBlankTrackingAsBadRequest() {
        assertThatThrownBy(() -> paymentService.initiateGcashCheckout("   "))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
