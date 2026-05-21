package com.washalert.washalertbackend.orders;

import com.washalert.washalertbackend.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
import org.hibernate.annotations.DynamicInsert;
import org.hibernate.annotations.DynamicUpdate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(
        name = "job_orders",
        indexes = {
                @Index(name = "idx_job_orders_tracking", columnList = "tracking_number", unique = true),
                @Index(name = "idx_job_orders_status", columnList = "status"),
                @Index(name = "idx_job_orders_created_at", columnList = "created_at"),
                @Index(name = "idx_job_orders_booking_slot", columnList = "branch,booking_date,slot_start_time")
        }
)
@DynamicUpdate  // Only include changed columns in UPDATE — prevents SQL errors for new columns not yet in production DB
@DynamicInsert  // Only include non-null columns in INSERT — prevents errors on columns with DB-level defaults
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tracking_number", nullable = false, unique = true, length = 40)
    private String trackingNumber;

    @Column(name = "customer_name", nullable = false, length = 120)
    private String customerName;

    @Column(name = "branch", length = 80)
    private String branch;

    @Column(name = "branch_id")
    private Long branchId;

    @Column(name = "customer_phone", length = 30)
    private String customerPhone;

    @Column(name = "customer_email", length = 120)
    private String customerEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", length = 30)
    private ServiceType serviceType;

    @Column(name = "delivery_address", length = 255)
    private String deliveryAddress;

    @Column(name = "delivery_unit_floor", length = 100)
    private String deliveryUnitFloor;

    @Column(name = "delivery_contact_name", length = 120)
    private String deliveryContactName;

    @Column(name = "delivery_contact_phone", length = 30)
    private String deliveryContactPhone;

    @Column(name = "delivery_latitude")
    private Double deliveryLatitude;

    @Column(name = "delivery_longitude")
    private Double deliveryLongitude;

    @Column(name = "branch_latitude")
    private Double branchLatitude;

    @Column(name = "branch_longitude")
    private Double branchLongitude;

    @Column(name = "booking_date")
    private LocalDate bookingDate;

    @Column(name = "slot_start_time")
    private LocalTime slotStartTime;

    @Column(name = "slot_end_time")
    private LocalTime slotEndTime;

    @Column(name = "detergent_preference", length = 80)
    private String detergentPreference;

    @Column(name = "detergent_quantity")
    private Integer detergentQuantity;

    @Column(name = "fabric_conditioner_preference", length = 80)
    private String fabricConditionerPreference;

    @Column(name = "conditioner_quantity")
    private Integer conditionerQuantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "load_size", length = 20)
    private LoadSize loadSize;

    @Column(name = "estimated_weight_kg", precision = 7, scale = 2)
    private BigDecimal estimatedWeightKg;

    @Column(name = "actual_weight_kg", precision = 7, scale = 2)
    private BigDecimal actualWeightKg;

    @Column(name = "final_price", precision = 10, scale = 2)
    private BigDecimal finalPrice;

    @Column(name = "price_confirmed_at")
    private LocalDateTime priceConfirmedAt;

    @Builder.Default
    @Column(name = "price_confirmed_by_customer", nullable = false)
    private boolean priceConfirmedByCustomer = false;

    @Column(name = "price_confirmation_deadline")
    private LocalDateTime priceConfirmationDeadline;

    @Column(name = "special_instructions", length = 500)
    private String specialInstructions;

    @Column(name = "service_price", precision = 10, scale = 2)
    private BigDecimal servicePrice;

    @Column(name = "supplies_price", precision = 10, scale = 2)
    private BigDecimal suppliesPrice;

    @Column(name = "delivery_price", precision = 10, scale = 2)
    private BigDecimal deliveryPrice;

    @Column(name = "rush_price", precision = 10, scale = 2)
    private BigDecimal rushPrice;

    @Column(name = "total_price", precision = 10, scale = 2)
    private BigDecimal totalPrice;

    @Builder.Default
    @Column(name = "is_paid", nullable = false)
    private boolean isPaid = false;

    @Column(name = "payment_method", length = 30)
    private String paymentMethod;

    @Convert(converter = JobOrderStatusConverter.class)
    @Column(name = "status", nullable = false, length = 40)
    private JobOrderStatus status;

    @Column(name = "service_name", length = 100)
    private String serviceName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_driver_id")
    private User assignedDriver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_pickup_driver_id")
    private User assignedPickupDriver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_delivery_driver_id")
    private User assignedDeliveryDriver;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "pickup_confirmed_at")
    private LocalDateTime pickupConfirmedAt;

    @Column(name = "laundry_collected_at")
    private LocalDateTime laundryCollectedAt;

    @Column(name = "arrived_at_branch_at")
    private LocalDateTime arrivedAtBranchAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @Builder.Default
    @Column(name = "cod_collected", nullable = false)
    private boolean codCollected = false;

    @Column(name = "cod_collected_at")
    private LocalDateTime codCollectedAt;

    @Column(name = "delivery_failed_reason", length = 300)
    private String deliveryFailedReason;

    @Column(name = "driver_lat")
    private Double driverLat;

    @Column(name = "driver_lng")
    private Double driverLng;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = JobOrderStatus.PENDING;
        if (updatedAt == null) updatedAt = createdAt;

        if (serviceType == null) serviceType = ServiceType.DROP_OFF;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
