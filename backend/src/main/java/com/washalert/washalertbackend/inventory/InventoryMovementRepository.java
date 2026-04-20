package com.washalert.washalertbackend.inventory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
    List<InventoryMovement> findByInventoryItem_IdOrderByCreatedAtDesc(Long inventoryItemId);
    List<InventoryMovement> findByInventoryItem_IdAndCreatedAtAfter(Long inventoryItemId, LocalDateTime createdAt);
    void deleteByInventoryItem_Id(Long inventoryItemId);
}
