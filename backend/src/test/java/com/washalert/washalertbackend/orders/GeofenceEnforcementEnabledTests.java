package com.washalert.washalertbackend.orders;

import com.washalert.washalertbackend.security.AuthUserDetails;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

// Two separate top-level test classes (rather than toggling the property mid-test) so each gets
// its own Spring context built with washalert.geofence.enforce baked in at startup, since it's
// read once via @Value at bean creation, not re-evaluated per call.

@SpringBootTest(properties = { "washalert.firebase.enabled=false" })
@ActiveProfiles("test")
class GeofenceEnforcementEnabledTests {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JobOrderRepository jobOrderRepository;
    @Autowired
    private JobOrderService jobOrderService;

    @Test
    void confirmArrivedAtBranchRejectsDriverFarFromBranch() {
        User driver = userRepository.save(User.builder()
                .email("geofence-driver-enabled@test.com")
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
                .trackingNumber("WA-GEOFENCE-1")
                .customerName("Customer Test")
                .branch("Makati")
                .status(JobOrderStatus.LAUNDRY_COLLECTED)
                .serviceType(ServiceType.PICKUP_DELIVERY)
                .createdAt(LocalDateTime.now())
                .assignedPickupDriver(driver)
                // Makati branch coordinates
                .branchLatitude(14.5547)
                .branchLongitude(121.0244)
                .build());

        // Driver reports a position ~15km away (Quezon City) — well outside the 150m radius.
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                jobOrderService.confirmArrivedAtBranch(order.getId(), 14.6760, 121.0437,
                        new AuthUserDetails(driver))
        );
        assertEquals(400, ex.getStatusCode().value());
    }
}
