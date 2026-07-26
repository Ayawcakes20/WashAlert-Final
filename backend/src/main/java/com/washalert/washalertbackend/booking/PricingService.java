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
            String fabcon,
            BigDecimal distanceKm
    ) {
        BigDecimal servicePrice = calculateServicePrice(serviceName, weightKg);
        BigDecimal rushPrice = isRush ? new BigDecimal("150.00") : BigDecimal.ZERO;
        int loads = computeLoadCount(serviceName, weightKg);
        SuppliesBreakdown suppliesBreakdown = calculateSuppliesPriceWithBreakdown(detergent, fabcon, loads);
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

    private int computeLoadCount(String serviceName, BigDecimal weightKg) {
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
     * Dry-only and Dry-clean services (no washing cycle) must have no add-ons.
     * All other washing services cap add-on packs at the computed number of loads.
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

        // Cap add-on packs at the computed number of loads, as documented above. Supply price
        // is always computed from the load count (see calculateSuppliesPriceWithBreakdown),
        // never from the requested quantity — without this cap, a booking could request an
        // arbitrarily large quantity, draining that much inventory while only being charged
        // for the load-based amount.
        int computedLoads = computeLoadCount(serviceName, weightKg);
        if (!isNoSupply(detergent) && detQty > computedLoads) {
            throw new IllegalArgumentException(
                    "Detergent quantity cannot exceed " + computedLoads + " pack(s) for this load.");
        }
        if (!isNoSupply(fabcon) && conQty > computedLoads) {
            throw new IllegalArgumentException(
                    "Fabric conditioner quantity cannot exceed " + computedLoads + " pack(s) for this load.");
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

    private SuppliesBreakdown calculateSuppliesPriceWithBreakdown(String detergent, String fabcon, int loadCount) {
        int effectiveLoads = loadCount <= 0 ? 1 : loadCount;

        BigDecimal detergentPricePerLoad = BigDecimal.ZERO;
        String detergentLabel = "";

        if (detergent != null) {
            String d = detergent.toLowerCase(Locale.ROOT);
            if (d.contains("surf")) {
                detergentPricePerLoad = new BigDecimal("25.00");
                detergentLabel = "Surf Detergent";
            } else if (d.contains("ariel")) {
                detergentPricePerLoad = new BigDecimal("30.00");
                detergentLabel = "Ariel Detergent";
            }
        }

        BigDecimal fabconPricePerLoad = BigDecimal.ZERO;
        String fabconLabel = "";

        if (fabcon != null) {
            String f = fabcon.toLowerCase(Locale.ROOT);
            if (f.contains("charm")) {
                fabconPricePerLoad = new BigDecimal("15.00");
                fabconLabel = "Charm Fabric Conditioner";
            } else if (f.contains("downy")) {
                fabconPricePerLoad = new BigDecimal("25.00");
                fabconLabel = "Downy Fabric Conditioner";
            }
        }

        BigDecimal detergentTotal = detergentPricePerLoad.multiply(BigDecimal.valueOf(effectiveLoads));
        BigDecimal fabconTotal = fabconPricePerLoad.multiply(BigDecimal.valueOf(effectiveLoads));

        String detergentDesc = "";
        if (!detergentLabel.isEmpty()) {
            if (effectiveLoads > 1) {
                detergentDesc = detergentLabel + " x" + effectiveLoads + " - ₱" + detergentTotal.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
            } else {
                detergentDesc = detergentLabel + " - ₱" + detergentTotal.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
            }
        }

        String fabconDesc = "";
        if (!fabconLabel.isEmpty()) {
            if (effectiveLoads > 1) {
                fabconDesc = fabconLabel + " x" + effectiveLoads + " - ₱" + fabconTotal.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
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

    private BigDecimal calculateSuppliesPrice(String detergent, String fabcon) {
        return calculateSuppliesPriceWithBreakdown(detergent, fabcon, 1).total();
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
