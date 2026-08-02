package com.washalert.washalertbackend.inventory;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    // Branch is free text with no canonical entity/FK (see BranchNames) — normalized the same
    // way the rest of the backend already is. This is the heaviest-used branch comparison in
    // the codebase (stock-adjustment/consumption lookups); an unnormalized match here can fail
    // to find an existing item for a real branch, causing false "item not found" errors or
    // even a duplicate item getting created for what is actually the same branch.
    @Query("select i from InventoryItem i where replace(lower(i.branch), ' branch', '') = replace(lower(:branch), ' branch', '') order by i.itemName asc")
    List<InventoryItem> findByNormalizedBranchOrderByItemNameAsc(@Param("branch") String branch);

    List<InventoryItem> findAllByOrderByBranchAscItemNameAsc();

    @Query("select i from InventoryItem i where replace(lower(i.branch), ' branch', '') = replace(lower(:branch), ' branch', '') and lower(i.itemName) = lower(:itemName)")
    Optional<InventoryItem> findByNormalizedBranchAndItemNameIgnoreCase(@Param("branch") String branch, @Param("itemName") String itemName);

    List<InventoryItem> findByItemNameIgnoreCase(String itemName);

    @Query("select i from InventoryItem i where replace(lower(i.branch), ' branch', '') = replace(lower(:branch), ' branch', '')")
    Page<InventoryItem> findByNormalizedBranch(@Param("branch") String branch, Pageable pageable);

    Page<InventoryItem> findAll(Pageable pageable);
}
