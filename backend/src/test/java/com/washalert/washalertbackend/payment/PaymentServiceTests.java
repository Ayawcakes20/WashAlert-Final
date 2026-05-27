package com.washalert.washalertbackend.payment;

import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderTimelineService;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.payment.dto.SubmitPaymentProofRequest;
import com.washalert.washalertbackend.payment.dto.PaymentResponse;
import com.washalert.washalertbackend.support.GeminiChatClient;
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
    private GeminiChatClient geminiChatClient;
    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        paymentRepository = mock(PaymentRecordRepository.class);
        orderRepository = mock(JobOrderRepository.class);
        notificationService = mock(NotificationService.class);
        paymongoService = mock(PaymongoService.class);
        timelineService = mock(JobOrderTimelineService.class);
        firestoreSyncService = mock(FirestoreSyncService.class);
        geminiChatClient = mock(GeminiChatClient.class);

        paymentService = new PaymentService(
                paymentRepository,
                orderRepository,
                notificationService,
                paymongoService,
                timelineService,
                firestoreSyncService,
                geminiChatClient
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
        when(paymongoService.createCheckoutSession(order)).thenReturn(new CheckoutSessionResult("https://checkout.paymongo.com/session/abc123", "cs_123"));

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

    @Test
    void submitProofWithValidGcashReceiptSucceeds() {
        JobOrder order = JobOrder.builder()
                .id(17L)
                .trackingNumber("WA-10017")
                .customerEmail("customer@test.com")
                .status(JobOrderStatus.PRICE_CONFIRMED)
                .build();

        SubmitPaymentProofRequest req = new SubmitPaymentProofRequest(
                "WA-10017",
                PaymentMethod.GCASH,
                new BigDecimal("450.00"),
                "5013749285918",
                "https://firebase/storage/proof.jpg"
        );

        when(orderRepository.findByTrackingNumber("WA-10017")).thenReturn(Optional.of(order));
        when(paymentRepository.findByJobOrder_TrackingNumber("WA-10017")).thenReturn(Optional.empty());
        when(geminiChatClient.validateGcashReceipt("https://firebase/storage/proof.jpg")).thenReturn(true);
        when(paymentRepository.save(any(PaymentRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PaymentResponse res = paymentService.submitProof(req);

        assertThat(res.status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(res.referenceNumber()).isEqualTo("5013749285918");
        verify(geminiChatClient).validateGcashReceipt("https://firebase/storage/proof.jpg");
    }

    @Test
    void submitProofWithInvalidGcashReceiptThrowsIllegalArgumentException() {
        JobOrder order = JobOrder.builder()
                .id(17L)
                .trackingNumber("WA-10017")
                .status(JobOrderStatus.PRICE_CONFIRMED)
                .build();

        SubmitPaymentProofRequest req = new SubmitPaymentProofRequest(
                "WA-10017",
                PaymentMethod.GCASH,
                new BigDecimal("450.00"),
                "5013749285918",
                "https://firebase/storage/proof.jpg"
        );

        when(orderRepository.findByTrackingNumber("WA-10017")).thenReturn(Optional.of(order));
        when(paymentRepository.findByJobOrder_TrackingNumber("WA-10017")).thenReturn(Optional.empty());
        when(geminiChatClient.validateGcashReceipt("https://firebase/storage/proof.jpg")).thenReturn(false);

        assertThatThrownBy(() -> paymentService.submitProof(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("The uploaded photo does not appear to be a valid GCash receipt. Please upload a screenshot of your successful GCash transaction.");
    }
}
