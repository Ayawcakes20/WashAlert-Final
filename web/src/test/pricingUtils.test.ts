import { describe, it, expect } from "vitest";
import {
  getBaseServiceLimit,
  getDetergentPricePerPack,
  getConditionerPricePerPack,
  isCustomerProvided,
  computeOrderPricing,
  type OrderForPricing,
} from "../lib/pricingUtils";

describe("WashAlert Final Revised Service Load and Pricing Rules", () => {
  describe("1. Dynamic Service Capacity (getBaseServiceLimit)", () => {
    it("Ecowash Full Service = 5 kg", () => {
      expect(getBaseServiceLimit("Ecowash Full Service", "PURE_CLOTHES")).toBe(5);
    });

    it("Wash = 7 kg and Dry = 7 kg", () => {
      expect(getBaseServiceLimit("Wash (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Dry (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Wash", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Dry", "PURE_CLOTHES")).toBe(7);
    });

    it("Basic Full Service 7 kg = 7 kg", () => {
      expect(getBaseServiceLimit("Basic Full Service (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Basic Full Service 7 kg", "PURE_CLOTHES")).toBe(7);
    });

    it("Basic Full Service 8 kg = 8 kg for Pure Clothes, 7 kg for towels", () => {
      expect(getBaseServiceLimit("Basic Full Service (8kg)", "PURE_CLOTHES")).toBe(8);
      expect(getBaseServiceLimit("Basic Full Service 8 kg", "PURE_CLOTHES")).toBe(8);
      expect(getBaseServiceLimit("Basic Full Service (8kg)", "WITH_TOWELS")).toBe(7);
    });

    it("Premium Full Service 7 kg = 7 kg", () => {
      expect(getBaseServiceLimit("Premium Full Service (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Premium Full Service 7 kg", "PURE_CLOTHES")).toBe(7);
    });

    it("Premium Full Service 8 kg = 8 kg for Pure Clothes, 7 kg for towels", () => {
      expect(getBaseServiceLimit("Premium Full Service (8kg)", "PURE_CLOTHES")).toBe(8);
      expect(getBaseServiceLimit("Premium Full Service 8 kg", "PURE_CLOTHES")).toBe(8);
      expect(getBaseServiceLimit("Premium Full Service (8kg)", "WITH_TOWELS")).toBe(7);
    });

    it("BEDDINGS rule: always 5 kg regardless of service", () => {
      expect(getBaseServiceLimit("Basic Full Service (8kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Basic Full Service (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Premium Full Service (8kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Premium Full Service (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Wash (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Dry (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Ecowash Full Service", "BEDDINGS")).toBe(5);
    });
  });

  describe("2. Test Case A: Basic Full 8 kg – ₱245", () => {
    const order: OrderForPricing = {
      serviceName: "Basic Full Service (8kg)",
      serviceType: "DROP_OFF",
    };

    it("8.0 kg -> ₱245 service charge (1 full load, ₱0 overload)", () => {
      const res = computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadFee).toBe(0);
      expect(res.overloadKg).toBe(0);
    });

    it("8.5 kg -> ₱245 + ₱50 overload (1 full load + 0.5kg -> ₱50)", () => {
      const res = computeOrderPricing(order, 8.5, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadKg).toBe(1);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(295);
    });

    it("9.0 kg -> ₱245 + ₱50 overload (1 full load + 1.0kg -> ₱50)", () => {
      const res = computeOrderPricing(order, 9.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadKg).toBe(1);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(295);
    });

    it("10.0 kg -> ₱245 + ₱100 overload (1 full load + 2.0kg -> ₱100)", () => {
      const res = computeOrderPricing(order, 10.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadKg).toBe(2);
      expect(res.overloadFee).toBe(100);
      expect(res.serviceTotal + res.overloadFee).toBe(345);
    });

    it("16.0 kg -> 2 × ₱245 = ₱490 (2 full loads, ₱0 overload)", () => {
      const res = computeOrderPricing(order, 16.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.overloadFee).toBe(0);
    });

    it("24.0 kg -> 3 × ₱245 = ₱735 (3 full loads, ₱0 overload)", () => {
      const res = computeOrderPricing(order, 24.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(3);
      expect(res.serviceTotal).toBe(735);
      expect(res.overloadFee).toBe(0);
    });
  });

  describe("3. Test Case B: Ecowash – 5 kg – ₱220", () => {
    const order: OrderForPricing = {
      serviceName: "Ecowash Full Service",
      serviceType: "DROP_OFF",
    };

    it("5.0 kg -> ₱220 (1 full load, ₱0 overload)", () => {
      const res = computeOrderPricing(order, 5.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(220);
      expect(res.overloadFee).toBe(0);
    });

    it("5.7 kg -> ₱220 + ₱50 overload (1 full load + 0.7kg -> ₱50)", () => {
      const res = computeOrderPricing(order, 5.7, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(220);
      expect(res.overloadKg).toBe(1);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(270);
    });

    it("10.0 kg -> 2 × ₱220 = ₱440 (2 full loads, ₱0 overload)", () => {
      const res = computeOrderPricing(order, 10.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(440);
      expect(res.overloadFee).toBe(0);
    });
  });

  describe("4. Test Case C: Basic Full 7 kg – ₱240", () => {
    const order: OrderForPricing = {
      serviceName: "Basic Full Service (7kg)",
      serviceType: "DROP_OFF",
    };

    it("7.0 kg -> ₱240 (1 full load, ₱0 overload)", () => {
      const res = computeOrderPricing(order, 7.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(240);
      expect(res.overloadFee).toBe(0);
    });

    it("7.5 kg -> ₱240 + ₱50 overload (1 full load + 0.5kg -> ₱50)", () => {
      const res = computeOrderPricing(order, 7.5, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(240);
      expect(res.overloadKg).toBe(1);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(290);
    });

    it("14.0 kg -> 2 × ₱240 = ₱480 (2 full loads, ₱0 overload)", () => {
      const res = computeOrderPricing(order, 14.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(480);
      expect(res.overloadFee).toBe(0);
    });
  });

  describe("5. Test Case D: Premium Full 8 kg – ₱275", () => {
    const order: OrderForPricing = {
      serviceName: "Premium Full Service (8kg)",
      serviceType: "DROP_OFF",
    };

    it("8.0 kg -> ₱275 (1 full load, ₱0 overload)", () => {
      const res = computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(275);
      expect(res.overloadFee).toBe(0);
    });

    it("8.5 kg -> ₱275 + ₱50 overload", () => {
      const res = computeOrderPricing(order, 8.5, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(275);
      expect(res.overloadKg).toBe(1);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(325);
    });

    it("16.0 kg -> 2 × ₱275 = ₱550 (2 full loads, ₱0 overload)", () => {
      const res = computeOrderPricing(order, 16.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(550);
      expect(res.overloadFee).toBe(0);
    });
  });

  describe("6. Test Case E: Beddings", () => {
    const order: OrderForPricing = {
      serviceName: "Basic Full Service (8kg)",
      serviceType: "DROP_OFF",
    };

    it("Basic Full 8 kg + Beddings + 5.0 kg -> 5 kg capacity, ₱245, ₱0 overload", () => {
      const res = computeOrderPricing(order, 5.0, "BEDDINGS", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadFee).toBe(0);
    });

    it("Basic Full 8 kg + Beddings + 5.7 kg -> 5 kg base capacity + ₱50 overload = ₱295", () => {
      const res = computeOrderPricing(order, 5.7, "BEDDINGS", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(245);
      expect(res.overloadKg).toBe(1);
      expect(res.overloadFee).toBe(50);
      expect(res.serviceTotal + res.overloadFee).toBe(295);
    });
  });

  describe("7. Test Case F: Customer-Provided Supplies", () => {
    it("Customer Provided Detergent + 8.5 kg -> Detergent = ₱0", () => {
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

    it("Customer Provided Fabric Conditioner + 8.5 kg -> Fabric Conditioner = ₱0", () => {
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

    it("Both Customer Provided + weight changes -> Both remain ₱0", () => {
      const order: OrderForPricing = {
        serviceName: "Basic Full Service (8kg)",
        serviceType: "DROP_OFF",
        detergent: "Customer Provided",
        detergentQuantity: 2,
        conditioner: "Customer Provided",
        conditionerQuantity: 2,
      };
      const res1 = computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0);
      expect(res1.detCost).toBe(0);
      expect(res1.conCost).toBe(0);

      const res2 = computeOrderPricing(order, 16.0, "PURE_CLOTHES", 0);
      expect(res2.detCost).toBe(0);
      expect(res2.conCost).toBe(0);
    });
  });

  describe("8. Test Case G: Mixed Supplies", () => {
    it("Customer Provided Detergent + Downy -> ₱0 detergent + ₱25 fabric conditioner", () => {
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

    it("Ariel + Customer Provided Fabric Conditioner -> ₱30 detergent + ₱0 fabric conditioner", () => {
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

  describe("9. Handwash Separate Pricing", () => {
    const order: OrderForPricing = {
      serviceName: "Handwash",
      serviceType: "DROP_OFF",
    };

    it("1 kg = ₱150", () => {
      const res = computeOrderPricing(order, 1.0, "PURE_CLOTHES", 0);
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

    it("4 kg = ₱360", () => {
      const res = computeOrderPricing(order, 4.0, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(360);
      expect(res.overloadFee).toBe(0);
    });

    it("5 kg = ₱450", () => {
      const res = computeOrderPricing(order, 5.0, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(450);
      expect(res.overloadFee).toBe(0);
    });
  });
});
