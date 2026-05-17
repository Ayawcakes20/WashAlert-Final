import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Info,
  Loader2,
  Printer,
  Receipt,
  Scale,
  Send,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { printOrderReceipt } from "@/lib/receiptPrinter";
import {
  type LoadType,
  type PricingResult,
  computeOrderPricing,
} from "@/lib/pricingUtils";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FinalizeOrderData {
  id: number;
  orderId: string;
  customerName: string;
  customerPhone?: string;
  branch?: string;
  estimatedWeightKg: number;
  actualWeightKg?: number;
  serviceType: "DROP_OFF" | "PICKUP_DELIVERY";
  serviceName?: string;
  paymentMethod?: string;
  detergent?: string;
  detergentQuantity?: number;
  conditioner?: string;
  conditionerQuantity?: number;
  rushPrice?: number;
  deliveryPrice?: number;
}

interface FinalizeWeightModalProps {
  open: boolean;
  order: FinalizeOrderData | null;
  submitting: boolean;
  onSubmit: (params: {
    actualWeightKg: number;
    finalPrice: number;
    deliveryFee: number;
    staffNotes?: string;
    manualAdjustment?: number;
  }) => void;
  onCancel: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₱${Math.round(n).toLocaleString()}`;

const formatDate = () =>
  new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

// ── Receipt preview (right panel) ─────────────────────────────────────────────

interface ReceiptPreviewProps {
  order: FinalizeOrderData;
  actualKg: number;
  loadType: LoadType;
  pricing: PricingResult | null;
  deliveryFee: number;
  manualAdjustment: number;
  staffNotes: string;
}

function ReceiptPreview({ order, actualKg, loadType, pricing: p, deliveryFee, manualAdjustment, staffNotes }: ReceiptPreviewProps) {
  return (
    <div className="p-5 space-y-0 font-mono text-[11px]">
      {/* Header */}
      <div className="text-center pb-4 border-b border-dashed border-slate-300">
        <h2 className="text-base font-black text-slate-900 tracking-widest uppercase">WashAlert</h2>
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
          {order.branch || "Makati Branch"}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">Open 7:00 AM – 10:00 PM daily</p>
      </div>

      {/* Order ID */}
      <div className="text-center py-4 border-b border-dashed border-slate-300">
        <p className="text-xl font-black text-blue-600 tracking-tight">{order.orderId}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{formatDate()}</p>
      </div>

      {/* Customer summary */}
      <div className="py-3 space-y-1.5 border-b border-dashed border-slate-300">
        <ReceiptRow label="Customer" value={order.customerName} bold />
        <ReceiptRow label="Actual weight" value={actualKg > 0 ? `${actualKg} kg` : "—"} bold />
        <ReceiptRow
          label="Load type"
          value={loadType === "PURE_CLOTHES" ? "Pure clothes" : "With towels/beddings"}
          bold
        />
        {p && (
          <ReceiptRow label="No. of loads" value={`${p.numberOfLoads} load${p.numberOfLoads !== 1 ? "s" : ""}`} bold />
        )}
        <ReceiptRow label="Payment" value={order.paymentMethod || "Cash"} bold />
      </div>

      {p ? (
        <>
          {/* Service breakdown */}
          <div className="py-3 space-y-2.5 border-b border-dashed border-slate-300">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Service Breakdown
            </p>
            <ReceiptLineItem
              label={order.serviceName || "Service"}
              sub={`₱${p.pricePerLoad} × ${p.isHandwash ? `${actualKg} kg` : `${p.numberOfLoads} load${p.numberOfLoads !== 1 ? "s" : ""}`}`}
              amount={p.serviceTotal}
            />
            {p.madnessFee > 0 && (
              <ReceiptLineItem
                label="Madness surcharge"
                sub={`(${actualKg}kg - ${p.numberOfLoads * p.baseServiceLimit}kg capacity) × ₱50`}
                amount={p.madnessFee}
                className="text-orange-700"
              />
            )}
            {p.detCost > 0 && (
              <ReceiptLineItem
                label={`${order.detergent} detergent`}
                sub={`₱${p.detPPP} × ${p.detQty} pack${p.detQty !== 1 ? "s" : ""}`}
                amount={p.detCost}
              />
            )}
            {p.conCost > 0 && (
              <ReceiptLineItem
                label={`${order.conditioner} conditioner`}
                sub={`₱${p.conPPP} × ${p.conQty} pack${p.conQty !== 1 ? "s" : ""}`}
                amount={p.conCost}
              />
            )}
            {p.rushFee > 0 && (
              <ReceiptLineItem
                label="⚡ Rush fee"
                sub={`₱150 × ${p.numberOfLoads} load${p.numberOfLoads !== 1 ? "s" : ""}`}
                amount={p.rushFee}
                className="text-amber-700"
              />
            )}
          </div>

          {/* Additional charges */}
          <div className="py-3 space-y-2.5 border-b border-dashed border-slate-300">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Additional Charges
            </p>
            {deliveryFee > 0 && (
              <ReceiptLineItem
                label="Delivery fee"
                sub="Based on location"
                amount={deliveryFee}
              />
            )}
            {p.pickupFee > 0 && (
              <ReceiptLineItem label="Pickup fee" amount={p.pickupFee} />
            )}
            <ReceiptLineItem
              label="Convenience fee"
              sub="Online booking · system fee"
              amount={p.convenienceFee}
            />
            {manualAdjustment !== 0 && (
              <ReceiptLineItem
                label="Adjustment"
                sub="Staff manual override"
                amount={manualAdjustment}
                className={manualAdjustment < 0 ? "text-emerald-700" : "text-blue-700"}
              />
            )}
          </div>

          {/* Total */}
          <div className="py-4 flex justify-between items-end">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">TOTAL</p>
              <p className="text-2xl font-black text-blue-600 tabular-nums">{fmt(p.grandTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Payment</p>
              <p className="font-black text-slate-800 uppercase text-[10px] tracking-widest">
                {order.paymentMethod || "Cash"}
              </p>
            </div>
          </div>

          {staffNotes && (
            <div className="mt-2 mb-4 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[9px] text-slate-500 italic leading-tight">
              <p className="font-black uppercase not-italic text-[8px] text-slate-400 mb-1 tracking-tighter">Staff Remarks:</p>
              {staffNotes}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-dashed border-slate-300 pt-3 text-center space-y-1">
            <p className="text-[9px] font-bold text-slate-300">* * * * * * * * * *</p>
            <p className="text-[9px] text-slate-400">
              {order.orderId}-{new Date().getFullYear()}
            </p>
            <p className="text-[9px] text-slate-400">Thank you for choosing WashAlert!</p>
            <p className="text-[9px] text-slate-400">
              This is your official receipt. Please keep for reference.
            </p>
          </div>
        </>
      ) : (
        <div className="py-16 text-center">
          <Scale className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-[11px] font-black text-slate-300">Enter weight ≥ 5 kg</p>
          <p className="text-[10px] text-slate-300 mt-0.5">to see full breakdown</p>
        </div>
      )}
    </div>
  );
}

// ── Small receipt sub-components ──────────────────────────────────────────────

function ReceiptRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "font-black text-slate-900" : "text-slate-700"}>{value}</span>
    </div>
  );
}

function ReceiptLineItem({
  label,
  sub,
  amount,
  className = "text-slate-800",
}: {
  label: string;
  sub?: string;
  amount: number;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-2">
      <div className="min-w-0">
        <p className={`font-bold truncate ${className}`}>{label}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
      <span className={`font-black tabular-nums shrink-0 ${className}`}>{fmt(amount)}</span>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export function FinalizeWeightModal({
  open,
  order,
  submitting,
  onSubmit,
  onCancel,
}: FinalizeWeightModalProps) {
  const [actualWeightRaw, setActualWeightRaw] = useState("");
  const [loadType, setLoadType] = useState<LoadType>("PURE_CLOTHES");
  const [deliveryFeeRaw, setDeliveryFeeRaw] = useState("0");
  const [manualAdjustmentRaw, setManualAdjustmentRaw] = useState("0");
  const [detQty, setDetQty] = useState(0);
  const [conQty, setConQty] = useState(0);
  const [staffNotes, setStaffNotes] = useState("");
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Stock availability for the order's branch (keyed by item name, lowercase)
  const [availStock, setAvailStock] = useState<Record<string, number>>({});
  const fetchAvailability = useCallback(async (branch: string) => {
    try {
      const res = await fetch(
        `/api/bookings/supplies-availability?branch=${encodeURIComponent(branch)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data: { detergent?: { label: string; availableQty: number }[]; conditioner?: { label: string; availableQty: number }[] } = await res.json();
      const map: Record<string, number> = {};
      [...(data.detergent ?? []), ...(data.conditioner ?? [])].forEach((item) => {
        map[item.label.toLowerCase()] = item.availableQty;
      });
      setAvailStock(map);
    } catch { /* ignore – UI falls back to no cap */ }
  }, []);

  const getAvailQty = (itemName: string | undefined): number => {
    if (!itemName || itemName.toLowerCase() === "none") return 0;
    return availStock[itemName.toLowerCase()] ?? 999;
  };

  // Reset form when a new order is opened
  useEffect(() => {
    if (open && order) {
      setActualWeightRaw(order.actualWeightKg?.toString() ?? "");
      setLoadType("PURE_CLOTHES");
      setDeliveryFeeRaw(
        order.serviceType === "PICKUP_DELIVERY"
          ? (order.deliveryPrice ?? 50).toString()
          : "0",
      );
      setDetQty(order.detergentQuantity ?? 0);
      setConQty(order.conditionerQuantity ?? 0);
      setManualAdjustmentRaw("0");
      setStaffNotes("");
      setAvailStock({});
      if (order.branch) void fetchAvailability(order.branch);
      // Auto-focus weight input
      setTimeout(() => weightInputRef.current?.focus(), 80);
    }
  }, [open, order?.id, fetchAvailability]);

  if (!order) return null;

  const actualKg = parseFloat(actualWeightRaw) || 0;
  const deliveryFee = parseFloat(deliveryFeeRaw) || 0;
  const manualAdjustment = parseFloat(manualAdjustmentRaw) || 0;
  const weightValid = actualKg >= 5;
  const showWeightError = actualKg > 0 && !weightValid;

  const pricing: PricingResult | null =
    weightValid ? computeOrderPricing({
      ...order,
      detergentQuantity: detQty,
      conditionerQuantity: conQty,
    }, actualKg, loadType, deliveryFee, manualAdjustment) : null;

  const handleSubmit = () => {
    if (!weightValid) return;
    if (!pricing) return;
    onSubmit({
      actualWeightKg: actualKg,
      finalPrice: pricing.grandTotal,
      deliveryFee,
      staffNotes,
      manualAdjustment,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[1120px] max-h-[94vh] border-0 rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col bg-white gap-0">

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div className="bg-[#0F172A] px-8 py-6 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/20">
              <Scale className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <DialogTitle className="text-2xl font-black text-white tracking-tight">
                  Finalize Weight &amp; Pricing
                </DialogTitle>
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                  Staff Audit
                </Badge>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
                  <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest">{order.orderId}</span>
                </div>
                <span className="text-slate-700">·</span>
                <span className="text-xs font-bold text-slate-400">Customer: <span className="text-slate-200">{order.customerName}</span></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-3 flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Est. Weight</p>
                  <p className="text-xl font-black text-slate-400">{order.estimatedWeightKg} <span className="text-xs">kg</span></p>
               </div>
               <div className="w-px h-8 bg-slate-700/50" />
               <div className="text-right">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Actual Weight</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={actualWeightRaw || "empty"}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-xl font-black text-white"
                    >
                      {actualWeightRaw || "0.0"} <span className="text-xs">kg</span>
                    </motion.p>
                  </AnimatePresence>
               </div>
            </div>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* LEFT PANEL ─ Staff actions */}
          <ScrollArea className="flex-1 bg-slate-50">
            <div className="p-7 space-y-5">

              {/* Info banner */}
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-blue-800 leading-relaxed">
                  This order was booked with an estimated weight of{" "}
                  <strong>{order.estimatedWeightKg} kg</strong>. Please perform a manual
                  weigh-in to generate the accurate receipt for the customer.
                </p>
              </div>

              {/* ── Section 1: Customer's Booking (read-only) ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    Customer's Booking (Read-Only)
                  </p>
                </div>
                <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
                  <BookingField label="Service" value={order.serviceName || "—"} />
                  <BookingField label="Payment Method" value={order.paymentMethod || "Cash"} />
                  <BookingField
                    label="Detergent"
                    value={
                      order.detergent && order.detergent.toLowerCase() !== "none"
                        ? `${order.detergent} ×${order.detergentQuantity ?? 1}`
                        : "None"
                    }
                  />
                  <BookingField
                    label="Conditioner"
                    value={
                      order.conditioner && order.conditioner.toLowerCase() !== "none"
                        ? `${order.conditioner} ×${order.conditionerQuantity ?? 1}`
                        : "None"
                    }
                  />
                </div>
                {(order.rushPrice ?? 0) > 0 && (
                  <div className="mx-5 mb-5 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                    <Zap className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs font-bold text-amber-700">
                      Rush Order — ₱150 per load will be added
                    </p>
                  </div>
                )}
              </div>

              {/* ── Section 2: Staff Input ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                    Staff Input
                  </p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Weight input */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Actual Weight (KG) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          ref={weightInputRef}
                          type="number"
                          min="5"
                          step="0.1"
                          value={actualWeightRaw}
                          placeholder="0.0"
                          onChange={(e) => setActualWeightRaw(e.target.value)}
                          className={`w-full h-14 text-center text-3xl font-black border-2 rounded-xl bg-white focus:outline-none [appearance:textfield] transition-all ${
                            showWeightError
                              ? "border-red-400 focus:border-red-500 bg-red-50"
                              : weightValid
                              ? "border-blue-400 focus:border-blue-600"
                              : "border-slate-200 focus:border-blue-500"
                          }`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase tracking-widest">
                          KG
                        </span>
                      </div>
                      <AnimatePresence>
                        {showWeightError && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-[10px] font-bold text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            Minimum 5 kg per order
                          </motion.p>
                        )}
                        {!showWeightError && (
                          <p className="text-[10px] text-slate-400">Minimum 5 kg per order</p>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Load type */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Load Type <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={loadType}
                        onValueChange={(v) => setLoadType(v as LoadType)}
                      >
                        <SelectTrigger className="h-14 border-2 border-slate-200 rounded-xl font-bold text-sm focus:border-blue-500 focus:ring-0 bg-white w-full">
                          <div className="truncate pr-4 text-left">
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PURE_CLOTHES">
                            <div>
                              <p className="font-bold">Pure clothes</p>
                              <p className="text-[10px] text-slate-400">max 8 kg/load</p>
                            </div>
                          </SelectItem>
                          <SelectItem value="WITH_TOWELS">
                            <div>
                              <p className="font-bold">With towels / beddings</p>
                              <p className="text-[10px] text-slate-400">max 7 kg/load</p>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-slate-400">
                        Load type affects max kg per load and final price
                      </p>
                    </div>
                  </div>

                  {/* Supplies Adjustment */}
                  <div className="grid grid-cols-2 gap-4">
                    {(() => {
                      const detMax = getAvailQty(order.detergent);
                      const conMax = getAvailQty(order.conditioner);
                      const detAtMax = detQty >= detMax;
                      const conAtMax = conQty >= conMax;
                      return (
                        <>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Detergent Qty ({order.detergent || "None"})
                              {order.detergent && order.detergent.toLowerCase() !== "none" && detMax < 999 && (
                                <span className="ml-1 font-normal text-slate-400 normal-case tracking-normal">— {detMax} in stock</span>
                              )}
                            </label>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" className="h-10 w-10 rounded-lg font-black"
                                onClick={() => setDetQty(Math.max(0, detQty - 1))}>–</Button>
                              <Input type="number" value={detQty} readOnly
                                className="h-10 text-center font-bold border-2 border-slate-100 rounded-lg pointer-events-none" />
                              <Button variant="outline" size="sm" className="h-10 w-10 rounded-lg font-black"
                                onClick={() => setDetQty(Math.min(detMax, detQty + 1))}
                                disabled={detAtMax} title={detAtMax ? `Max stock: ${detMax}` : undefined}>+</Button>
                            </div>
                            {detAtMax && detMax < 999 && <p className="text-[10px] text-rose-500 font-bold">Maximum available stock reached.</p>}
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Fabcon Qty ({order.conditioner || "None"})
                              {order.conditioner && order.conditioner.toLowerCase() !== "none" && conMax < 999 && (
                                <span className="ml-1 font-normal text-slate-400 normal-case tracking-normal">— {conMax} in stock</span>
                              )}
                            </label>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" className="h-10 w-10 rounded-lg font-black"
                                onClick={() => setConQty(Math.max(0, conQty - 1))}>–</Button>
                              <Input type="number" value={conQty} readOnly
                                className="h-10 text-center font-bold border-2 border-slate-100 rounded-lg pointer-events-none" />
                              <Button variant="outline" size="sm" className="h-10 w-10 rounded-lg font-black"
                                onClick={() => setConQty(Math.min(conMax, conQty + 1))}
                                disabled={conAtMax} title={conAtMax ? `Max stock: ${conMax}` : undefined}>+</Button>
                            </div>
                            {conAtMax && conMax < 999 && <p className="text-[10px] text-rose-500 font-bold">Maximum available stock reached.</p>}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {pricing && pricing.numberOfLoads > detQty && (
                    <p className="text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg flex items-center gap-2">
                      <Info className="h-3 w-3" />
                      Tip: Suggested {pricing.numberOfLoads} packs for {pricing.numberOfLoads} loads
                    </p>
                  )}

                  {/* Delivery fee & Adjustment row */}
                  <div className="grid grid-cols-2 gap-4">
                    {order.serviceType === "PICKUP_DELIVERY" && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Delivery Fee (₱)
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">₱</span>
                          <Input
                            type="number" min="0" step="5"
                            value={deliveryFeeRaw}
                            onChange={(e) => setDeliveryFeeRaw(e.target.value)}
                            className="h-12 pl-8 border-2 border-slate-200 rounded-xl font-bold focus-visible:ring-0 focus-visible:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Manual Adjustment (₱)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">±</span>
                        <Input
                          type="number" step="5"
                          value={manualAdjustmentRaw}
                          placeholder="0"
                          onChange={(e) => setManualAdjustmentRaw(e.target.value)}
                          className="h-12 pl-8 border-2 border-slate-200 rounded-xl font-bold focus-visible:ring-0 focus-visible:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Staff Notes */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Staff Remarks / Notes
                    </label>
                    <textarea
                      value={staffNotes}
                      onChange={(e) => setStaffNotes(e.target.value)}
                      placeholder="Add any internal remarks or special notes for the customer..."
                      className="w-full h-24 p-4 border-2 border-slate-200 rounded-xl font-medium text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* ── NUMBER OF LOADS HERO ── */}
              <AnimatePresence>
                {pricing ? (
                  <motion.div
                    key="loads-active"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="bg-blue-600 rounded-2xl p-6 text-center relative overflow-hidden shadow-lg"
                  >
                    {/* background decoration */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white" />
                      <div className="absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white" />
                    </div>
                    <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1 relative z-10">
                      Number of Loads
                    </p>
                    <p className="text-8xl font-black text-white tabular-nums leading-none relative z-10">
                      {pricing.numberOfLoads}
                    </p>
                    <p className="text-sm font-bold text-blue-200 mt-2 relative z-10">
                      {actualKg} kg ÷ {pricing.maxKgPerLoad} kg/load
                    </p>
                    {pricing.madnessFee > 0 && (
                      <Badge className="mt-3 bg-orange-500 hover:bg-orange-500 text-white font-bold relative z-10">
                        +{pricing.madnessKg.toFixed(1)} kg madness surcharge
                      </Badge>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="loads-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center"
                  >
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Number of Loads
                    </p>
                    <p className="text-5xl font-black text-slate-300">—</p>
                    <p className="text-xs text-slate-400 mt-1">Enter weight to calculate</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Price Breakdown table ── */}
              <AnimatePresence>
                {pricing && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Receipt className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
                          Price Breakdown
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Full itemized computation — updates in real time
                        </p>
                      </div>
                    </div>

                    <div className="p-5">
                      <table className="w-full">
                        <tbody className="divide-y divide-slate-50">
                          {/* Service */}
                          <BreakdownRow
                            label={order.serviceName || "Service"}
                            sub={`₱${pricing.pricePerLoad} × ${
                              pricing.isHandwash
                                ? `${actualKg} kg`
                                : `${pricing.numberOfLoads} load${pricing.numberOfLoads !== 1 ? "s" : ""}`
                            }`}
                            amount={pricing.serviceTotal}
                          />

                          {/* Madness */}
                          {pricing.madnessFee > 0 && (
                            <BreakdownRow
                              label="Madness surcharge"
                              sub={`(${actualKg}kg - ${pricing.numberOfLoads * pricing.baseServiceLimit}kg capacity) × ₱50`}
                              amount={pricing.madnessFee}
                              className="text-orange-600"
                            />
                          )}

                          {/* Detergent */}
                          {pricing.detCost > 0 && (
                            <BreakdownRow
                              label={`${order.detergent} detergent`}
                              sub={`₱${pricing.detPPP} × ${pricing.detQty} pack${pricing.detQty !== 1 ? "s" : ""}`}
                              amount={pricing.detCost}
                            />
                          )}

                          {/* Conditioner */}
                          {pricing.conCost > 0 && (
                            <BreakdownRow
                              label={`${order.conditioner} conditioner`}
                              sub={`₱${pricing.conPPP} × ${pricing.conQty} pack${pricing.conQty !== 1 ? "s" : ""}`}
                              amount={pricing.conCost}
                            />
                          )}

                          {/* Rush */}
                          {pricing.rushFee > 0 && (
                            <BreakdownRow
                              label="⚡ Rush service fee"
                              sub={`₱150/load × ${pricing.numberOfLoads} load${pricing.numberOfLoads !== 1 ? "s" : ""}`}
                              amount={pricing.rushFee}
                              className="text-amber-600"
                            />
                          )}

                          {/* Delivery */}
                          {deliveryFee > 0 && (
                            <BreakdownRow
                              label="Delivery fee"
                              sub="Location-based rate"
                              amount={deliveryFee}
                            />
                          )}

                          {/* Pickup */}
                          {pricing.pickupFee > 0 && (
                            <BreakdownRow
                              label="Pickup fee"
                              amount={pricing.pickupFee}
                            />
                          )}

                          {/* Convenience */}
                          <BreakdownRow
                            label="Convenience fee"
                            sub="Online booking system fee"
                            amount={pricing.convenienceFee}
                            className="text-slate-500"
                          />

                          {/* Adjustment */}
                          {pricing.manualAdjustment !== 0 && (
                            <BreakdownRow
                              label="Manual adjustment"
                              sub="Custom discount/surcharge applied"
                              amount={pricing.manualAdjustment}
                              className={pricing.manualAdjustment < 0 ? "text-emerald-600" : "text-blue-600"}
                            />
                          )}
                        </tbody>
                      </table>

                      <Separator className="my-3" />

                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">Total Amount Due</span>
                        <motion.span
                          key={pricing.grandTotal}
                          initial={{ scale: 1.1, color: "#2563eb" }}
                          animate={{ scale: 1, color: "#1d4ed8" }}
                          className="text-2xl font-black text-blue-700 font-mono tabular-nums"
                        >
                          {fmt(pricing.grandTotal)}
                        </motion.span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* RIGHT PANEL ─ Receipt preview */}
          <div className="w-[360px] shrink-0 flex flex-col bg-[#F8F7F5] border-l border-slate-200 overflow-hidden">
            {/* Panel header */}
            <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Live Receipt Preview
              </p>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[9px] text-blue-600 font-black uppercase tracking-wide">
                  Live
                </span>
              </div>
            </div>

            {/* Dashed top border on receipt */}
            <div className="mx-5 mt-4 border-t-2 border-dashed border-slate-300" />

            {/* Scrollable receipt body */}
            <ScrollArea className="flex-1">
              <ReceiptPreview
                order={order}
                actualKg={actualKg}
                loadType={loadType}
                pricing={pricing}
                deliveryFee={deliveryFee}
                manualAdjustment={manualAdjustment}
                staffNotes={staffNotes}
              />
            </ScrollArea>

            {/* Dashed bottom border + action buttons */}
            <div className="shrink-0">
              <div className="mx-5 border-b-2 border-dashed border-slate-300" />
              <div className="p-5 bg-white border-t border-slate-100 space-y-2.5">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !weightValid}
                  className="w-full h-14 bg-slate-900 hover:bg-blue-600 text-white font-black rounded-2xl text-sm transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Send Receipt to Customer
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl font-bold text-slate-500 hover:text-slate-700"
                  onClick={() => {
                    if (pricing) {
                      printOrderReceipt({
                        orderId: order.orderId,
                        customerName: order.customerName,
                        customerPhone: order.customerPhone,
                        branch: order.branch,
                        serviceType: order.serviceType,
                        serviceName: order.serviceName,
                        estimatedWeightKg: order.estimatedWeightKg,
                        actualWeightKg: actualKg,
                        detergent: order.detergent,
                        detergentQuantity: detQty,
                        conditioner: order.conditioner,
                        conditionerQuantity: conQty,
                        rushPrice: order.rushPrice,
                        deliveryPrice: deliveryFee,
                        servicePrice: pricing.serviceTotal,
                        systemFee: pricing.convenienceFee,
                        finalPrice: pricing.grandTotal,
                        paymentMethod: order.paymentMethod,
                      });
                    }
                  }}
                  disabled={!pricing}
                >
                  <Printer className="h-4 w-4 mr-2" /> Print Receipt
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl font-bold text-slate-500 hover:text-slate-700"
                  onClick={onCancel}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Breakdown row ──────────────────────────────────────────────────────────────

function BreakdownRow({
  label,
  sub,
  amount,
  className = "text-slate-800",
}: {
  label: string;
  sub?: string;
  amount: number;
  className?: string;
}) {
  return (
    <tr>
      <td className="py-2.5 pr-4">
        <p className={`text-sm font-medium ${className}`}>{label}</p>
        {sub && (
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sub}</p>
        )}
      </td>
      <td className="py-2.5 text-right">
        <span className={`font-mono text-sm font-semibold ${className}`}>
          {fmt(amount)}
        </span>
      </td>
    </tr>
  );
}

// ── BookingField ──────────────────────────────────────────────────────────────

function BookingField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
