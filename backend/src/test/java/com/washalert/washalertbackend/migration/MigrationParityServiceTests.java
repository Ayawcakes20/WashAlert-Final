package com.washalert.washalertbackend.migration;

import com.washalert.washalertbackend.common.DataReadMode;
import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.delivery.DeliveryOrderRepository;
import com.washalert.washalertbackend.delivery.DeliveryStatus;
import com.washalert.washalertbackend.delivery.dto.DeliveryResponse;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.inventory.InventoryItemRepository;
import com.washalert.washalertbackend.inventory.dto.InventoryItemResponse;
import com.washalert.washalertbackend.machines.MachineRepository;
import com.washalert.washalertbackend.machines.MachineStatus;
import com.washalert.washalertbackend.machines.MachineType;
import com.washalert.washalertbackend.machines.dto.MachineResponse;
import com.washalert.washalertbackend.migration.dto.MigrationParityResponse;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MigrationParityServiceTests {

    @Test
    void readyForStrictFirestoreIsTrueWhenAllCountsMatch() {
        UserRepository userRepository = mock(UserRepository.class);
        MachineRepository machineRepository = mock(MachineRepository.class);
        InventoryItemRepository inventoryItemRepository = mock(InventoryItemRepository.class);
        JobOrderRepository jobOrderRepository = mock(JobOrderRepository.class);
        DeliveryOrderRepository deliveryOrderRepository = mock(DeliveryOrderRepository.class);
        FirestoreReadService firestoreReadService = mock(FirestoreReadService.class);
        DataReadProperties props = new DataReadProperties();
        props.setReadMode(DataReadMode.HYBRID);

        when(firestoreReadService.isAvailable()).thenReturn(true);
        when(userRepository.count()).thenReturn(1L);
        when(machineRepository.count()).thenReturn(1L);
        when(inventoryItemRepository.count()).thenReturn(1L);
        when(jobOrderRepository.count()).thenReturn(1L);
        when(deliveryOrderRepository.count()).thenReturn(1L);

        when(firestoreReadService.listUsers()).thenReturn(List.of(
                new FirestoreReadService.FirestoreUserRecord(
                        1L, "a@test.com", "A", "STAFF", "Main", true, false, "LOCAL", null, null, "x")
        ));
        when(firestoreReadService.listMachines()).thenReturn(List.of(
                new MachineResponse(1L, "M-1", "Main", MachineType.WASHER, MachineStatus.AVAILABLE, LocalDateTime.now())
        ));
        when(firestoreReadService.listInventoryItems()).thenReturn(List.of(
                new InventoryItemResponse(1L, "Main", "Detergent", "Supplies", "kg", BigDecimal.ONE, BigDecimal.ONE, true, LocalDateTime.now())
        ));
        when(firestoreReadService.listOrders()).thenReturn(List.of(
                new JobOrderResponse(1L, "WA-10001", "Customer", "Main", JobOrderStatus.PENDING, LocalDateTime.now(), LocalDateTime.now(),
                        ServiceType.DROP_OFF, null, null, null, null, null, null, null, null, null, null, null,
                        BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, false, "GCash", null, null, null, null)
        ));
        when(firestoreReadService.listDeliveries()).thenReturn(List.of(
                new DeliveryResponse(1L, "WA-10001", "Main", "Customer", "Address", "Driver", "09123",
                        DeliveryStatus.PENDING_PICKUP, null, null, null, null, LocalDateTime.now(), null, null)
        ));

        MigrationParityService service = new MigrationParityService(
                userRepository,
                machineRepository,
                inventoryItemRepository,
                jobOrderRepository,
                deliveryOrderRepository,
                firestoreReadService,
                props
        );

        MigrationParityResponse report = service.buildParityReport();
        assertThat(report.readyForStrictFirestore()).isTrue();
        assertThat(report.modules()).allMatch(m -> m.parity());
    }
}
