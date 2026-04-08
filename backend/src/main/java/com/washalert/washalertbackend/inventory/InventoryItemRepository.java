package com.washalert.washalertbackend.inventory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    List<InventoryItem> findByBranchIgnoreCaseOrderByItemNameAsc(String branch);
    List<InventoryItem> findAllByOrderByBranchAscItemNameAsc();
    Optional<InventoryItem> findByBranchIgnoreCaseAndItemNameIgnoreCase(String branch, String itemName);
}
