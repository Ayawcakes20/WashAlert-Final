package com.washalert.washalertbackend.orders;

import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
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

import static org.junit.jupiter.api.Assertions.assertEquals;

// Separate Spring context from GeofenceEnforcementEnabledTests specifically to set
// washalert.geofence.enforce=false — proves the WASHALERT_GEOFENCE_ENFORCE=false override
// documented for test/staging deployments actually skips the check end-to-end.
@SpringBootTest(properties = { "washalert.firebase.enabled=false", "washalert.geofence.enforce=false" })
@ActiveProfiles("test")
class GeofenceEnforcementDisabledTests {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JobOrderRepository jobOrderRepository;
    @Autowired
    private JobOrderService jobOrderService;

    @Test
    void confirmArrivedAtBranchSkipsCheckWhenDisabled() {
        User driver = userRepository.save(User.builder()
                .email("geofence-driver-disabled@test.com")
                .fullName("Test Driver")
                .passwordHash("hashed")
                .role(Role.DRIVER)
                .enabled(true)
                .mustChangePassword(false)
                .verifiedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .branch("Makati")
                .provider(AuthProvider.LOCAL)
                .build());

        JobOrder order = jobOrderRepository.save(JobOrder.builder()
                .trackingNumber("WA-GEOFENCE-2")
                .customerName("Customer Test")
                .branch("Makati")
                .status(JobOrderStatus.LAUNDRY_COLLECTED)
                .serviceType(ServiceType.PICKUP_DELIVERY)
                .createdAt(LocalDateTime.now())
                .assignedPickupDriver(driver)
                .branchLatitude(14.5547)
                .branchLongitude(121.0244)
                .build());

        // Same ~15km-away position as GeofenceEnforcementEnabledTests, but with enforcement
        // disabled this must succeed and actually transition the order.
        JobOrderResponse response = jobOrderService.confirmArrivedAtBranch(order.getId(), 14.6760, 121.0437,
                new AuthUserDetails(driver));
        assertEquals(JobOrderStatus.ORDER_RECEIVED, response.getStatus());
    }
}
