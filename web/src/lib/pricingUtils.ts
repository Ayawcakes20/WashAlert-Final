// ─── WashAlert Pricing Utilities ──────────────────────────────────────────────
// Centralized pricing computation used by the Finalize Weight & Receipt screen.
// All monetary values are in Philippine Peso (₱).

// Load types — BEDDINGS forces 5 kg/load regardless of service.
export type LoadType = 'PURE_CLOTHES' | 'WITH_TOWELS' | 'BEDDINGS';

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
  manualAdjustment: number;
  grandTotal: number;
  maxKgPerLoad: number;
  isHandwash: boolean;
  isRush: boolean;
  baseServiceLimit: number; // The effective kg capacity per load used for calculation
}

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Returns the effective kg capacity per load for a given service and load type.
 *
 * Rules (Triplets official pricing policy):
 *  - BEDDINGS        → always 5 kg/load, overrides the service capacity
 *  - Ecowash         → 5 kg/load
 *  - Handwash        → per-kg (return 1 as a sentinel; pricing handled separately)
 *  - Wash Only / Dry Only → 7 kg/load
 *  - Full Service 7kg variant → 7 kg/load
 *  - Full Service 8kg variant:
 *      * Pure Clothes → 8 kg/load
 *      * With Towels  → 7 kg/load
 *  - Default Full Service (unspecified kg):
 *      * Pure Clothes → 8 kg/load
 *      * With Towels  → 7 kg/load
 */
export const getBaseServiceLimit = (serviceName: string, lt: LoadType): number => {
  const name = serviceName.toLowerCase();

  // BEDDINGS always forces 5 kg/load regardless of selected service
  if (lt === 'BEDDINGS') return 5;

  // Ecowash is strictly 5 kg/load
  if (name.includes('ecowash')) return 5;

  // Handwash uses per-kg pricing — 1 is a sentinel value
  if (name.includes('handwash')) return 1;

  // Wash Only and Dry Only are strictly 7 kg/load
  if (name.includes('wash') && !name.includes('full')) return 7;
  if (name.includes('dry') && !name.includes('full')) return 7;

  // Explicit 7kg full service
  if (name.includes('7kg') || name.includes('7 kg')) return 7;

  // Explicit 8kg full service
  if (name.includes('8kg') || name.includes('8 kg')) {
    return lt === 'PURE_CLOTHES' ? 8 : 7;
  }

  // Default Full Service
  return lt === 'PURE_CLOTHES' ? 8 : 7;
};

/**
 * Returns true when the supply selection is customer-provided
 * (i.e., no system supply should be charged).
 */
export const isCustomerProvided = (name?: string): boolean => {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  return lower.includes('customer') || lower.includes('provided') || /\bown\b/.test(lower);
};

/**
 * Returns the price-per-pack for a detergent selection.
 * Returns ₱0 for "None" or any customer-provided selection.
 */
export const getDetergentPricePerPack = (name?: string): number => {
  if (!name) return 0;
  const lower = name.toLowerCase().trim();
  if (lower === 'none' || isCustomerProvided(lower)) return 0;
  return lower.includes('ariel') ? 30 : 25;
};

/**
 * Returns the price-per-pack for a fabric conditioner selection.
 * Returns ₱0 for "None" or any customer-provided selection.
 */
export const getConditionerPricePerPack = (name?: string): number => {
  if (!name) return 0;
  const lower = name.toLowerCase().trim();
  if (lower === 'none' || isCustomerProvided(lower)) return 0;
  return lower.includes('downy') ? 25 : 15;
};

// ── Core pricing engine ────────────────────────────────────────────────────────

/**
 * Compute full order pricing given actual weighed kg and load type.
 *
 * Load-count formula (fixed-capacity services):
 *   numberOfLoads = CEILING(actualKg / baseServiceLimit)
 *
 * Handwash pricing:
 *   1–3 kg: ₱150/kg
 *   >3 kg:  ₱90/kg
 *   Handwash is per-kilogram and is never charged overload or fixed load pricing.
 *
 * Surcharge / Overload:
 *   totalCapacity = numberOfLoads × baseServiceLimit
 *   madnessKg     = max(0, actualKg − totalCapacity)
 *   madnessFee    = madnessKg × ₱50 (0 when load count scales with weight)
 *
 * Customer-provided supplies are always ₱0.00 regardless of weight or loads.
 */
export const computeOrderPricing = (
  order: OrderForPricing,
  actualKg: number,
  lt: LoadType,
  deliveryFee: number,
  manualAdjustment: number = 0,
): PricingResult => {
  const name = order.serviceName?.toLowerCase() ?? '';
  const baseServiceLimit = getBaseServiceLimit(name, lt);
  const isHandwash = name.includes('handwash');

  let numberOfLoads = 1;
  let pricePerLoad = 0;
  let serviceTotal = 0;

  if (isHandwash) {
    // Handwash: strictly per-kg (1-3 kg = ₱150/kg, >3 kg = ₱90/kg)
    pricePerLoad = actualKg <= 3 ? 150 : 90;
    serviceTotal = Math.round(pricePerLoad * actualKg * 100) / 100;
    numberOfLoads = 1;
  } else {
    // Fixed capacity services: numberOfLoads = CEILING(actualKg / baseServiceLimit)
    numberOfLoads = actualKg <= 0 ? 1 : Math.ceil(actualKg / baseServiceLimit);

    // Determine base rate per load based on service and variant:
    if (name.includes('ecowash')) {
      pricePerLoad = 220; // Ecowash Full Service (5 kg/load)
    } else if (name.includes('dry') && !name.includes('full')) {
      pricePerLoad = 90;  // Dry Only (7 kg/load)
    } else if (name.includes('wash') && !name.includes('full')) {
      pricePerLoad = 80;  // Wash Only (7 kg/load)
    } else if (name.includes('premium full')) {
      // Premium Full Service: 8kg variant = ₱275, 7kg variant = ₱270
      if (name.includes('8kg') || name.includes('8 kg')) {
        pricePerLoad = 275;
      } else if (name.includes('7kg') || name.includes('7 kg')) {
        pricePerLoad = 270;
      } else {
        pricePerLoad = baseServiceLimit === 8 ? 275 : 270;
      }
    } else if (name.includes('basic full')) {
      // Basic Full Service: 8kg variant = ₱245, 7kg variant = ₱240
      if (name.includes('8kg') || name.includes('8 kg')) {
        pricePerLoad = 245;
      } else if (name.includes('7kg') || name.includes('7 kg')) {
        pricePerLoad = 240;
      } else {
        pricePerLoad = baseServiceLimit === 8 ? 245 : 240;
      }
    } else {
      // Fallback
      if (name.includes('8kg') || name.includes('8 kg')) {
        pricePerLoad = 245;
      } else if (name.includes('7kg') || name.includes('7 kg')) {
        pricePerLoad = 240;
      } else {
        pricePerLoad = baseServiceLimit === 8 ? 245 : 240;
      }
    }

    serviceTotal = pricePerLoad * numberOfLoads;
  }

  // Madness / overload surcharge (₱50/kg over total capacity; Handwash excluded)
  let madnessKg = 0;
  let madnessFee = 0;
  if (!isHandwash) {
    const totalBaseCapacity = numberOfLoads * baseServiceLimit;
    madnessKg = Math.max(0, actualKg - totalBaseCapacity);
    madnessFee = Math.round(madnessKg * 50);
  }

  // Detergent — customer-provided is always ₱0
  const detPPP = getDetergentPricePerPack(order.detergent);
  const detQty = order.detergentQuantity ?? 0;
  const detCost = detPPP * detQty;

  // Conditioner — customer-provided is always ₱0
  const conPPP = getConditionerPricePerPack(order.conditioner);
  const conQty = order.conditionerQuantity ?? 0;
  const conCost = conPPP * conQty;

  // Rush fee: ₱150/load
  const isRush = (order.rushPrice ?? 0) > 0;
  const rushFee = isRush ? 150 * numberOfLoads : 0;

  // Pickup fee — removed per client request
  const pickupFee = 0;

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
    convenienceFee +
    manualAdjustment;

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
    manualAdjustment,
    grandTotal,
    maxKgPerLoad: baseServiceLimit,
    isHandwash,
    isRush,
    baseServiceLimit,
  };
};
