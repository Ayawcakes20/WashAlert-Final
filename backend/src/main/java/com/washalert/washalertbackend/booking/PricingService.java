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
            BigDecimal totalPrice
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
        BigDecimal suppliesPrice = calculateSuppliesPrice(detergent, fabcon);
        BigDecimal deliveryPrice = calculateDeliveryPrice(distanceKm);

        BigDecimal total = servicePrice.add(rushPrice).add(suppliesPrice).add(deliveryPrice);

        return new PriceEstimation(servicePrice, rushPrice, suppliesPrice, deliveryPrice, total);
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
            if (weight.compareTo(new BigDecimal("8.0")) > 0) {
                BigDecimal extra = weight.subtract(new BigDecimal("8.0")).max(BigDecimal.ZERO);
                return new BigDecimal("245.00").add(extra.multiply(new BigDecimal("50.00")));
            }
            if (weight.compareTo(new BigDecimal("7.0")) <= 0) return new BigDecimal("240.00");
            return new BigDecimal("245.00"); // up to 8kg
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

    private BigDecimal calculateSuppliesPrice(String detergent, String fabcon) {
        BigDecimal total = BigDecimal.ZERO;

        if (detergent != null) {
            String d = detergent.toLowerCase(Locale.ROOT);
            if (d.contains("surf")) total = total.add(new BigDecimal("25.00"));
            else if (d.contains("ariel")) total = total.add(new BigDecimal("30.00"));
        }

        if (fabcon != null) {
            String f = fabcon.toLowerCase(Locale.ROOT);
            if (f.contains("charm")) total = total.add(new BigDecimal("15.00"));
            else if (f.contains("downy")) total = total.add(new BigDecimal("25.00"));
        }

        return total;
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
}
