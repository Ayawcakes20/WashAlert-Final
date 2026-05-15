package com.washalert.washalertbackend.orders.dto;

import com.washalert.washalertbackend.orders.JobOrder;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.LoadSize;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.payment.PaymentStatus;
import com.washalert.washalertbackend.user.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobOrderResponse {
    private Long id;
    private String trackingNumber;
    private String customerName;
    private String branch;
    private JobOrderStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private ServiceType serviceType;
    private LocalDate bookingDate;
    private LocalTime slotStartTime;
    private LocalTime slotEndTime;
    private String detergentPreference;
    private Integer detergentQuantity;
    private String fabricConditionerPreference;
    private Integer conditionerQuantity;
    private String serviceName;
    private LoadSize loadSize;
    private BigDecimal estimatedWeightKg;
    private String specialInstructions;
    private String laundryType;
    private String customerPhone;
    private String customerEmail;
    private String deliveryAddress;
    private BigDecimal servicePrice;
    private BigDecimal suppliesPrice;
    private BigDecimal deliveryPrice;
    private BigDecimal rushPrice;
    private BigDecimal systemFee;
    private BigDecimal extraWeightCost;
    private String detergentBreakdown;
    private String fabricConditionerBreakdown;
    private BigDecimal totalPrice;
    private boolean isPaid;
    private String paymentMethod;
    private PaymentStatus paymentStatus;
    private Double deliveryLatitude;
    private Double deliveryLongitude;
    private String deliveryUnitFloor;
    private String deliveryContactName;
    private String deliveryContactPhone;
    private Double branchLatitude;
    private Double branchLongitude;
    private BigDecimal actualWeightKg;
    private BigDecimal finalPrice;
    private LocalDateTime priceConfirmationDeadline;
    private LocalDateTime priceConfirmedAt;
    private boolean priceConfirmedByCustomer;
    private Long assignedDriverId;
    private String assignedDriverName;
    private String assignedDriverPhone;
    private String assignedDriverPhotoUrl;
    private Long assignedPickupDriverId;
    private String assignedPickupDriverName;
    private Long assignedDeliveryDriverId;
    private String assignedDeliveryDriverName;
    private LocalDateTime assignedAt;
    private LocalDateTime pickupConfirmedAt;
    private LocalDateTime laundryCollectedAt;
    private LocalDateTime arrivedAtBranchAt;
    private LocalDateTime deliveredAt;
    private boolean codCollected;
    private LocalDateTime codCollectedAt;
    private String deliveryFailedReason;
    private Double driverLat;
    private Double driverLng;
    private String createdByName;
    private String assignedByName;

    public static JobOrderResponse from(JobOrder jo, PaymentStatus effectivePaymentStatus) {
        String customerName = jo.getCustomerName() != null ? jo.getCustomerName().trim() : "Customer";
        String contactName = (jo.getDeliveryContactName() != null && !jo.getDeliveryContactName().isBlank())
                ? jo.getDeliveryContactName().trim()
                : customerName;
        String contactPhone = (jo.getDeliveryContactPhone() != null && !jo.getDeliveryContactPhone().isBlank())
                ? jo.getDeliveryContactPhone().trim()
                : (jo.getCustomerPhone() != null ? jo.getCustomerPhone().trim() : "");

        User activeDriver = jo.getAssignedDriver();
        if (activeDriver == null) {
            if (jo.getStatus() == JobOrderStatus.ASSIGNED_FOR_PICKUP ||
                jo.getStatus() == JobOrderStatus.EN_ROUTE_TO_CUSTOMER ||
                jo.getStatus() == JobOrderStatus.LAUNDRY_COLLECTED ||
                jo.getStatus() == JobOrderStatus.EN_ROUTE_TO_BRANCH) {
                activeDriver = jo.getAssignedPickupDriver();
            } else if (jo.getStatus() == JobOrderStatus.ASSIGNED_FOR_DELIVERY ||
                       jo.getStatus() == JobOrderStatus.OUT_FOR_DELIVERY) {
                activeDriver = jo.getAssignedDeliveryDriver();
            }
        }

        String detergentBreakdown = getDetergentBreakdown(jo.getDetergentPreference());
        String fabricConditionerBreakdown = getFabricConditionerBreakdown(jo.getFabricConditionerPreference());
        BigDecimal systemFee = jo.getServicePrice() != null
                ? jo.getServicePrice().multiply(new BigDecimal("0.02")).setScale(2, java.math.RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        String laundryType = extractLaundryType(jo.getSpecialInstructions());

        return JobOrderResponse.builder()
                .id(jo.getId())
                .trackingNumber(jo.getTrackingNumber())
                .customerName(customerName)
                .branch(jo.getBranch())
                .status(jo.getStatus())
                .createdAt(jo.getCreatedAt())
                .updatedAt(jo.getUpdatedAt())
                .serviceType(jo.getServiceType())
                .bookingDate(jo.getBookingDate())
                .slotStartTime(jo.getSlotStartTime())
                .slotEndTime(jo.getSlotEndTime())
                .detergentPreference(jo.getDetergentPreference())
                .detergentQuantity(jo.getDetergentQuantity())
                .fabricConditionerPreference(jo.getFabricConditionerPreference())
                .conditionerQuantity(jo.getConditionerQuantity())
                .serviceName(jo.getServiceName())
                .loadSize(jo.getLoadSize())
                .estimatedWeightKg(jo.getEstimatedWeightKg())
                .specialInstructions(jo.getSpecialInstructions())
                .laundryType(laundryType)
                .customerPhone(jo.getCustomerPhone())
                .customerEmail(jo.getCustomerEmail())
                .deliveryAddress(jo.getDeliveryAddress())
                .servicePrice(jo.getServicePrice())
                .suppliesPrice(jo.getSuppliesPrice())
                .deliveryPrice(jo.getDeliveryPrice())
                .rushPrice(jo.getRushPrice())
                .systemFee(systemFee)
                .extraWeightCost(BigDecimal.ZERO)
                .detergentBreakdown(detergentBreakdown)
                .fabricConditionerBreakdown(fabricConditionerBreakdown)
                .totalPrice(jo.getTotalPrice())
                .isPaid(jo.isPaid())
                .paymentMethod(jo.getPaymentMethod())
                .paymentStatus(effectivePaymentStatus)
                .deliveryLatitude(jo.getDeliveryLatitude())
                .deliveryLongitude(jo.getDeliveryLongitude())
                .deliveryUnitFloor(jo.getDeliveryUnitFloor())
                .deliveryContactName(jo.getDeliveryContactName())
                .deliveryContactPhone(jo.getDeliveryContactPhone())
                .branchLatitude(jo.getBranchLatitude())
                .branchLongitude(jo.getBranchLongitude())
                .actualWeightKg(jo.getActualWeightKg())
                .finalPrice(jo.getFinalPrice())
                .priceConfirmedAt(jo.getPriceConfirmedAt())
                .priceConfirmedByCustomer(jo.isPriceConfirmedByCustomer())
                .priceConfirmationDeadline(jo.getPriceConfirmationDeadline())
                .assignedDriverId(activeDriver != null ? activeDriver.getId() : null)
                .assignedDriverName(activeDriver != null ? activeDriver.getFullName() : null)
                .assignedDriverPhone(activeDriver != null ? activeDriver.getMobileNumber() : null)
                .assignedDriverPhotoUrl(activeDriver != null ? activeDriver.getProfileImageUrl() : null)
                .assignedPickupDriverId(jo.getAssignedPickupDriver() != null ? jo.getAssignedPickupDriver().getId() : null)
                .assignedPickupDriverName(jo.getAssignedPickupDriver() != null ? jo.getAssignedPickupDriver().getFullName() : null)
                .assignedDeliveryDriverId(jo.getAssignedDeliveryDriver() != null ? jo.getAssignedDeliveryDriver().getId() : null)
                .assignedDeliveryDriverName(jo.getAssignedDeliveryDriver() != null ? jo.getAssignedDeliveryDriver().getFullName() : null)
                .assignedAt(jo.getAssignedAt())
                .pickupConfirmedAt(jo.getPickupConfirmedAt())
                .laundryCollectedAt(jo.getLaundryCollectedAt())
                .arrivedAtBranchAt(jo.getArrivedAtBranchAt())
                .deliveredAt(jo.getDeliveredAt())
                .codCollected(jo.isCodCollected())
                .codCollectedAt(jo.getCodCollectedAt())
                .deliveryFailedReason(jo.getDeliveryFailedReason())
                .driverLat(jo.getDriverLat())
                .driverLng(jo.getDriverLng())
                .createdByName(jo.getCreatedBy() != null ? jo.getCreatedBy().getFullName() : "System")
                .assignedByName(jo.getAssignedDriver() != null ? "Staff" : null)
                .build();
    }

    private static String extractLaundryType(String specialInstructions) {
        if (specialInstructions == null) return null;
        if (specialInstructions.startsWith("[Type:")) {
            int end = specialInstructions.indexOf(']');
            if (end > 6) return specialInstructions.substring(6, end).trim();
        }
        return null;
    }

    private static String getDetergentBreakdown(String detergent) {
        if (detergent == null || detergent.isBlank()) return "None selected";
        String d = detergent.toLowerCase();
        if (d.contains("surf")) return "Surf Detergent - ₱25.00";
        if (d.contains("ariel")) return "Ariel Detergent - ₱30.00";
        return detergent;
    }

    private static String getFabricConditionerBreakdown(String fabcon) {
        if (fabcon == null || fabcon.isBlank()) return "None selected";
        String f = fabcon.toLowerCase();
        if (f.contains("charm")) return "Charm Fabric Conditioner - ₱15.00";
        if (f.contains("downy")) return "Downy Fabric Conditioner - ₱25.00";
        return fabcon;
    }
}