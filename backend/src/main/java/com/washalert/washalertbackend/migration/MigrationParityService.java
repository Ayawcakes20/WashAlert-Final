package com.washalert.washalertbackend.migration;

import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.delivery.DeliveryOrderRepository;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.inventory.InventoryItemRepository;
import com.washalert.washalertbackend.machines.MachineRepository;
import com.washalert.washalertbackend.migration.dto.MigrationParityResponse;
import com.washalert.washalertbackend.migration.dto.ModuleParityResponse;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.user.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class MigrationParityService {

    private final UserRepository userRepository;
    private final MachineRepository machineRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final JobOrderRepository jobOrderRepository;
    private final DeliveryOrderRepository deliveryOrderRepository;
    private final FirestoreReadService firestoreReadService;
    private final DataReadProperties dataReadProperties;

    public MigrationParityService(
            UserRepository userRepository,
            MachineRepository machineRepository,
            InventoryItemRepository inventoryItemRepository,
            JobOrderRepository jobOrderRepository,
            DeliveryOrderRepository deliveryOrderRepository,
            FirestoreReadService firestoreReadService,
            DataReadProperties dataReadProperties
    ) {
        this.userRepository = userRepository;
        this.machineRepository = machineRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.jobOrderRepository = jobOrderRepository;
        this.deliveryOrderRepository = deliveryOrderRepository;
        this.firestoreReadService = firestoreReadService;
        this.dataReadProperties = dataReadProperties;
    }

    public MigrationParityResponse buildParityReport() {
        boolean firestoreAvailable = firestoreReadService.isAvailable();

        ModuleParityResponse users = parity(
                "users",
                userRepository.count(),
                firestoreReadService.listUsers().size()
        );
        ModuleParityResponse machines = parity(
                "machines",
                machineRepository.count(),
                firestoreReadService.listMachines().size()
        );
        ModuleParityResponse inventory = parity(
                "inventory",
                inventoryItemRepository.count(),
                firestoreReadService.listInventoryItems().size()
        );
        ModuleParityResponse orders = parity(
                "orders",
                jobOrderRepository.count(),
                firestoreReadService.listOrders().size()
        );
        ModuleParityResponse deliveries = parity(
                "deliveries",
                deliveryOrderRepository.count(),
                firestoreReadService.listDeliveries().size()
        );

        List<ModuleParityResponse> modules = List.of(users, machines, inventory, orders, deliveries);
        boolean ready = firestoreAvailable && modules.stream().allMatch(ModuleParityResponse::parity);

        return new MigrationParityResponse(
                Instant.now(),
                firestoreAvailable,
                dataReadProperties.getReadMode().name(),
                ready,
                modules
        );
    }

    private ModuleParityResponse parity(String module, long mysqlCount, long firestoreCount) {
        return new ModuleParityResponse(module, mysqlCount, firestoreCount, mysqlCount == firestoreCount);
    }
}
