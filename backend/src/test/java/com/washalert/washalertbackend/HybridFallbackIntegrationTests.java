package com.washalert.washalertbackend;

import com.washalert.washalertbackend.auth.AuthService;
import com.washalert.washalertbackend.auth.dto.MeResponse;
import com.washalert.washalertbackend.delivery.DeliveryOrder;
import com.washalert.washalertbackend.delivery.DeliveryOrderRepository;
import com.washalert.washalertbackend.delivery.DeliveryLeg;
import com.washalert.washalertbackend.delivery.DeliveryService;
import com.washalert.washalertbackend.delivery.DeliveryStatus;
import com.washalert.washalertbackend.delivery.dto.DeliveryResponse;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderService;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.orders.dto.OrderTrackingResponse;
import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "washalert.data.read-mode=HYBRID",
        "washalert.firebase.enabled=false"
})
@ActiveProfiles("test")
class HybridFallbackIntegrationTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JobOrderRepository jobOrderRepository;

    @Autowired
    private DeliveryOrderRepository deliveryOrderRepository;

    @Autowired
    private JobOrderService jobOrderService;

    @Autowired
    private DeliveryService deliveryService;

    @Autowired
    private AuthService authService;

    @Test
    void jobOrderReadFallsBackToMysqlInHybridMode() {
        User staff = createUser("staff-hybrid-" + UUID.randomUUID() + "@test.com", Role.STAFF, "Light");
        String tracking = "WA-HY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        createOrder(tracking, "Light", JobOrderStatus.PENDING, ServiceType.DROP_OFF);

        JobOrderResponse fromList = jobOrderService.listAll(new AuthUserDetails(staff)).stream()
                .filter(o -> tracking.equals(o.trackingNumber()))
                .findFirst()
                .orElse(null);

        OrderTrackingResponse tracked = jobOrderService.trackByTrackingNumber(tracking);

        assertThat(fromList).isNotNull();
        assertThat(tracked.trackingNumber()).isEqualTo(tracking);
        assertThat(tracked.currentStatus()).isEqualTo(JobOrderStatus.PENDING);
    }

    @Test
    void deliveryReadFallsBackToMysqlInHybridMode() {
        User staff = createUser("staff-delivery-hybrid-" + UUID.randomUUID() + "@test.com", Role.STAFF, "Light");
        String tracking = "WA-HD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        JobOrder order = createOrder(tracking, "Light", JobOrderStatus.READY, ServiceType.PICKUP_DELIVERY);
        order.setDeliveryAddress("Light Residences");
        order = jobOrderRepository.save(order);

        DeliveryOrder delivery = DeliveryOrder.builder()
                .jobOrder(order)
                .driverName("Driver Hybrid")
                .driverPhone("09123456789")
                .leg(DeliveryLeg.PICKUP_FROM_CUSTOMER)
                .status(DeliveryStatus.PENDING_PICKUP)
                .build();
        deliveryOrderRepository.save(delivery);

        DeliveryResponse tracked = deliveryService.trackByTrackingNumber(tracking);
        DeliveryResponse view = deliveryService.getById(tracked.id(), new AuthUserDetails(staff));

        assertThat(tracked.trackingNumber()).isEqualTo(tracking);
        assertThat(view.id()).isEqualTo(tracked.id());
        assertThat(view.status()).isEqualTo(DeliveryStatus.PENDING_PICKUP);
    }

    @Test
    void authMeFallsBackToMysqlInHybridMode() {
        User user = createUser("me-hybrid-" + UUID.randomUUID() + "@test.com", Role.STAFF, "Light");
        MeResponse me = authService.me(new AuthUserDetails(user));

        assertThat(me.email()).isEqualTo(user.getEmail());
        assertThat(me.role()).isEqualTo("STAFF");
        assertThat(me.enabled()).isTrue();
    }

    private User createUser(String email, Role role, String branch) {
        User user = User.builder()
                .email(email)
                .fullName("Hybrid Test User")
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
                .customerName("Hybrid Customer")
                .branch(branch)
                .status(status)
                .serviceType(serviceType)
                .createdAt(LocalDateTime.now())
                .build();
        return jobOrderRepository.save(order);
    }
}
