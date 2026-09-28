import { describe, it, expect } from "vitest";
import {
  getBaseServiceLimit,
  getDetergentPricePerPack,
  getConditionerPricePerPack,
  isCustomerProvided,
  computeOrderPricing,
  type OrderForPricing,
} from "../lib/pricingUtils";

describe("WashAlert Automatic Load Adjustment & Separate Overload Pricing", () => {
  describe("1. Capacity & Beddings Rule", () => {
    it("Dynamic service capacities", () => {
      expect(getBaseServiceLimit("Ecowash Full Service", "PURE_CLOTHES")).toBe(5);
      expect(getBaseServiceLimit("Wash (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Dry (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Basic Full Service (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Basic Full Service (8kg)", "PURE_CLOTHES")).toBe(8);
      expect(getBaseServiceLimit("Premium Full Service (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Premium Full Service (8kg)", "PURE_CLOTHES")).toBe(8);
    });

    it("BEDDINGS rule: always 5 kg capacity regardless of service", () => {
      expect(getBaseServiceLimit("Basic Full Service (8kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Basic Full Service (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Premium Full Service (8kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Wash (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Dry (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Ecowash Full Service", "BEDDINGS")).toBe(5);
    });
  });

  describe("2. Required Load Examples: Ecowash – 5 kg capacity", () => {
    const order: OrderForPricing = {
      serviceName: "Ecowash Full Service",
      serviceType: "DROP_OFF",
    };

    it("5.0 kg → 1 load, ₱220 base, ₱0 overload", () => {
      const res = computeOrderPricing(order, 5.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(220);
      expect(res.overloadFee).toBe(0);
    });

    it("5.1 kg → 2 loads, ₱220 base, ₱50 overload (total ₱270, NOT ₱440)", () => {
      const res = computeOrderPricing(order, 5.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(220);
      expect(res.overloadKg).toBe(1);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(270);
    });

    it("5.2 kg → 2 loads", () => {
      expect(computeOrderPricing(order, 5.2, "PURE_CLOTHES", 0).numberOfLoads).toBe(2);
    });

    it("6.0 kg → 2 loads", () => {
      expect(computeOrderPricing(order, 6.0, "PURE_CLOTHES", 0).numberOfLoads).toBe(2);
    });

    it("8.0 kg → 2 loads", () => {
      expect(computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0).numberOfLoads).toBe(2);
    });

    it("9.0 kg → 2 loads", () => {
      expect(computeOrderPricing(order, 9.0, "PURE_CLOTHES", 0).numberOfLoads).toBe(2);
    });

    it("9.9 kg → 2 loads", () => {
      expect(computeOrderPricing(order, 9.9, "PURE_CLOTHES", 0).numberOfLoads).toBe(2);
    });

    it("10.0 kg → 2 loads, ₱440 base, ₱0 overload", () => {
      const res = computeOrderPricing(order, 10.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(440);
      expect(res.overloadFee).toBe(0);
    });

    it("10.1 kg → 3 loads", () => {
      expect(computeOrderPricing(order, 10.1, "PURE_CLOTHES", 0).numberOfLoads).toBe(3);
    });

    it("15.0 kg → 3 loads", () => {
      expect(computeOrderPricing(order, 15.0, "PURE_CLOTHES", 0).numberOfLoads).toBe(3);
    });

    it("15.1 kg → 4 loads", () => {
      expect(computeOrderPricing(order, 15.1, "PURE_CLOTHES", 0).numberOfLoads).toBe(4);
    });

    it("16.0 kg → 4 loads", () => {
      expect(computeOrderPricing(order, 16.0, "PURE_CLOTHES", 0).numberOfLoads).toBe(4);
    });
  });

  describe("3. Required Load Examples: Basic/Premium 8 kg Service", () => {
    const order: OrderForPricing = {
      serviceName: "Basic Full Service (8kg)",
      serviceType: "DROP_OFF",
    };

    it("8.0 kg → 1 load", () => {
      const res = computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadFee).toBe(0);
    });

    it("8.1 kg → 2 loads, ₱245 base, ₱50 overload (total ₱295, NOT ₱490)", () => {
      const res = computeOrderPricing(order, 8.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(295);
    });

    it("8.5 kg → 2 loads, ₱245 base, ₱50 overload", () => {
      const res = computeOrderPricing(order, 8.5, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(295);
    });

    it("9.0 kg → 2 loads", () => {
      const res = computeOrderPricing(order, 9.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadFee).toBe(50);
    });

    it("10.0 kg → 2 loads", () => {
      const res = computeOrderPricing(order, 10.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadFee).toBe(100);
      expect(res.serviceTotal + res.overloadFee).toBe(345);
    });

    it("15.9 kg → 2 loads", () => {
      expect(computeOrderPricing(order, 15.9, "PURE_CLOTHES", 0).numberOfLoads).toBe(2);
    });

    it("16.0 kg → 2 loads, 2 × ₱245 = ₱490", () => {
      const res = computeOrderPricing(order, 16.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.overloadFee).toBe(0);
    });

    it("16.1 kg → 3 loads, 2 loads base (₱490) + ₱50 overload = ₱540", () => {
      const res = computeOrderPricing(order, 16.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(3);
      expect(res.serviceTotal).toBe(490);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(540);
    });

    it("24.0 kg → 3 loads, 3 × ₱245 = ₱735", () => {
      const res = computeOrderPricing(order, 24.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(3);
      expect(res.serviceTotal).toBe(735);
      expect(res.overloadFee).toBe(0);
    });

    it("24.1 kg → 4 loads, 3 loads base (₱735) + ₱50 overload = ₱785", () => {
      const res = computeOrderPricing(order, 24.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(4);
      expect(res.serviceTotal).toBe(735);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(785);
    });
  });

  describe("4. Required Load Examples: Basic/Premium 7 kg Service", () => {
    const order: OrderForPricing = {
      serviceName: "Basic Full Service (7kg)",
      serviceType: "DROP_OFF",
    };

    it("7.0 kg → 1 load", () => {
      const res = computeOrderPricing(order, 7.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(240);
      expect(res.overloadFee).toBe(0);
    });

    it("7.1 kg → 2 loads", () => {
      const res = computeOrderPricing(order, 7.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(240);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(290);
    });

    it("8.0 kg → 2 loads", () => {
      expect(computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0).numberOfLoads).toBe(2);
    });

    it("13.9 kg → 2 loads", () => {
      expect(computeOrderPricing(order, 13.9, "PURE_CLOTHES", 0).numberOfLoads).toBe(2);
    });

    it("14.0 kg → 2 loads", () => {
      const res = computeOrderPricing(order, 14.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(480);
      expect(res.overloadFee).toBe(0);
    });

    it("14.1 kg → 3 loads", () => {
      expect(computeOrderPricing(order, 14.1, "PURE_CLOTHES", 0).numberOfLoads).toBe(3);
    });

    it("21.0 kg → 3 loads", () => {
      const res = computeOrderPricing(order, 21.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(3);
      expect(res.serviceTotal).toBe(720);
      expect(res.overloadFee).toBe(0);
    });

    it("21.1 kg → 4 loads", () => {
      expect(computeOrderPricing(order, 21.1, "PURE_CLOTHES", 0).numberOfLoads).toBe(4);
    });
  });

  describe("5. Customer-Provided Supplies & Mixed Combinations", () => {
    it("Customer Provided Detergent + 8.5 kg → Detergent = ₱0", () => {
      const order: OrderForPricing = {
        serviceName: "Basic Full Service (8kg)",
        serviceType: "DROP_OFF",
        detergent: "Customer Provided",
        detergentQuantity: 1,
      };
      const res = computeOrderPricing(order, 8.5, "PURE_CLOTHES", 0);
      expect(res.detCost).toBe(0);
      expect(res.detPPP).toBe(0);
    });

    it("Customer Provided Fabric Conditioner + 8.5 kg → Fabric Conditioner = ₱0", () => {
      const order: OrderForPricing = {
        serviceName: "Basic Full Service (8kg)",
        serviceType: "DROP_OFF",
        conditioner: "Customer Provided",
        conditionerQuantity: 1,
      };
      const res = computeOrderPricing(order, 8.5, "PURE_CLOTHES", 0);
      expect(res.conCost).toBe(0);
      expect(res.conPPP).toBe(0);
    });

    it("Mixed: Customer Provided Detergent + Downy → ₱0 + ₱25", () => {
      const order: OrderForPricing = {
        serviceName: "Basic Full Service (8kg)",
        serviceType: "DROP_OFF",
        detergent: "Customer Provided",
        detergentQuantity: 1,
        conditioner: "Downy twin",
        conditionerQuantity: 1,
      };
      const res = computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0);
      expect(res.detCost).toBe(0);
      expect(res.conCost).toBe(25);
    });

    it("Mixed: Ariel + Customer Provided Fabric Conditioner → ₱30 + ₱0", () => {
      const order: OrderForPricing = {
        serviceName: "Basic Full Service (8kg)",
        serviceType: "DROP_OFF",
        detergent: "Ariel twin",
        detergentQuantity: 1,
        conditioner: "Customer Provided",
        conditionerQuantity: 1,
      };
      const res = computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0);
      expect(res.detCost).toBe(30);
      expect(res.conCost).toBe(0);
    });
  });

  describe("6. Handwash Pricing", () => {
    const order: OrderForPricing = {
      serviceName: "Handwash",
      serviceType: "DROP_OFF",
    };

    it("1 kg = ₱150", () => {
      const res = computeOrderPricing(order, 1.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(150);
      expect(res.overloadFee).toBe(0);
    });

    it("2 kg = ₱300", () => {
      const res = computeOrderPricing(order, 2.0, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(300);
      expect(res.overloadFee).toBe(0);
    });

    it("3 kg = ₱450", () => {
      const res = computeOrderPricing(order, 3.0, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(450);
      expect(res.overloadFee).toBe(0);
    });

    it("3.1 kg = 3.1 × ₱90 = ₱279", () => {
      const res = computeOrderPricing(order, 3.1, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(279);
      expect(res.overloadFee).toBe(0);
    });
  });
});
