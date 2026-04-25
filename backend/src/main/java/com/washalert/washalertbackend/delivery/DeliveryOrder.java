package com.washalert.washalertbackend.delivery;

import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "delivery_orders",
        indexes = {
                @Index(name = "idx_delivery_orders_status", columnList = "status"),
                @Index(name = "idx_delivery_orders_updated_at", columnList = "updated_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_order_id", nullable = false)
    private JobOrder jobOrder;

    @Column(name = "driver_name", nullable = false, length = 120)
    private String driverName;

    @Column(name = "driver_phone", nullable = false, length = 30)
    private String driverPhone;

    // Link to the actual driver User account (null for legacy records assigned by name/phone)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_user_id")
    private User driverUser;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DeliveryLeg leg;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DeliveryStatus status;

    @Column(name = "current_latitude")
    private Double currentLatitude;

    @Column(name = "current_longitude")
    private Double currentLongitude;

    @Column(name = "estimated_arrival_at")
    private LocalDateTime estimatedArrivalAt;

    @Column(name = "pickup_proof_url", length = 1000)
    private String pickupProofUrl;

    @Column(name = "dropoff_proof_url", length = 1000)
    private String dropoffProofUrl;

    @Column(length = 300)
    private String notes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // ── State Machine: Phase A ─────────────────────────────────────────────────
    /** Number of laundry bags confirmed by driver at customer pickup. */
    @Column(name = "bag_count")
    private Integer bagCount;

    /** Photo proof of bags handed over at the laundry branch counter. */
    @Column(name = "branch_handover_photo_url", length = 1000)
    private String branchHandoverPhotoUrl;

    // ── State Machine: Phase B ─────────────────────────────────────────────────
    /** Auto-generated 4-digit code sent to customer; driver must confirm at final delivery. */
    @Column(name = "confirmation_code", length = 10)
    private String confirmationCode;

    /** Photo proof of clean laundry handed to customer at final delivery. */
    @Column(name = "final_delivery_photo_url", length = 1000)
    private String finalDeliveryPhotoUrl;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (status == null) status = DeliveryStatus.ASSIGNED_PICKUP;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

