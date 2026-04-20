package com.washalert.washalertbackend.inventory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "inventory_items",
        indexes = {
                @Index(name = "idx_inventory_items_branch", columnList = "branch"),
                @Index(name = "idx_inventory_items_name", columnList = "item_name"),
                @Index(name = "idx_inventory_items_branch_name", columnList = "branch,item_name", unique = true)
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String branch;

    @Column(name = "item_name", nullable = false, length = 120)
    private String itemName;

    @Column(nullable = false, length = 50)
    private String category;

    @Column(nullable = false, length = 30)
    private String unit;

    @Column(name = "current_stock", nullable = false, precision = 12, scale = 2)
    private BigDecimal currentStock;

    @Column(name = "reorder_level", nullable = false, precision = 12, scale = 2)
    private BigDecimal reorderLevel;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (currentStock == null) currentStock = BigDecimal.ZERO;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
