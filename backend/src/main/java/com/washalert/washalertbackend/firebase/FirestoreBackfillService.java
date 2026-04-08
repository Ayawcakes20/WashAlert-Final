package com.washalert.washalertbackend.firebase;

import com.washalert.washalertbackend.delivery.DeliveryOrder;
import com.washalert.washalertbackend.delivery.DeliveryOrderRepository;
import com.washalert.washalertbackend.inventory.InventoryItem;
import com.washalert.washalertbackend.inventory.InventoryItemRepository;
import com.washalert.washalertbackend.machines.Machine;
import com.washalert.washalertbackend.machines.MachineRepository;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import com.washalert.washalertbackend.user.User;
import com.washalert.washalertbackend.user.UserRepository;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class FirestoreBackfillService {

    public record BackfillResult(
            int users,
            int machines,
            int inventory,
            int orders,
            int deliveries
    ) {
    }

    private final UserRepository userRepository;
    private final MachineRepository machineRepository;
    private final InventoryItemRepository inventoryItemRepository;
    private final JobOrderRepository jobOrderRepository;
    private final DeliveryOrderRepository deliveryOrderRepository;
    private final FirestoreSyncService firestoreSyncService;

    public FirestoreBackfillService(
            UserRepository userRepository,
            MachineRepository machineRepository,
            InventoryItemRepository inventoryItemRepository,
            JobOrderRepository jobOrderRepository,
            DeliveryOrderRepository deliveryOrderRepository,
            FirestoreSyncService firestoreSyncService
    ) {
        this.userRepository = userRepository;
        this.machineRepository = machineRepository;
        this.inventoryItemRepository = inventoryItemRepository;
        this.jobOrderRepository = jobOrderRepository;
        this.deliveryOrderRepository = deliveryOrderRepository;
        this.firestoreSyncService = firestoreSyncService;
    }

    public BackfillResult runFullBackfill() {
        if (!firestoreSyncService.isEnabled()) {
            return new BackfillResult(0, 0, 0, 0, 0);
        }

        int users = 0;
        for (User user : userRepository.findAll()) {
            firestoreSyncService.upsert("users", String.valueOf(user.getId()), FirestoreUserPayloadFactory.fromUser(user));
            users++;
        }

        int machines = 0;
        for (Machine machine : machineRepository.findAll()) {
            firestoreSyncService.upsert("machines", machine.getMachineId(), toMachinePayload(machine));
            machines++;
        }

        int inventory = 0;
        for (InventoryItem item : inventoryItemRepository.findAll()) {
            firestoreSyncService.upsert("inventory", String.valueOf(item.getId()), toInventoryPayload(item));
            inventory++;
        }

        int orders = 0;
        for (JobOrder order : jobOrderRepository.findAll()) {
            firestoreSyncService.upsert("orders", order.getTrackingNumber(), toOrderPayload(order));
            orders++;
        }

        int deliveries = 0;
        for (DeliveryOrder delivery : deliveryOrderRepository.findAll()) {
            firestoreSyncService.upsert("deliveries", delivery.getJobOrder().getTrackingNumber(), toDeliveryPayload(delivery));
            deliveries++;
        }

        return new BackfillResult(users, machines, inventory, orders, deliveries);
    }

    private Map<String, Object> toMachinePayload(Machine m) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", m.getId());
        payload.put("machineId", m.getMachineId());
        payload.put("branch", m.getBranch());
        payload.put("type", m.getType());
        payload.put("status", m.getStatus());
        payload.put("updatedAt", m.getUpdatedAt());
        return payload;
    }

    private Map<String, Object> toInventoryPayload(InventoryItem item) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", item.getId());
        payload.put("branch", item.getBranch());
        payload.put("itemName", item.getItemName());
        payload.put("category", item.getCategory());
        payload.put("unit", item.getUnit());
        payload.put("currentStock", item.getCurrentStock());
        payload.put("reorderLevel", item.getReorderLevel());
        payload.put("updatedAt", item.getUpdatedAt());
        return payload;
    }

    private Map<String, Object> toOrderPayload(JobOrder o) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", o.getId());
        payload.put("trackingNumber", o.getTrackingNumber());
        payload.put("customerName", o.getCustomerName());
        payload.put("branch", o.getBranch());
        payload.put("status", o.getStatus());
        payload.put("createdAt", o.getCreatedAt());
        payload.put("updatedAt", o.getUpdatedAt());
        payload.put("serviceType", o.getServiceType());
        payload.put("bookingDate", o.getBookingDate());
        payload.put("slotStartTime", o.getSlotStartTime());
        payload.put("slotEndTime", o.getSlotEndTime());
        payload.put("detergentPreference", o.getDetergentPreference());
        payload.put("fabricConditionerPreference", o.getFabricConditionerPreference());
        payload.put("loadSize", o.getLoadSize());
        payload.put("estimatedWeightKg", o.getEstimatedWeightKg());
        payload.put("specialInstructions", o.getSpecialInstructions());
        payload.put("customerPhone", o.getCustomerPhone());
        payload.put("customerEmail", o.getCustomerEmail());
        payload.put("deliveryAddress", o.getDeliveryAddress());
        return payload;
    }

    private Map<String, Object> toDeliveryPayload(DeliveryOrder d) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", d.getId());
        payload.put("trackingNumber", d.getJobOrder().getTrackingNumber());
        payload.put("branch", d.getJobOrder().getBranch());
        payload.put("customerName", d.getJobOrder().getCustomerName());
        payload.put("deliveryAddress", d.getJobOrder().getDeliveryAddress());
        payload.put("driverName", d.getDriverName());
        payload.put("driverPhone", d.getDriverPhone());
        payload.put("status", d.getStatus());
        payload.put("currentLatitude", d.getCurrentLatitude());
        payload.put("currentLongitude", d.getCurrentLongitude());
        payload.put("estimatedArrivalAt", d.getEstimatedArrivalAt());
        payload.put("notes", d.getNotes());
        payload.put("updatedAt", d.getUpdatedAt());
        return payload;
    }
}
