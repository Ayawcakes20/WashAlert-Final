package com.washalert.washalertbackend.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {
    List<InventoryMovement> findByInventoryItem_IdOrderByCreatedAtDesc(Long inventoryItemId);
    List<InventoryMovement> findByInventoryItem_IdAndCreatedAtAfter(Long inventoryItemId, LocalDateTime createdAt);
    void deleteByInventoryItem_Id(Long inventoryItemId);
    boolean existsByReasonStartingWith(String prefix);

    @Query("SELECT m FROM InventoryMovement m " +
           "WHERE m.inventoryItem.branch = :branch " +
           "AND m.createdAt >= :since " +
           "AND m.quantityDelta < 0 " +
           "ORDER BY m.inventoryItem.itemName, m.createdAt")
    List<InventoryMovement> findOutMovementsByBranchSince(
            @Param("branch") String branch,
            @Param("since") LocalDateTime since);

    @Query("SELECT m FROM InventoryMovement m " +
           "WHERE m.createdAt >= :since " +
           "AND m.quantityDelta < 0 " +
           "ORDER BY m.inventoryItem.branch, m.inventoryItem.itemName, m.createdAt")
    List<InventoryMovement> findAllOutMovementsSince(@Param("since") LocalDateTime since);
}
