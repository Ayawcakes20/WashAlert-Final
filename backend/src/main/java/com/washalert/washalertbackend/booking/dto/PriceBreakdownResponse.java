package com.washalert.washalertbackend.booking.dto;

import java.math.BigDecimal;

public record PriceBreakdownResponse(
        BigDecimal baseServicePrice,
        BigDecimal extraWeightCost,
        BigDecimal rushPrice,
        String detergentItem,
        BigDecimal detergentPrice,
        String fabricConditionerItem,
        BigDecimal fabricConditionerPrice,
        BigDecimal suppliesTotal,
        BigDecimal deliveryPrice,
        BigDecimal systemFee,
        BigDecimal totalPrice,
        String estimatedWeightNote
) {}
