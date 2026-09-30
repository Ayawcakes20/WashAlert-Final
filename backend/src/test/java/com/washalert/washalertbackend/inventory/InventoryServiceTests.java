package com.washalert.washalertbackend.inventory;

import com.washalert.washalertbackend.common.DataReadProperties;
import com.washalert.washalertbackend.firebase.FirestoreReadService;
import com.washalert.washalertbackend.firebase.FirestoreSyncService;
import com.washalert.washalertbackend.notification.NotificationService;
import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class InventoryServiceTests {

    private InventoryItemRepository itemRepository;
    private InventoryMovementRepository movementRepository;
    private JobOrderRepository jobOrderRepository;
    private FirestoreSyncService firestoreSyncService;
    private FirestoreReadService firestoreReadService;
    private DataReadProperties dataReadProperties;
    private NotificationService notificationService;
    private InventoryService inventoryService;

    @BeforeEach
    void setUp() {
        itemRepository = mock(InventoryItemRepository.class);
        movementRepository = mock(InventoryMovementRepository.class);
        jobOrderRepository = mock(JobOrderRepository.class);
        firestoreSyncService = mock(FirestoreSyncService.class);
        firestoreReadService = mock(FirestoreReadService.class);
        dataReadProperties = mock(DataReadProperties.class);
        notificationService = mock(NotificationService.class);

        inventoryService = new InventoryService(
                itemRepository,
                movementRepository,
                jobOrderRepository,
                firestoreSyncService,
                firestoreReadService,
                dataReadProperties,
                notificationService
        );
    }

    private JobOrder createTestOrder(String trackingNumber, String branch, String det, int detQty, String fab, int conQty) {
        return JobOrder.builder()
                .trackingNumber(trackingNumber)
                .branch(branch)
                .detergentPreference(det)
                .detergentQuantity(detQty)
                .fabricConditionerPreference(fab)
                .conditionerQuantity(conQty)
                .build();
    }

    private InventoryItem createInventoryItem(Long id, String branch, String itemName, BigDecimal stock) {
        return InventoryItem.builder()
                .id(id)
                .branch(branch)
                .itemName(itemName)
                .category("Supplies")
                .unit("sachet")
                .currentStock(stock)
                .reorderLevel(BigDecimal.valueOf(10))
                .build();
    }

    @Test
    void deductAtBookingDeductsExactQuantitiesAndRecordsMovement() {
        JobOrder order = createTestOrder("WA-10001", "Makati Branch", "Surf Detergent", 5, "Charm Fabric Conditioner", 2);

        InventoryItem surf = createInventoryItem(1L, "Makati Branch", "Surf Detergent", BigDecimal.valueOf(45));
        InventoryItem charm = createInventoryItem(2L, "Makati Branch", "Charm Fabric Conditioner", BigDecimal.valueOf(30));

        when(movementRepository.existsByReasonStartingWith("Booking: WA-10001")).thenReturn(false);
        when(itemRepository.findByNormalizedBranchAndItemNameIgnoreCase("Makati Branch", "Surf Detergent"))
                .thenReturn(Optional.of(surf));
        when(itemRepository.findByNormalizedBranchAndItemNameIgnoreCase("Makati Branch", "Charm Fabric Conditioner"))
                .thenReturn(Optional.of(charm));
        when(itemRepository.save(any(InventoryItem.class))).thenAnswer(inv -> inv.getArgument(0));

        inventoryService.deductAtBooking(order);

        // Verify stock deducted: 45 - 5 = 40, 30 - 2 = 28
        assertThat(surf.getCurrentStock()).isEqualByComparingTo("40");
        assertThat(charm.getCurrentStock()).isEqualByComparingTo("28");

        // Verify movement reasons
        ArgumentCaptor<InventoryMovement> movementCaptor = ArgumentCaptor.forClass(InventoryMovement.class);
        verify(movementRepository, times(2)).save(movementCaptor.capture());
        assertThat(movementCaptor.getAllValues()).allMatch(m -> m.getReason().equals("Booking: WA-10001"));

        // Verify Firestore sync was triggered for both items
        verify(firestoreSyncService).upsert(eq("inventory"), eq("1"), any());
        verify(firestoreSyncService).upsert(eq("inventory"), eq("2"), any());
    }

    @Test
    void deductAtBookingSkipsDuplicateDeduction() {
        JobOrder order = createTestOrder("WA-10001", "Makati Branch", "Surf Detergent", 5, "Charm Fabric Conditioner", 2);
        when(movementRepository.existsByReasonStartingWith("Booking: WA-10001")).thenReturn(true);

        inventoryService.deductAtBooking(order);

        verify(itemRepository, never()).save(any());
        verify(movementRepository, never()).save(any());
    }

    @Test
    void releaseForOrderRestoresExactQuantities() {
        JobOrder order = createTestOrder("WA-10001", "Makati Branch", "Surf Detergent", 5, "Charm Fabric Conditioner", 2);

        InventoryItem surf = createInventoryItem(1L, "Makati Branch", "Surf Detergent", BigDecimal.valueOf(40));
        InventoryItem charm = createInventoryItem(2L, "Makati Branch", "Charm Fabric Conditioner", BigDecimal.valueOf(28));

        when(movementRepository.existsByReasonStartingWith("Booking-Release: WA-10001")).thenReturn(false);
        when(movementRepository.existsByReasonStartingWith("Booking: WA-10001")).thenReturn(true);
        when(itemRepository.findByNormalizedBranchAndItemNameIgnoreCase("Makati Branch", "Surf Detergent"))
                .thenReturn(Optional.of(surf));
        when(itemRepository.findByNormalizedBranchAndItemNameIgnoreCase("Makati Branch", "Charm Fabric Conditioner"))
                .thenReturn(Optional.of(charm));
        when(itemRepository.save(any(InventoryItem.class))).thenAnswer(inv -> inv.getArgument(0));

        inventoryService.releaseForOrder(order);

        // Verify stock restored: 40 + 5 = 45, 28 + 2 = 30
        assertThat(surf.getCurrentStock()).isEqualByComparingTo("45");
        assertThat(charm.getCurrentStock()).isEqualByComparingTo("30");

        // Verify movement reasons
        ArgumentCaptor<InventoryMovement> movementCaptor = ArgumentCaptor.forClass(InventoryMovement.class);
        verify(movementRepository, times(2)).save(movementCaptor.capture());
        assertThat(movementCaptor.getAllValues()).allMatch(m -> m.getReason().equals("Booking-Release: WA-10001"));

        verify(firestoreSyncService).upsert(eq("inventory"), eq("1"), any());
        verify(firestoreSyncService).upsert(eq("inventory"), eq("2"), any());
    }

    @Test
    void releaseForOrderSkipsIfAlreadyReleased() {
        JobOrder order = createTestOrder("WA-10001", "Makati Branch", "Surf Detergent", 5, "Charm Fabric Conditioner", 2);
        when(movementRepository.existsByReasonStartingWith("Booking-Release: WA-10001")).thenReturn(true);

        inventoryService.releaseForOrder(order);

        verify(itemRepository, never()).save(any());
        verify(movementRepository, never()).save(any());
    }

    @Test
    void releaseForOrderSkipsIfNeverDeductedAtBooking() {
        JobOrder order = createTestOrder("WA-10001", "Makati Branch", "Surf Detergent", 5, "Charm Fabric Conditioner", 2);
        when(movementRepository.existsByReasonStartingWith("Booking-Release: WA-10001")).thenReturn(false);
        when(movementRepository.existsByReasonStartingWith("Booking: WA-10001")).thenReturn(false);

        inventoryService.releaseForOrder(order);

        verify(itemRepository, never()).save(any());
        verify(movementRepository, never()).save(any());
    }

    @Test
    void deductForOrderSkipsIfBookingDeductionAlreadyHappened() {
        JobOrder order = createTestOrder("WA-10001", "Makati Branch", "Surf Detergent", 5, "Charm Fabric Conditioner", 2);
        // Booking deduction was already done
        when(movementRepository.existsByReasonStartingWith("Booking: WA-10001")).thenReturn(true);

        // Order enters WASHING status -> calls deductForOrder
        inventoryService.deductForOrder(order);

        // Must skip — NO second deduction at WASHING!
        verify(itemRepository, never()).save(any());
        verify(movementRepository, never()).save(any());
    }

    @Test
    void validateSuppliesForBookingThrowsOnInsufficientStock() {
        InventoryItem surf = createInventoryItem(1L, "Makati Branch", "Surf Detergent", BigDecimal.valueOf(2));
        when(itemRepository.findByNormalizedBranchAndItemNameIgnoreCase("Makati Branch", "Surf Detergent"))
                .thenReturn(Optional.of(surf));

        assertThatThrownBy(() -> inventoryService.validateSuppliesForBooking("Makati Branch", "Surf Detergent", "None", 5, 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Surf Detergent requires 5 sachet(s) but only 2 are available");
    }
}
