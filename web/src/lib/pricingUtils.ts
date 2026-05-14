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
  manualAdjustment: number;
  grandTotal: number;
  maxKgPerLoad: number;
  isHandwash: boolean;
  isRush: boolean;
  baseServiceLimit: number; // The kg limit per load (7, 8, or 5)
}

// ── Constants ──────────────────────────────────────────────────────────────────

/** Max kg per load based on load composition and service type */
export const getBaseServiceLimit = (serviceName: string, lt: LoadType): number => {
  const name = serviceName.toLowerCase();
  
  // Ecowash is strictly 5kg
  if (name.includes('ecowash')) return 5;
  
  // Wash only and Dry only are strictly 7kg
  if ((name.includes('wash') || name.includes('dry')) && !name.includes('full')) return 7;
  
  // Handwash is per kg (base 1 for computation)
  if (name.includes('handwash')) return 1; 

  // Full services depend on load type: 8kg (Pure) or 7kg (Towel)
  return lt === 'PURE_CLOTHES' ? 8 : 7;
};

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
    // Handwash: ₱150/kg for 1–3 kg, ₱90/kg for 3 kg+
    pricePerLoad = actualKg <= 3 ? 150 : 90;
    serviceTotal = pricePerLoad * actualKg;
    numberOfLoads = 1;
  } else {
    // Standard Load Calculation (Based on 9kg PHYSICAL machine limit)
    numberOfLoads = Math.ceil(actualKg / 9);

    // Service pricing per load based on specific client rules
    if (name.includes('ecowash')) {
      pricePerLoad = 220; // Ecowash Full Service (5 kg)
    } else if (name.includes('dry') && !name.includes('full')) {
      pricePerLoad = 90;  // Dry Only (7 kg)
    } else if (name.includes('wash only') || (name.includes('wash') && !name.includes('full'))) {
      pricePerLoad = 80;  // Wash Only (7 kg)
    } else if (name.includes('basic full')) {
      // Basic Full Service: ₱245 (8kg) or ₱240 (7kg)
      pricePerLoad = baseServiceLimit === 8 ? 245 : 240;
    } else if (name.includes('premium full')) {
      // Premium Full Service: ₱275 (8kg) or ₱270 (7kg)
      pricePerLoad = baseServiceLimit === 8 ? 275 : 270;
    } else {
      // Default fallback
      pricePerLoad = baseServiceLimit === 8 ? 245 : 240;
    }

    serviceTotal = pricePerLoad * numberOfLoads;
  }

  // Madness surcharge — ₱50/kg over standard base capacity
  // Capstone Requirement: Show exactly why extra is charged.
  const baseTotalCapacity = numberOfLoads * baseServiceLimit;
  const madnessKg = Math.max(0, actualKg - baseTotalCapacity);
  const madnessFee = Math.round(madnessKg * 50);

  // Detergent & Conditioner
  const detPPP = getDetergentPricePerPack(order.detergent);
  const detQty = order.detergentQuantity ?? 0;
  const detCost = detPPP * detQty;

  const conPPP = getConditionerPricePerPack(order.conditioner);
  const conQty = order.conditionerQuantity ?? 0;
  const conCost = conPPP * conQty;

  // Rush fee — ₱150 per load
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
