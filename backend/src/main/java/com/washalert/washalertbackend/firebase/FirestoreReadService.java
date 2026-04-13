package com.washalert.washalertbackend.firebase;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import com.washalert.washalertbackend.delivery.DeliveryStatus;
import com.washalert.washalertbackend.delivery.dto.DeliveryResponse;
import com.washalert.washalertbackend.inventory.dto.InventoryItemResponse;
import com.washalert.washalertbackend.machines.MachineStatus;
import com.washalert.washalertbackend.machines.MachineType;
import com.washalert.washalertbackend.machines.dto.MachineResponse;
import com.washalert.washalertbackend.orders.JobOrderStatus;
import com.washalert.washalertbackend.orders.LoadSize;
import com.washalert.washalertbackend.orders.ServiceType;
import com.washalert.washalertbackend.orders.dto.JobOrderResponse;
import com.washalert.washalertbackend.payment.PaymentStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class FirestoreReadService {

    public record FirestoreUserRecord(
            Long id,
            String email,
            String fullName,
            String mobileNumber,
            String profileImageUrl,
            String role,
            String branch,
            Boolean enabled,
            Boolean mustChangePassword,
            String provider,
            LocalDateTime verifiedAt,
            LocalDateTime createdAt,
            String passwordHash
    ) {
    }

    private static final Logger log = LoggerFactory.getLogger(FirestoreReadService.class);

    private final Optional<Firestore> firestore;
    private final FirebaseProperties firebaseProperties;

    public FirestoreReadService(Optional<Firestore> firestore, FirebaseProperties firebaseProperties) {
        this.firestore = firestore;
        this.firebaseProperties = firebaseProperties;
    }

    public boolean isAvailable() {
        return firebaseProperties.enabled() && firestore.isPresent();
    }

    public List<MachineResponse> listMachines() {
        return listCollection("machines").stream()
                .map(this::toMachineResponse)
                .filter(item -> item != null)
                .toList();
    }

    public List<InventoryItemResponse> listInventoryItems() {
        return listCollection("inventory").stream()
                .map(this::toInventoryItemResponse)
                .filter(item -> item != null)
                .toList();
    }

    public List<JobOrderResponse> listOrders() {
        return listCollection("orders").stream()
                .map(this::toJobOrderResponse)
                .filter(item -> item != null)
                .toList();
    }

    public Optional<JobOrderResponse> findOrderByTracking(String trackingNumber) {
        if (trackingNumber == null) return Optional.empty();
        String normalized = trackingNumber.trim().toUpperCase();
        return listOrders().stream()
                .filter(o -> o.trackingNumber() != null && o.trackingNumber().equalsIgnoreCase(normalized))
                .findFirst();
    }

    public Optional<JobOrderResponse> findOrderById(Long id) {
        if (id == null) return Optional.empty();
        return listOrders().stream()
                .filter(o -> o.id() != null && o.id().equals(id))
                .findFirst();
    }

    public List<DeliveryResponse> listDeliveries() {
        return listCollection("deliveries").stream()
                .map(this::toDeliveryResponse)
                .filter(item -> item != null)
                .toList();
    }

    public Optional<DeliveryResponse> findDeliveryByTracking(String trackingNumber) {
        if (trackingNumber == null) return Optional.empty();
        String normalized = trackingNumber.trim().toUpperCase();
        return listDeliveries().stream()
                .filter(d -> d.trackingNumber() != null && d.trackingNumber().equalsIgnoreCase(normalized))
                .findFirst();
    }

    public Optional<DeliveryResponse> findDeliveryById(Long id) {
        if (id == null) return Optional.empty();
        return listDeliveries().stream()
                .filter(d -> d.id() != null && d.id().equals(id))
                .findFirst();
    }

    public List<FirestoreUserRecord> listUsers() {
        return listCollection("users").stream()
                .map(this::toUserRecord)
                .filter(item -> item != null)
                .toList();
    }

    public Optional<FirestoreUserRecord> findUserById(Long id) {
        if (id == null) return Optional.empty();
        return listUsers().stream()
                .filter(u -> u.id() != null && u.id().equals(id))
                .findFirst();
    }

    public Optional<FirestoreUserRecord> findUserByEmail(String email) {
        if (email == null || email.isBlank()) return Optional.empty();
        String normalized = email.trim().toLowerCase();
        return listUsers().stream()
                .filter(u -> u.email() != null && u.email().equalsIgnoreCase(normalized))
                .findFirst();
    }

    private List<Map<String, Object>> listCollection(String collection) {
        if (!isAvailable()) return List.of();
        try {
            QuerySnapshot snapshot = firestore.get().collection(collection).get().get();
            List<Map<String, Object>> results = new ArrayList<>();
            for (DocumentSnapshot doc : snapshot.getDocuments()) {
                Map<String, Object> data = doc.getData();
                if (data != null && !data.isEmpty()) {
                    results.add(data);
                }
            }
            return results;
        } catch (Exception ex) {
            log.warn("Firestore read failed for {}: {}", collection, ex.getMessage());
            return List.of();
        }
    }

    private MachineResponse toMachineResponse(Map<String, Object> data) {
        String machineId = asString(data.get("machineId"));
        MachineType type = asEnum(data.get("type"), MachineType.class);
        MachineStatus status = asEnum(data.get("status"), MachineStatus.class);
        if (machineId == null || type == null || status == null) return null;

        return new MachineResponse(
                asLong(data.get("id")),
                machineId,
                asString(data.get("branch")),
                type,
                status,
                asLocalDateTime(data.get("updatedAt"))
        );
    }

    private InventoryItemResponse toInventoryItemResponse(Map<String, Object> data) {
        String itemName = asString(data.get("itemName"));
        String branch = asString(data.get("branch"));
        String category = asString(data.get("category"));
        String unit = asString(data.get("unit"));
        if (itemName == null || branch == null || category == null || unit == null) return null;

        BigDecimal currentStock = defaultDecimal(asBigDecimal(data.get("currentStock")));
        BigDecimal reorderLevel = defaultDecimal(asBigDecimal(data.get("reorderLevel")));

        return new InventoryItemResponse(
                asLong(data.get("id")),
                branch,
                itemName,
                category,
                unit,
                currentStock,
                reorderLevel,
                currentStock.compareTo(reorderLevel) <= 0,
                asLocalDateTime(data.get("updatedAt"))
        );
    }

    private JobOrderResponse toJobOrderResponse(Map<String, Object> data) {
        String trackingNumber = asString(data.get("trackingNumber"));
        String customerName = asString(data.get("customerName"));
        JobOrderStatus status = asEnum(data.get("status"), JobOrderStatus.class);
        if (trackingNumber == null || customerName == null || status == null) return null;

        return new JobOrderResponse(
                asLong(data.get("id")),
                trackingNumber,
                customerName,
                asString(data.get("branch")),
                status,
                asLocalDateTime(data.get("createdAt")),
                asLocalDateTime(data.get("updatedAt")),
                asEnum(data.get("serviceType"), ServiceType.class),
                asLocalDate(data.get("bookingDate")),
                asLocalTime(data.get("slotStartTime")),
                asLocalTime(data.get("slotEndTime")),
                asString(data.get("detergentPreference")),
                asString(data.get("fabricConditionerPreference")),
                asEnum(data.get("loadSize"), LoadSize.class),
                asBigDecimal(data.get("estimatedWeightKg")),
                asString(data.get("specialInstructions")),
                asString(data.get("customerPhone")),
                asString(data.get("customerEmail")),
                asString(data.get("deliveryAddress")),
                asBigDecimal(data.get("servicePrice")),
                asBigDecimal(data.get("suppliesPrice")),
                asBigDecimal(data.get("deliveryPrice")),
                asBigDecimal(data.get("totalPrice")),
                asBoolean(data.get("isPaid")),
                asString(data.get("paymentMethod")),
                asEnum(data.get("paymentStatus"), PaymentStatus.class),
                asDouble(data.get("deliveryLatitude")),
                asDouble(data.get("deliveryLongitude")),
                asDouble(data.get("branchLatitude")),
                asDouble(data.get("branchLongitude"))
        );
    }

    private DeliveryResponse toDeliveryResponse(Map<String, Object> data) {
        String trackingNumber = asString(data.get("trackingNumber"));
        DeliveryStatus status = asEnum(data.get("status"), DeliveryStatus.class);
        if (trackingNumber == null || status == null) return null;

        return new DeliveryResponse(
                asLong(data.get("id")),
                trackingNumber,
                asString(data.get("branch")),
                asString(data.get("customerName")),
                asString(data.get("deliveryAddress")),
                asString(data.get("driverName")),
                asString(data.get("driverPhone")),
                asEnum(data.get("leg"), com.washalert.washalertbackend.delivery.DeliveryLeg.class),
                status,
                asDouble(data.get("currentLatitude")),
                asDouble(data.get("currentLongitude")),
                asLocalDateTime(data.get("estimatedArrivalAt")),
                asString(data.get("notes")),
                asLocalDateTime(data.get("updatedAt")),
                asDouble(data.get("branchLatitude")),
                asDouble(data.get("branchLongitude")),
                asDouble(data.get("deliveryLatitude")),
                asDouble(data.get("deliveryLongitude"))
        );
    }

    private FirestoreUserRecord toUserRecord(Map<String, Object> data) {
        String email = asString(data.get("email"));
        String fullName = asString(data.get("fullName"));
        String role = asString(data.get("role"));
        String provider = asString(data.get("provider"));
        if (email == null || fullName == null || role == null || provider == null) return null;

        return new FirestoreUserRecord(
                asLong(data.get("id")),
                email,
                fullName,
                asString(data.get("mobileNumber")),
                asString(data.get("profileImageUrl")),
                role,
                asString(data.get("branch")),
                asBoolean(data.get("enabled")),
                asBoolean(data.get("mustChangePassword")),
                provider,
                asLocalDateTime(data.get("verifiedAt")),
                asLocalDateTime(data.get("createdAt")),
                asString(data.get("passwordHash"))
        );
    }

    private String asString(Object value) {
        if (value == null) return null;
        String raw = String.valueOf(value).trim();
        return raw.isEmpty() ? null : raw;
    }

    private Long asLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private Double asDouble(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value).trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private Boolean asBoolean(Object value) {
        if (value == null) return null;
        if (value instanceof Boolean b) return b;
        String raw = String.valueOf(value).trim().toLowerCase();
        if ("true".equals(raw)) return true;
        if ("false".equals(raw)) return false;
        return null;
    }

    private BigDecimal asBigDecimal(Object value) {
        if (value == null) return null;
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(String.valueOf(value).trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private BigDecimal defaultDecimal(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private LocalDateTime asLocalDateTime(Object value) {
        if (value == null) return null;
        try {
            return LocalDateTime.parse(String.valueOf(value).trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private LocalDate asLocalDate(Object value) {
        if (value == null) return null;
        try {
            return LocalDate.parse(String.valueOf(value).trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private LocalTime asLocalTime(Object value) {
        if (value == null) return null;
        try {
            return LocalTime.parse(String.valueOf(value).trim());
        } catch (Exception ex) {
            return null;
        }
    }

    private <E extends Enum<E>> E asEnum(Object value, Class<E> type) {
        String raw = asString(value);
        if (raw == null) return null;
        try {
            return Enum.valueOf(type, raw);
        } catch (Exception ex) {
            return null;
        }
    }
}
