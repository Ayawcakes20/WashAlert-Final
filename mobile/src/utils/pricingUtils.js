// ─── WashAlert Pricing Utilities (Mobile Port) ──────────────────────────────────
// Ported from web/src/lib/pricingUtils.ts to ensure 100% receipt sync.

export const getBaseServiceLimit = (serviceName, lt) => {
  const name = String(serviceName || '').toLowerCase();
  if (name.includes('ecowash')) return 5;
  if ((name.includes('wash') || name.includes('dry')) && !name.includes('full')) return 7;
  if (name.includes('handwash')) return 1; 
  return lt === 'PURE_CLOTHES' ? 8 : 7;
};

export const getDetergentPricePerPack = (name) => {
  if (!name || name.toLowerCase() === 'none') return 0;
  return name.toLowerCase().includes('ariel') ? 30 : 25;
};

export const getConditionerPricePerPack = (name) => {
  if (!name || name.toLowerCase() === 'none') return 0;
  return name.toLowerCase().includes('downy') ? 25 : 15;
};

/**
 * Compute full order pricing given actual weighed kg and load type.
 */
export const computeOrderPricing = (
  order,
  actualKg,
  lt = 'PURE_CLOTHES',
  deliveryFee = 0,
  manualAdjustment = 0,
) => {
  const name = (order.serviceName || order.serviceType || '').toLowerCase();
  const baseServiceLimit = getBaseServiceLimit(name, lt);
  const isHandwash = name.includes('handwash');

  let numberOfLoads = 1;
  let pricePerLoad = 0;
  let serviceTotal = 0;

  if (isHandwash) {
    pricePerLoad = actualKg <= 3 ? 150 : 90;
    serviceTotal = pricePerLoad * actualKg;
    numberOfLoads = 1;
  } else {
    numberOfLoads = Math.ceil(actualKg / 9);

    if (name.includes('ecowash')) {
      pricePerLoad = 220;
    } else if (name.includes('dry') && !name.includes('full')) {
      pricePerLoad = 90;
    } else if (name.includes('wash only') || (name.includes('wash') && !name.includes('full'))) {
      pricePerLoad = 80;
    } else if (name.includes('basic full')) {
      pricePerLoad = baseServiceLimit === 8 ? 245 : 240;
    } else if (name.includes('premium full')) {
      pricePerLoad = baseServiceLimit === 8 ? 275 : 270;
    } else {
      pricePerLoad = baseServiceLimit === 8 ? 245 : 240;
    }

    serviceTotal = pricePerLoad * numberOfLoads;
  }

  const totalBaseCapacity = numberOfLoads * baseServiceLimit;
  const madnessKg = Math.max(0, actualKg - totalBaseCapacity);
  const madnessFee = Math.round(madnessKg * 50);

  const detPPP = getDetergentPricePerPack(order.detergent);
  const detQty = order.detergentQuantity ?? 0;
  const detCost = detPPP * detQty;

  const conPPP = getConditionerPricePerPack(order.conditioner);
  const conQty = order.conditionerQuantity ?? 0;
  const conCost = conPPP * conQty;

  const isRush = (order.rushPrice ?? 0) > 0;
  const rushFee = isRush ? 150 * numberOfLoads : 0;

  const convenienceFee = 20;

  const grandTotal =
    serviceTotal +
    madnessFee +
    detCost +
    conCost +
    rushFee +
    deliveryFee +
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
    convenienceFee,
    manualAdjustment,
    grandTotal,
    baseServiceLimit
  };
};
