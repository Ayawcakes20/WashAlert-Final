package com.washalert.washalertbackend.firebase;

import com.washalert.washalertbackend.delivery.DeliveryOrder;
import com.washalert.washalertbackend.delivery.DeliveryOrderRepository;
import com.washalert.washalertbackend.delivery.DeliveryStatus;
import com.washalert.washalertbackend.inventory.InventoryItem;
import com.washalert.washalertbackend.inventory.InventoryItemRepository;
import com.washalert.washalertbackend.machines.Machine;
import com.washalert.washalertbackend.machines.MachineRepository;
import com.washalert.washalertbackend.machines.MachineStatus;
import com.washalert.washalertbackend.machines.MachineType;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.user.AuthProvider;
import com.washalert.washalertbackend.user.Role;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FirestoreBackfillServiceTests {

    @Test
    void backfillCopiesAllCollectionsWhenFirestoreEnabled() {
        UserRepository userRepository = mock(UserRepository.class);
        MachineRepository machineRepository = mock(MachineRepository.class);
        InventoryItemRepository inventoryItemRepository = mock(InventoryItemRepository.class);
        JobOrderRepository jobOrderRepository = mock(JobOrderRepository.class);
        DeliveryOrderRepository deliveryOrderRepository = mock(DeliveryOrderRepository.class);
        FirestoreSyncService firestoreSyncService = mock(FirestoreSyncService.class);

        when(firestoreSyncService.isEnabled()).thenReturn(true);
        when(userRepository.findAll()).thenReturn(List.of(sampleUser()));
        when(machineRepository.findAll()).thenReturn(List.of(sampleMachine()));
        when(inventoryItemRepository.findAll()).thenReturn(List.of(sampleInventory()));
        when(jobOrderRepository.findAll()).thenReturn(List.of(sampleOrder()));
        when(deliveryOrderRepository.findAll()).thenReturn(List.of(sampleDelivery(sampleOrder())));

        FirestoreBackfillService service = new FirestoreBackfillService(
                userRepository,
                machineRepository,
                inventoryItemRepository,
                jobOrderRepository,
                deliveryOrderRepository,
                firestoreSyncService
        );

        FirestoreBackfillService.BackfillResult result = service.runFullBackfill();

        assertThat(result.users()).isEqualTo(1);
        assertThat(result.machines()).isEqualTo(1);
        assertThat(result.inventory()).isEqualTo(1);
        assertThat(result.orders()).isEqualTo(1);
        assertThat(result.deliveries()).isEqualTo(1);
        verify(firestoreSyncService, times(5)).upsert(anyString(), anyString(), any());
    }

    @Test
    void backfillSkipsWhenFirestoreDisabled() {
        UserRepository userRepository = mock(UserRepository.class);
        MachineRepository machineRepository = mock(MachineRepository.class);
        InventoryItemRepository inventoryItemRepository = mock(InventoryItemRepository.class);
        JobOrderRepository jobOrderRepository = mock(JobOrderRepository.class);
        DeliveryOrderRepository deliveryOrderRepository = mock(DeliveryOrderRepository.class);
        FirestoreSyncService firestoreSyncService = mock(FirestoreSyncService.class);

        when(firestoreSyncService.isEnabled()).thenReturn(false);

        FirestoreBackfillService service = new FirestoreBackfillService(
                userRepository,
                machineRepository,
                inventoryItemRepository,
                jobOrderRepository,
                deliveryOrderRepository,
                firestoreSyncService
        );

        FirestoreBackfillService.BackfillResult result = service.runFullBackfill();

        assertThat(result.users()).isEqualTo(0);
        assertThat(result.machines()).isEqualTo(0);
        assertThat(result.inventory()).isEqualTo(0);
        assertThat(result.orders()).isEqualTo(0);
        assertThat(result.deliveries()).isEqualTo(0);
        verify(firestoreSyncService, times(0)).upsert(anyString(), anyString(), any());
    }

    private User sampleUser() {
        return User.builder()
                .id(1L)
                .email("admin@example.com")
                .fullName("Admin")
                .passwordHash("hash")
                .role(Role.ADMIN)
                .enabled(true)
                .mustChangePassword(false)
                .provider(AuthProvider.LOCAL)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private Machine sampleMachine() {
        return Machine.builder()
                .id(1L)
                .machineId("M-01")
                .branch("Main")
                .type(MachineType.WASHER)
                .status(MachineStatus.AVAILABLE)
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private InventoryItem sampleInventory() {
        return InventoryItem.builder()
                .id(1L)
                .branch("Main")
                .itemName("Detergent")
                .category("Supplies")
                .unit("kg")
                .currentStock(BigDecimal.TEN)
                .reorderLevel(BigDecimal.ONE)
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private JobOrder sampleOrder() {
        return JobOrder.builder()
                .id(1L)
                .trackingNumber("WA-10001")
                .customerName("Customer")
                .branch("Main")
                .status(JobOrderStatus.PENDING)
                .serviceType(ServiceType.DROP_OFF)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    private DeliveryOrder sampleDelivery(JobOrder order) {
        return DeliveryOrder.builder()
                .id(1L)
                .jobOrder(order)
                .driverName("Driver")
                .driverPhone("09123456789")
                .status(DeliveryStatus.PENDING_PICKUP)
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
