package com.washalert.washalertbackend;

import com.washalert.washalertbackend.delivery.DeliveryOrder;
import com.washalert.washalertbackend.delivery.DeliveryOrderRepository;
import com.washalert.washalertbackend.delivery.DeliveryService;
import com.washalert.washalertbackend.delivery.DeliveryStatus;
import com.washalert.washalertbackend.delivery.dto.UpdateDeliveryStatusRequest;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderService;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.orders.dto.UpdateJobOrderRequest;
import com.washalert.washalertbackend.payment.PaymentMethod;
import com.washalert.washalertbackend.payment.PaymentRecord;
import com.washalert.washalertbackend.payment.PaymentRecordRepository;
import com.washalert.washalertbackend.payment.PaymentService;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.payment.PaymentWebhookService;
import com.washalert.washalertbackend.payment.dto.VerifyPaymentRequest;
import com.washalert.washalertbackend.payment.dto.PaymentWebhookRequest;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.support.ChatSupportService;
import com.washalert.washalertbackend.support.dto.ChatSupportRequest;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
class BusinessRulesHardeningTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JobOrderRepository jobOrderRepository;

    @Autowired
    private JobOrderService jobOrderService;

    @Autowired
    private DeliveryOrderRepository deliveryOrderRepository;

    @Autowired
    private DeliveryService deliveryService;

    @Autowired
    private PaymentRecordRepository paymentRecordRepository;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private ChatSupportService chatSupportService;

    @Autowired
    private PaymentWebhookService paymentWebhookService;

    @Test
    void invalidJobOrderTransitionShouldThrowIllegalState() {
        User staff = createUser("staff-transition@test.com", Role.STAFF, "Light");
        JobOrder order = createOrder("WA-50001", "Light", JobOrderStatus.PENDING, ServiceType.DROP_OFF);

        assertThrows(IllegalStateException.class, () ->
                jobOrderService.updateStatus(
                        order.getId(),
                        new UpdateJobOrderRequest(JobOrderStatus.DRYING),
                        new AuthUserDetails(staff)
                )
        );
    }

    @Test
    void invalidDeliveryTransitionShouldThrowIllegalState() {
        User staff = createUser("staff-delivery@test.com", Role.STAFF, "Light");
        JobOrder order = createOrder("WA-50002", "Light", JobOrderStatus.READY, ServiceType.PICKUP_DELIVERY);
        order.setDeliveryAddress("Light Residences, Mandaluyong");
        order = jobOrderRepository.save(order);

        DeliveryOrder delivery = DeliveryOrder.builder()
                .jobOrder(order)
                .driverName("Juan Driver")
                .driverPhone("09170000001")
                .status(DeliveryStatus.PENDING_PICKUP)
                .build();
        delivery = deliveryOrderRepository.save(delivery);

        DeliveryOrder finalDelivery = delivery;
        assertThrows(IllegalStateException.class, () ->
                deliveryService.updateStatus(
                        finalDelivery.getId(),
                        new UpdateDeliveryStatusRequest(DeliveryStatus.DELIVERED, null),
                        new AuthUserDetails(staff)
                )
        );
    }

    @Test
    void verifyNonPendingPaymentShouldThrowIllegalState() {
        User admin = createUser("admin-payment@test.com", Role.ADMIN, "Light");
        JobOrder order = createOrder("WA-50003", "Light", JobOrderStatus.READY, ServiceType.DROP_OFF);

        PaymentRecord payment = PaymentRecord.builder()
                .jobOrder(order)
                .method(PaymentMethod.GCASH)
                .amount(new BigDecimal("250.00"))
                .referenceNumber("REF-12345")
                .proofUrl("https://example.com/proof.png")
                .status(PaymentStatus.VERIFIED)
                .build();
        payment = paymentRecordRepository.save(payment);

        PaymentRecord finalPayment = payment;
        assertThrows(IllegalStateException.class, () ->
                paymentService.verify(
                        finalPayment.getId(),
                        new VerifyPaymentRequest(true, "re-verify"),
                        new AuthUserDetails(admin)
                )
        );
    }

    @Test
    void chatTrackingUnknownOrderShouldReturnFriendlyMessage() {
        var response = chatSupportService.reply(new ChatSupportRequest("track WA-999999", null));
        assertTrue(response.reply().toLowerCase().contains("could not find an order"));
    }

    @Test
    void invalidWebhookSignatureShouldThrowSecurityException() {
        PaymentWebhookRequest req = new PaymentWebhookRequest(
                "evt-" + UUID.randomUUID(),
                "GCASH",
                "WA-50003",
                "REF-INVALID",
                new BigDecimal("250.00"),
                "PAID"
        );

        assertThrows(SecurityException.class, () ->
                paymentWebhookService.receiveWebhook(req, "bad-signature")
        );
    }

    private User createUser(String email, Role role, String branch) {
        User user = User.builder()
                .email(email)
                .fullName("Test User")
                .passwordHash("hashed")
                .role(role)
                .enabled(true)
                .mustChangePassword(false)
                .verifiedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .branch(branch)
                .provider(AuthProvider.LOCAL)
                .build();
        return userRepository.save(user);
    }

    private JobOrder createOrder(String trackingNumber, String branch, JobOrderStatus status, ServiceType serviceType) {
        JobOrder order = JobOrder.builder()
                .trackingNumber(trackingNumber)
                .customerName("Customer Test")
                .branch(branch)
                .status(status)
                .serviceType(serviceType)
                .createdAt(LocalDateTime.now())
                .build();
        return jobOrderRepository.save(order);
    }
}
