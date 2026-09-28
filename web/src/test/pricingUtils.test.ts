import { describe, it, expect } from "vitest";
import {
  getBaseServiceLimit,
  getDetergentPricePerPack,
  getConditionerPricePerPack,
  isCustomerProvided,
  computeOrderPricing,
  type OrderForPricing,
} from "../lib/pricingUtils";

describe("Triplets Laundry Pricing Policies & Calculations", () => {
  describe("1. Capacity & Load Limits (getBaseServiceLimit)", () => {
    it("Ecowash Full Service has 5 kg capacity", () => {
      expect(getBaseServiceLimit("Ecowash Full Service", "PURE_CLOTHES")).toBe(5);
    });

    it("Wash (7kg) and Dry (7kg) have 7 kg capacity", () => {
      expect(getBaseServiceLimit("Wash (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Dry (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Wash Only", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Dry Only", "PURE_CLOTHES")).toBe(7);
    });

    it("Basic Full Service 8kg has 8 kg capacity for pure clothes, 7 kg for towels", () => {
      expect(getBaseServiceLimit("Basic Full Service (8kg)", "PURE_CLOTHES")).toBe(8);
      expect(getBaseServiceLimit("Basic Full Service (8kg)", "WITH_TOWELS")).toBe(7);
      expect(getBaseServiceLimit("Basic Full Service 8kg", "PURE_CLOTHES")).toBe(8);
      expect(getBaseServiceLimit("Basic Full Service 8kg", "WITH_TOWELS")).toBe(7);
    });

    it("Basic Full Service 7kg has 7 kg capacity", () => {
      expect(getBaseServiceLimit("Basic Full Service (7kg)", "PURE_CLOTHES")).toBe(7);
      expect(getBaseServiceLimit("Basic Full Service 7kg", "PURE_CLOTHES")).toBe(7);
    });

    it("BEDDINGS load type ALWAYS has 5 kg capacity regardless of service", () => {
      expect(getBaseServiceLimit("Basic Full Service (8kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Basic Full Service (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Premium Full Service (8kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Wash (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Dry (7kg)", "BEDDINGS")).toBe(5);
      expect(getBaseServiceLimit("Ecowash Full Service", "BEDDINGS")).toBe(5);
    });
  });

  describe("2. Testing Matrix: Basic Full Service 8kg + Pure Clothes", () => {
    const order: OrderForPricing = {
      serviceName: "Basic Full Service (8kg)",
      serviceType: "DROP_OFF",
    };

    it("8.0 kg = 1 load, ₱245 base", () => {
      const res = computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(245);
      expect(res.madnessFee).toBe(0);
    });

    it("8.1 kg = 2 loads, ₱490 base", () => {
      const res = computeOrderPricing(order, 8.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.madnessFee).toBe(0);
    });

    it("9.0 kg = 2 loads, ₱490 base", () => {
      const res = computeOrderPricing(order, 9.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.madnessFee).toBe(0);
    });

    it("9.1 kg = 2 loads, ₱490 base", () => {
      const res = computeOrderPricing(order, 9.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.madnessFee).toBe(0);
    });

    it("16.0 kg = 2 loads, ₱490 base", () => {
      const res = computeOrderPricing(order, 16.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.madnessFee).toBe(0);
    });

    it("16.1 kg = 3 loads, ₱735 base", () => {
      const res = computeOrderPricing(order, 16.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(3);
      expect(res.serviceTotal).toBe(735);
      expect(res.madnessFee).toBe(0);
    });
  });

  describe("3. Testing Matrix: Basic Full Service 8kg + Beddings", () => {
    const order: OrderForPricing = {
      serviceName: "Basic Full Service (8kg)",
      serviceType: "DROP_OFF",
    };

    it("5.0 kg = 1 load, ₱245 base", () => {
      const res = computeOrderPricing(order, 5.0, "BEDDINGS", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(245);
      expect(res.madnessFee).toBe(0);
    });

    it("5.1 kg = 2 loads, ₱490 base", () => {
      const res = computeOrderPricing(order, 5.1, "BEDDINGS", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.madnessFee).toBe(0);
    });

    it("8.0 kg = 2 loads, ₱490 base", () => {
      const res = computeOrderPricing(order, 8.0, "BEDDINGS", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.madnessFee).toBe(0);
    });

    it("9.0 kg = 2 loads, ₱490 base", () => {
      const res = computeOrderPricing(order, 9.0, "BEDDINGS", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.madnessFee).toBe(0);
    });

    it("10.0 kg = 2 loads, ₱490 base", () => {
      const res = computeOrderPricing(order, 10.0, "BEDDINGS", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(490);
      expect(res.madnessFee).toBe(0);
    });

    it("10.1 kg = 3 loads, ₱735 base", () => {
      const res = computeOrderPricing(order, 10.1, "BEDDINGS", 0);
      expect(res.numberOfLoads).toBe(3);
      expect(res.serviceTotal).toBe(735);
      expect(res.madnessFee).toBe(0);
    });
  });

  describe("4. Testing Matrix: Basic Full Service 7kg + Pure Clothes", () => {
    const order: OrderForPricing = {
      serviceName: "Basic Full Service (7kg)",
      serviceType: "DROP_OFF",
    };

    it("7.0 kg = 1 load, ₱240 base", () => {
      const res = computeOrderPricing(order, 7.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(1);
      expect(res.serviceTotal).toBe(240);
      expect(res.madnessFee).toBe(0);
    });

    it("7.1 kg = 2 loads, ₱480 base", () => {
      const res = computeOrderPricing(order, 7.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(480);
      expect(res.madnessFee).toBe(0);
    });

    it("14.0 kg = 2 loads, ₱480 base", () => {
      const res = computeOrderPricing(order, 14.0, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(2);
      expect(res.serviceTotal).toBe(480);
      expect(res.madnessFee).toBe(0);
    });

    it("14.1 kg = 3 loads, ₱720 base", () => {
      const res = computeOrderPricing(order, 14.1, "PURE_CLOTHES", 0);
      expect(res.numberOfLoads).toBe(3);
      expect(res.serviceTotal).toBe(720);
      expect(res.madnessFee).toBe(0);
    });
  });

  describe("5. Handwash Pricing", () => {
    const order: OrderForPricing = {
      serviceName: "Handwash",
      serviceType: "DROP_OFF",
    };

    it("1 kg = ₱150", () => {
      const res = computeOrderPricing(order, 1.0, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(150);
      expect(res.madnessFee).toBe(0);
    });

    it("2 kg = ₱300", () => {
      const res = computeOrderPricing(order, 2.0, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(300);
      expect(res.madnessFee).toBe(0);
    });

    it("3 kg = ₱450", () => {
      const res = computeOrderPricing(order, 3.0, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(450);
      expect(res.madnessFee).toBe(0);
    });

    it("3.1 kg = 3.1 × ₱90 = ₱279", () => {
      const res = computeOrderPricing(order, 3.1, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(279);
      expect(res.madnessFee).toBe(0);
    });

    it("4 kg = ₱360", () => {
      const res = computeOrderPricing(order, 4.0, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(360);
      expect(res.madnessFee).toBe(0);
    });

    it("5 kg = ₱450", () => {
      const res = computeOrderPricing(order, 5.0, "PURE_CLOTHES", 0);
      expect(res.serviceTotal).toBe(450);
      expect(res.madnessFee).toBe(0);
    });
  });

  describe("6. Detergent & Conditioner Pricing and Customer Provided", () => {
    it("System-provided supplies pricing", () => {
      expect(getDetergentPricePerPack("Ariel twin")).toBe(30);
      expect(getDetergentPricePerPack("Surf twin")).toBe(25);
      expect(getConditionerPricePerPack("Downy twin")).toBe(25);
      expect(getConditionerPricePerPack("Charm Fabcon")).toBe(15);
    });

    it("Customer-provided supplies return ₱0", () => {
      expect(getDetergentPricePerPack("Customer Provided")).toBe(0);
      expect(getDetergentPricePerPack("customer provided")).toBe(0);
      expect(getConditionerPricePerPack("Customer Provided")).toBe(0);
      expect(getConditionerPricePerPack("customer provided")).toBe(0);
      expect(isCustomerProvided("Customer Provided")).toBe(true);
      expect(isCustomerProvided("None")).toBe(false);
    });

    it("Order with Customer Provided supplies has ₱0 supply cost across load recalculations", () => {
      const order: OrderForPricing = {
        serviceName: "Basic Full Service (8kg)",
        serviceType: "DROP_OFF",
        detergent: "Customer Provided",
        detergentQuantity: 5,
        conditioner: "Customer Provided",
        conditionerQuantity: 5,
      };

      const res1 = computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0);
      expect(res1.detCost).toBe(0);
      expect(res1.conCost).toBe(0);

      const res2 = computeOrderPricing(order, 16.1, "PURE_CLOTHES", 0);
      expect(res2.numberOfLoads).toBe(3);
      expect(res2.detCost).toBe(0);
      expect(res2.conCost).toBe(0);
    });
  });

  describe("7. Rush Service Pricing", () => {
    it("Rush service adds ₱150 per load", () => {
      const order: OrderForPricing = {
        serviceName: "Basic Full Service (8kg)",
        serviceType: "DROP_OFF",
        rushPrice: 150,
      };

      const res1 = computeOrderPricing(order, 8.0, "PURE_CLOTHES", 0);
      expect(res1.numberOfLoads).toBe(1);
      expect(res1.rushFee).toBe(150);

      const res2 = computeOrderPricing(order, 8.1, "PURE_CLOTHES", 0);
      expect(res2.numberOfLoads).toBe(2);
      expect(res2.rushFee).toBe(300);
    });
  });
});
