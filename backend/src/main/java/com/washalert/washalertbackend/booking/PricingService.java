package com.washalert.washalertbackend.booking;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

@Service
public class PricingService {

    public static record PriceEstimation(
            BigDecimal servicePrice,
            BigDecimal rushPrice,
            BigDecimal suppliesPrice,
            BigDecimal deliveryPrice,
            BigDecimal systemFee,
            BigDecimal extraWeightCost,
            String detergentBreakdown,
            String fabricConditionerBreakdown,
            BigDecimal totalPrice,
            int numberOfLoads
    ) {}

    public PriceEstimation estimate(
            String branch,
            String serviceName,
            BigDecimal weightKg,
            boolean isRush,
            String detergent,
            int detQty,
            String fabcon,
            int conQty,
            BigDecimal distanceKm
    ) {
        BigDecimal servicePrice = calculateServicePrice(serviceName, weightKg);
        BigDecimal rushPrice = isRush ? new BigDecimal("150.00") : BigDecimal.ZERO;
        int loads = computeLoadCount(serviceName, weightKg);
        // Priced from the actual requested quantity, not the load count - matches how both
        // the mobile and web clients already compute the customer-facing price preview
        // (pricingUtils.js / pricingUtils.ts), and lets a customer buy more sachets than the
        // load count would imply, capped only by branch inventory (see validateAddonQuantities).
        SuppliesBreakdown suppliesBreakdown = calculateSuppliesPriceWithBreakdown(detergent, detQty, fabcon, conQty);
        BigDecimal deliveryPrice = calculateDeliveryPrice(distanceKm);

        BigDecimal subtotal = servicePrice.add(rushPrice).add(suppliesBreakdown.total()).add(deliveryPrice);
        BigDecimal systemFee = subtotal.multiply(new BigDecimal("0.02")).setScale(2, java.math.RoundingMode.HALF_UP);

        BigDecimal extraWeightCost = calculateExtraWeightCost(serviceName, weightKg);
        BigDecimal total = subtotal.add(systemFee).add(extraWeightCost);

        return new PriceEstimation(
                servicePrice,
                rushPrice,
                suppliesBreakdown.total(),
                deliveryPrice,
                systemFee,
                extraWeightCost,
                suppliesBreakdown.detergentBreakdown(),
                suppliesBreakdown.fabricConditionerBreakdown(),
                total,
                loads
        );
    }

    private record SuppliesBreakdown(
            BigDecimal total,
            String detergentBreakdown,
            String fabricConditionerBreakdown
    ) {}

    // Public so callers (e.g. BookingService) can determine a fallback add-on quantity before
    // supplies pricing needs it, without duplicating this logic.
    public int computeLoadCount(String serviceName, BigDecimal weightKg) {
        if (serviceName == null) return 1;
        String name = serviceName.toLowerCase(Locale.ROOT);
        if (name.contains("double")) return 2;
        if (name.contains("ecowash")) {
            // 5kg per load
            if (weightKg == null || weightKg.compareTo(BigDecimal.ZERO) <= 0) return 1;
            return (int) Math.max(1, Math.ceil(weightKg.doubleValue() / 5.0));
        }
        if (name.contains("full") || name.contains("handwash")) {
            // 8kg per load
            if (weightKg == null || weightKg.compareTo(BigDecimal.ZERO) <= 0) return 1;
            return (int) Math.max(1, Math.ceil(weightKg.doubleValue() / 8.0));
        }
        return 1;
    }

    /**
     * Validates add-on quantities against service-level rules.
     * <p>
     * Dry-only and Dry-clean services (no washing cycle) must have no add-ons. Quantity is no
     * longer capped at the computed load count here — supplies are now priced per actual
     * quantity (see calculateSuppliesPriceWithBreakdown), so requesting more than the load
     * count is a legitimate, correctly-billed choice. The real ceiling is branch inventory,
     * enforced separately by InventoryService#validateSuppliesForBooking.
     *
     * @throws IllegalArgumentException with a user-facing message on violation
     */
    public void validateAddonQuantities(
            String serviceName,
            BigDecimal weightKg,
            String detergent,
            int detQty,
            String fabcon,
            int conQty) {

        if (serviceName == null) return;
        String name = serviceName.toLowerCase(Locale.ROOT);

        if (isDryOnlyService(name)) {
            boolean detActive = !isNoSupply(detergent);
            boolean fabActive = !isNoSupply(fabcon);
            if (detActive || fabActive) {
                throw new IllegalArgumentException("Add-ons are not needed for Dry-only service.");
            }
            return;
        }

        if (!isNoSupply(detergent) && detQty < 0) {
            throw new IllegalArgumentException("Detergent quantity cannot be negative.");
        }
        if (!isNoSupply(fabcon) && conQty < 0) {
            throw new IllegalArgumentException("Fabric conditioner quantity cannot be negative.");
        }
    }

    /** Returns true when the supply value means "no supply selected". Handles null, blank, "none", and "customer provided". */
    static boolean isNoSupply(String s) {
        if (s == null || s.isBlank()) return true;
        String lower = s.trim().toLowerCase(Locale.ROOT);
        return lower.equals("none") || lower.equals("customer provided");
    }

    /** Returns true when the supply is a real shop-provided item (not "none" or "customer provided"). */
    public boolean isShopSupply(String s) {
        return !isNoSupply(s);
    }

    // Mirrors the dry-only price branch in calculateServicePrice():
    // a "dry" service that is not a wash, full-service, or handwash variant.
    // Also covers "Dry Clean" (quote-based) which similarly uses no consumables.
    private boolean isDryOnlyService(String lowerName) {
        return lowerName.contains("dry")
                && !lowerName.contains("wash")
                && !lowerName.contains("full")
                && !lowerName.contains("hand");
    }

    private BigDecimal calculateServicePrice(String serviceName, BigDecimal weight) {
        if (serviceName == null) return BigDecimal.ZERO;
        String name = serviceName.toLowerCase(Locale.ROOT);

        // Dry cleaning requires a manual staff quote — return zero until staff sets it
        if (name.contains("dry clean")) {
            return BigDecimal.ZERO;
        }

        // Standard 7kg Wash/Dry
        if (name.contains("wash") && !name.contains("dry") && !name.contains("full") && !name.contains("hand")) {
            return new BigDecimal("80.00");
        }
        if (name.contains("dry") && !name.contains("wash") && !name.contains("full") && !name.contains("hand")) {
            return new BigDecimal("90.00");
        }

        // Full Services
        if (name.contains("ecowash")) {
            return new BigDecimal("220.00"); // 5kg
        }
        if (name.contains("double basic full")) {
            return new BigDecimal("295.00");
        }
        if (name.contains("double full")) {
            return new BigDecimal("325.00");
        }
        if (name.contains("basic full")) {
            if (weight.compareTo(new BigDecimal("7.0")) <= 0) return new BigDecimal("240.00");
            return new BigDecimal("245.00"); // base rate only; per-kg surcharge above 8kg handled by calculateExtraWeightCost
        }
        if (name.contains("premium full")) {
            if (weight.compareTo(new BigDecimal("7.0")) <= 0) return new BigDecimal("270.00");
            return new BigDecimal("275.00"); // up to 8kg
        }

        // Handwash
        if (name.contains("handwash")) {
            if (weight.compareTo(new BigDecimal("3.0")) <= 0) {
                return weight.multiply(new BigDecimal("150.00"));
            } else {
                return weight.multiply(new BigDecimal("90.00"));
            }
        }

        return BigDecimal.ZERO;
    }

    private SuppliesBreakdown calculateSuppliesPriceWithBreakdown(String detergent, int detQty, String fabcon, int conQty) {
        int effectiveDetQty = Math.max(0, detQty);
        int effectiveConQty = Math.max(0, conQty);

        BigDecimal detergentPricePerSachet = BigDecimal.ZERO;
        String detergentLabel = "";

        if (detergent != null) {
            String d = detergent.toLowerCase(Locale.ROOT);
            if (d.contains("surf")) {
                detergentPricePerSachet = new BigDecimal("25.00");
                detergentLabel = "Surf Detergent";
            } else if (d.contains("ariel")) {
                detergentPricePerSachet = new BigDecimal("30.00");
                detergentLabel = "Ariel Detergent";
            }
        }

        BigDecimal fabconPricePerSachet = BigDecimal.ZERO;
        String fabconLabel = "";

        if (fabcon != null) {
            String f = fabcon.toLowerCase(Locale.ROOT);
            if (f.contains("charm")) {
                fabconPricePerSachet = new BigDecimal("15.00");
                fabconLabel = "Charm Fabric Conditioner";
            } else if (f.contains("downy")) {
                fabconPricePerSachet = new BigDecimal("25.00");
                fabconLabel = "Downy Fabric Conditioner";
            }
        }

        BigDecimal detergentTotal = detergentPricePerSachet.multiply(BigDecimal.valueOf(effectiveDetQty));
        BigDecimal fabconTotal = fabconPricePerSachet.multiply(BigDecimal.valueOf(effectiveConQty));

        String detergentDesc = "";
        if (!detergentLabel.isEmpty()) {
            if (effectiveDetQty > 1) {
                detergentDesc = detergentLabel + " x" + effectiveDetQty + " - ₱" + detergentTotal.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
            } else {
                detergentDesc = detergentLabel + " - ₱" + detergentTotal.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
            }
        }

        String fabconDesc = "";
        if (!fabconLabel.isEmpty()) {
            if (effectiveConQty > 1) {
                fabconDesc = fabconLabel + " x" + effectiveConQty + " - ₱" + fabconTotal.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
            } else {
                fabconDesc = fabconLabel + " - ₱" + fabconTotal.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
            }
        }

        BigDecimal total = detergentTotal.add(fabconTotal);
        return new SuppliesBreakdown(
                total,
                detergentDesc.isEmpty() ? "None" : detergentDesc,
                fabconDesc.isEmpty() ? "None" : fabconDesc
        );
    }

    private BigDecimal calculateDeliveryPrice(BigDecimal distanceKm) {
        if (distanceKm == null || distanceKm.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;

        // 3km or less is free for all branches
        if (distanceKm.compareTo(new BigDecimal("3.0")) <= 0) {
            return BigDecimal.ZERO;
        }

        // 3.1km -> 40, 4.0km -> 50, formula: 40 + (ceil(distance) - 3) * 10
        double dist = distanceKm.doubleValue();
        int extraKm = (int) Math.ceil(dist) - 3;

        return new BigDecimal("40.00").add(new BigDecimal(String.valueOf(extraKm * 10)));
    }

    private BigDecimal calculateExtraWeightCost(String serviceName, BigDecimal weightKg) {
        if (serviceName == null || weightKg == null) return BigDecimal.ZERO;

        String name = serviceName.toLowerCase(Locale.ROOT);

        // For full service with weight > 8kg, calculate extra weight cost
        if ((name.contains("basic full") || name.contains("premium full")) &&
            weightKg.compareTo(new BigDecimal("8.0")) > 0) {
            BigDecimal extraKg = weightKg.subtract(new BigDecimal("8.0"));
            return extraKg.multiply(new BigDecimal("50.00"));
        }

        return BigDecimal.ZERO;
    }
}
