// ─── WashAlert Pricing Utilities ──────────────────────────────────────────────
// Centralized pricing computation used by the Finalize Weight & Receipt screen.
// All monetary values are in Philippine Peso (₱).

export type LoadType = 'PURE_CLOTHES' | 'WITH_TOWELS';

export interface OrderForPricing {
  serviceName?: string;
  detergent?: string;
  detergentQuantity?: number;
  conditioner?: string;
  conditionerQuantity?: number;
  rushPrice?: number;
  serviceType: 'DROP_OFF' | 'PICKUP_DELIVERY';
}

export interface PricingResult {
  numberOfLoads: number;
  pricePerLoad: number;
  serviceTotal: number;
  madnessFee: number;
  madnessKg: number;
  detPPP: number;
  detQty: number;
  detCost: number;
  conPPP: number;
  conQty: number;
  conCost: number;
  rushFee: number;
  deliveryFee: number;
  pickupFee: number;
  convenienceFee: number;
  grandTotal: number;
  maxKgPerLoad: number;
  isHandwash: boolean;
  isRush: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Max kg per load based on load composition */
export const getMaxKgPerLoad = (lt: LoadType): number => (lt === 'PURE_CLOTHES' ? 8 : 7);

/** Detergent price per pack */
export const getDetergentPricePerPack = (name?: string): number => {
  if (!name || name.toLowerCase() === 'none') return 0;
  // Ariel = premium ₱30, Surf = basic ₱25
  return name.toLowerCase().includes('ariel') ? 30 : 25;
};

/** Conditioner/fabric softener price per pack */
export const getConditionerPricePerPack = (name?: string): number => {
  if (!name || name.toLowerCase() === 'none') return 0;
  // Downy = premium ₱25, Charm Fabcon = basic ₱15
  return name.toLowerCase().includes('downy') ? 25 : 15;
};

// ── Core pricing engine ────────────────────────────────────────────────────────

/**
 * Compute full order pricing given actual weighed kg and load type.
 *
 * Load-count formula (per panel requirement):
 *   numberOfLoads = Math.ceil(actualKg / maxKgPerLoad)
 *   where maxKgPerLoad = 8 (pure clothes) or 7 (with towels/beddings)
 *
 * Madness surcharge: ₱50 per kg that the actual weight exceeds the
 * base capacity (numberOfLoads × maxKgPerLoad). With the ceil formula
 * this is typically 0 but covers edge-case manual overrides.
 */
export const computeOrderPricing = (
  order: OrderForPricing,
  actualKg: number,
  lt: LoadType,
  deliveryFee: number,
): PricingResult => {
  const name = order.serviceName?.toLowerCase() ?? '';
  const maxKgPerLoad = getMaxKgPerLoad(lt);
  const isHandwash = name.includes('handwash');

  let numberOfLoads = 1;
  let pricePerLoad = 0;
  let serviceTotal = 0;

  if (isHandwash) {
    // Handwash: ₱150/kg for 1–3 kg, ₱90/kg for 3 kg+
    pricePerLoad = actualKg <= 3 ? 150 : 90;
    serviceTotal = pricePerLoad * actualKg;
    numberOfLoads = 1;
  } else {
    // ── FIX: use maxKgPerLoad (8 or 7) as divisor, NOT machine absolute max ──
    numberOfLoads = Math.ceil(actualKg / maxKgPerLoad);

    // Service pricing per load
    if (name.includes('ecowash')) {
      pricePerLoad = 220; // Ecowash Full Service (5 kg)
    } else if (name.includes('dry') && !name.includes('full')) {
      pricePerLoad = 90; // Dry Only (7 kg)
    } else if (name.includes('wash only') || (name.includes('wash') && !name.includes('full') && !name.includes('eco'))) {
      pricePerLoad = 80; // Wash Only (7 kg)
    } else if (name.includes('basic full')) {
      // Basic Full Service: ₱245/load for pure clothes (8 kg), ₱240 for towels (7 kg)
      pricePerLoad = lt === 'PURE_CLOTHES' ? 245 : 240;
    } else if (name.includes('premium full')) {
      // Premium Full Service: ₱275/load for pure clothes (8 kg), ₱270 for towels (7 kg)
      pricePerLoad = lt === 'PURE_CLOTHES' ? 275 : 270;
    } else {
      // Default fallback to Basic Full Service pricing
      pricePerLoad = lt === 'PURE_CLOTHES' ? 245 : 240;
    }

    serviceTotal = pricePerLoad * numberOfLoads;
  }

  // Madness surcharge — ₱50/kg over standard base capacity per load
  // (covers edge cases where weight slightly exceeds load boundary)
  const baseTotalCapacity = numberOfLoads * maxKgPerLoad;
  const madnessKg = Math.max(0, actualKg - baseTotalCapacity);
  const madnessFee = Math.round(madnessKg * 50);

  // Detergent — customer's chosen pack count × price per pack (NOT multiplied by loads)
  const detPPP = getDetergentPricePerPack(order.detergent);
  const detQty = order.detergentQuantity ?? 0;
  const detCost = detPPP * detQty;

  // Conditioner — same logic
  const conPPP = getConditionerPricePerPack(order.conditioner);
  const conQty = order.conditionerQuantity ?? 0;
  const conCost = conPPP * conQty;

  // Rush fee — ₱150 per load if customer booked rush
  const isRush = (order.rushPrice ?? 0) > 0;
  const rushFee = isRush ? 150 * numberOfLoads : 0;

  // Pickup fee — for pickup & delivery service (not included in service names that already bundle it)
  const pickupFee = order.serviceType === 'PICKUP_DELIVERY' && !name.includes('full') ? 25 : 0;

  // Convenience fee — fixed online booking fee
  const convenienceFee = 20;

  const grandTotal =
    serviceTotal +
    madnessFee +
    detCost +
    conCost +
    rushFee +
    deliveryFee +
    pickupFee +
    convenienceFee;

  return {
    numberOfLoads,
    pricePerLoad,
    serviceTotal,
    madnessFee,
    madnessKg,
    detPPP,
    detQty,
    detCost,
    conPPP,
    conQty,
    conCost,
    rushFee,
    deliveryFee,
    pickupFee,
    convenienceFee,
    grandTotal,
    maxKgPerLoad,
    isHandwash,
    isRush,
  };
};
