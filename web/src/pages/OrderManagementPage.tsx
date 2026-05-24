import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  Info,
  Eye,
  Filter,
  HelpCircle,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  Search,
  Star,
  Trash2,
  User,
} from "lucide-react";

import {
  ordersApi,
  deliveriesApi,
  feedbackApi,
  usersApi,
  paymentsApi,
  type CreateOrderPayload,
  type FeedbackResponse,
  type JobOrderResponse,
  type UpdateOrderPayload,
  type UserAdminRecord,
} from "@/lib/api";
import { FinalizeWeightModal, type FinalizeOrderData } from "@/components/FinalizeWeightModal";
import { printOrderReceipt, downloadOrderReceipt } from "@/lib/receiptPrinter";
import logoLaundryHubs from "@/assets/logo-laundryhubs.webp";
import logoSpeedyWash from "@/assets/logo-speedywash.webp";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getSessionUser } from "@/lib/session";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ApiOrderStatus = "PENDING" | "ORDER_RECEIVED" | "AWAITING_PRICE_CONFIRMATION" | "PRICE_CONFIRMED" | "WASHING" | "DRYING" | "READY" | "ASSIGNED_FOR_DELIVERY" | "EN_ROUTE_TO_BRANCH" | "PICKED_UP_FROM_BRANCH" | "OUT_FOR_DELIVERY" | "DELIVERED" | "COLLECTION_FAILED" | "CANCELLED" | "FAILED";
type ApiServiceType = "DROP_OFF" | "PICKUP_DELIVERY";

type Order = {
  id: number;
  orderId: string;
  customerName: string;
  serviceType: ApiServiceType;
  branch: string;
  status: ApiOrderStatus;
  priceConfirmedByCustomer?: boolean;
  createdAt: string;
  updatedAt: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress?: string;
  loadSize?: string;
  estimatedWeightKg: number;
  actualWeightKg?: number;
  confirmedPrice?: number;
  priceConfirmationDeadline?: string;
  specialInstructions?: string;
  paymentMethod?: string;
  paymentStatus?: "PENDING" | "VERIFIED" | "REJECTED" | "PAID" | null;
  isPaid?: boolean;
  totalPrice?: number;
  servicePrice?: number;
  rushPrice?: number;
  suppliesPrice?: number;
  deliveryPrice?: number;
  systemFee?: number;
  extraWeightCost?: number;
  detergentBreakdown?: string;
  fabricConditionerBreakdown?: string;
  finalPrice?: number;
  serviceName?: string;
  detergent?: string;
  detergentQuantity?: number;
  conditioner?: string;
  conditionerQuantity?: number;
  assignedDriverId?: number | null;
  assignedDriverName?: string | null;
  assignedDriverPhone?: string | null;
  assignedAt?: string | null;
  pickupConfirmedAt?: string | null;
  deliveredAt?: string | null;
  codCollected?: boolean;
  codCollectedAt?: string | null;
  deliveryFailedReason?: string | null;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  bookingDate?: string;
  slotStartTime?: string;
  slotEndTime?: string;
};

type DeliveryAssignmentMeta = {
  driverName: string;
  status: string;
};

const statusLabel: Record<ApiOrderStatus, string> = {
  PENDING: "Pending Booking",
  ORDER_RECEIVED: "Received at Branch",
  AWAITING_PRICE_CONFIRMATION: "Waiting for Customer",
  PRICE_CONFIRMED: "Price Approved",
  WASHING: "Washing",
  DRYING: "Drying",
  READY: "Ready for Pickup",
  ASSIGNED_FOR_DELIVERY: "Assigned",
  EN_ROUTE_TO_BRANCH: "Heading to branch",
  PICKED_UP_FROM_BRANCH: "Picked up",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  COLLECTION_FAILED: "Delivery failed",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

const getAllowedStatusTransitions = (status: ApiOrderStatus): ApiOrderStatus[] => {
  switch (status) {
    case "PENDING":
      return ["ORDER_RECEIVED"];
    case "ORDER_RECEIVED":
      return ["AWAITING_PRICE_CONFIRMATION"];
    case "AWAITING_PRICE_CONFIRMATION":
      return ["PRICE_CONFIRMED"];
    case "PRICE_CONFIRMED":
      return ["WASHING"];
    case "WASHING":
      return ["DRYING"];
    case "DRYING":
      return ["READY"];
    case "READY":
      return ["OUT_FOR_DELIVERY"];
    case "OUT_FOR_DELIVERY":
      return ["DELIVERED"];
    default:
      return [];
  }
};

const isAwaitingPriceConfirmation = (order: Order) =>
  order.status === "AWAITING_PRICE_CONFIRMATION";

const isPriceApproved = (order: Order) =>
  order.status === "PRICE_CONFIRMED";

const isEscalated = (order: Order) => {
  if (!isAwaitingPriceConfirmation(order)) return false;
  if (!order.priceConfirmationDeadline) return false;
  // Flag as escalated if deadline is within 30 minutes
  return new Date(order.priceConfirmationDeadline).getTime() - Date.now() < 30 * 60 * 1000;
};

const statusBadgeVariant = (status: ApiOrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "DELIVERED") return "default";
  if (status === "CANCELLED" || status === "FAILED") return "destructive";
  if (status === "PRICE_CONFIRMED" || status === "PENDING") return "outline";
  return "secondary";
};

const renderStatusBadge = (status: ApiOrderStatus) => {
  const label = statusLabel[status] || status;

  if (status === "WASHING" || status === "DRYING") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
      </div>
    );
  }

  if (status === "PRICE_CONFIRMED") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-tight">Awaiting Confirmation</span>
      </div>
    );
  }

  if (status === "ORDER_RECEIVED") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
      </div>
    );
  }

  if (status === "AWAITING_PRICE_CONFIRMATION") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-100 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
      </div>
    );
  }

  if (status === "READY") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
    );
  }

  if (status === "OUT_FOR_DELIVERY") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-white border border-slate-700 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-tight">Delivering</span>
      </div>
    );
  }

  if (status === "DELIVERED" || status === "COMPLETED" as any) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 w-fit opacity-80">
        <CheckCircle2 className="h-3 w-3" />
        <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-50 text-yellow-700 border border-yellow-200 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
      </div>
    );
  }

  if (status === "ASSIGNED_FOR_DELIVERY" || status === "EN_ROUTE_TO_BRANCH" || status === "PICKED_UP_FROM_BRANCH") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
      </div>
    );
  }

  if (status === "COLLECTION_FAILED") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
      </div>
    );
  }

  if (status === "CANCELLED" || status === "FAILED") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 w-fit">
        <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
        <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 w-fit">
      <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
    </div>
  );
};

const serviceTypeLabel: Record<ApiServiceType, string> = {
  DROP_OFF: "Drop Off",
  PICKUP_DELIVERY: "Pickup & Delivery",
};

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const ORDERS_SERVER_PAGE_SIZE = 60;
const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 30];

const mapOrder = (order: JobOrderResponse): Order => ({
  id: order.id,
  orderId: order.trackingNumber,
  customerName: order.customerName,
  serviceType: order.serviceType,
  branch: order.branch || "Unassigned",
  status: order.status as ApiOrderStatus,
  priceConfirmedByCustomer: order.priceConfirmedByCustomer,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  customerPhone: order.customerPhone || "-",
  customerEmail: order.customerEmail || "",
  deliveryAddress: order.deliveryAddress || "",
  estimatedWeightKg: Number(order.estimatedWeightKg || 0),
  actualWeightKg: order.actualWeightKg != null ? Number(order.actualWeightKg) : undefined,
  confirmedPrice: order.confirmedPrice != null ? Number(order.confirmedPrice) : undefined,
  priceConfirmationDeadline: (order as any).priceConfirmationDeadline ?? undefined,
  specialInstructions: order.specialInstructions,
  detergent: order.detergentPreference,
  detergentQuantity: order.detergentQuantity,
  conditioner: order.fabricConditionerPreference,
  conditionerQuantity: order.conditionerQuantity,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  isPaid: order.isPaid,
  totalPrice: order.totalPrice || 0,
  servicePrice: order.servicePrice != null ? Number(order.servicePrice) : undefined,
  rushPrice: order.rushPrice != null ? Number(order.rushPrice) : undefined,
  suppliesPrice: order.suppliesPrice != null ? Number(order.suppliesPrice) : undefined,
  deliveryPrice: order.deliveryPrice != null ? Number(order.deliveryPrice) : undefined,
  systemFee: order.systemFee != null ? Number(order.systemFee) : undefined,
  extraWeightCost: order.extraWeightCost != null ? Number(order.extraWeightCost) : undefined,
  detergentBreakdown: order.detergentBreakdown ?? undefined,
  fabricConditionerBreakdown: order.fabricConditionerBreakdown ?? undefined,
  finalPrice: order.finalPrice != null ? Number(order.finalPrice) : undefined,
  serviceName: order.serviceName,
  assignedDriverId: order.assignedDriverId,
  assignedDriverName: order.assignedDriverName,
  assignedDriverPhone: order.assignedDriverPhone,
  assignedAt: order.assignedAt,
  pickupConfirmedAt: order.pickupConfirmedAt,
  deliveredAt: order.deliveredAt,
  codCollected: order.codCollected,
  codCollectedAt: order.codCollectedAt,
  deliveryFailedReason: order.deliveryFailedReason,
  deliveryContactName: order.deliveryContactName,
  deliveryContactPhone: order.deliveryContactPhone,
  bookingDate: order.bookingDate ?? undefined,
  slotStartTime: order.slotStartTime ?? undefined,
  slotEndTime: order.slotEndTime ?? undefined,
});

const formatDateTime = (timestamp?: string) =>
  timestamp
    ? new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    })
    : "-";

const formatBookingDate = (dateStr?: string) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", weekday: "short" });
  } catch { return dateStr; }
};

const formatSlotTime = (start?: string, end?: string) => {
  if (!start) return null;
  const to12h = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
  };
  return end ? `${to12h(start)} – ${to12h(end)}` : to12h(start);
};

const isBookingFutureDate = (dateStr?: string) => {
  if (!dateStr) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(dateStr) > today;
};

const normalizePaymentMethod = (value?: string | null) => (value || "").trim().toUpperCase();

const isOnlinePaymentMethod = (value?: string | null) => {
  const method = normalizePaymentMethod(value);
  return method.includes("GCASH") || method.includes("MAYA") || method.includes("EWALLET") || method.includes("ONLINE");
};

const isCashPaymentMethod = (value?: string | null) => normalizePaymentMethod(value).includes("CASH");

const resolvePaymentStatusLabel = (order: Order) => {
  if (order.paymentStatus) return order.paymentStatus;
  return order.isPaid ? "PAID" : "PENDING";
};

const resolveDeliveryStatusLabel = (status?: string) => {
  const normalized = String(status || "").toUpperCase();
  const labels: Record<string, string> = {
    ASSIGNED_PICKUP: "Accepted Pickup",
    PENDING_PICKUP: "Pending Pickup",
    ARRIVED_CUSTOMER: "At Customer",
    PICKED_UP: "Picked Up",
    ARRIVED_BRANCH: "At Branch",
    HANDED_TO_BRANCH: "At Shop",
    ASSIGNED_DELIVERY: "Ready for Delivery",
    OUT_FOR_DELIVERY: "Out for Delivery",
    ARRIVED_DELIVERY: "Arrived Delivery",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    FAILED: "Failed",
  };
  return labels[normalized] || "Unassigned";
};

const emptyCreateForm: CreateOrderPayload = {
  customerName: "",
  serviceType: "DROP_OFF",
  branch: "",
  customerPhone: "",
  customerEmail: "",
  deliveryAddress: "",
  deliveryContactName: "",
  deliveryContactPhone: "",
  paymentMethod: "CASH",
};

export default function OrderManagementPage() {
  const currentUser = getSessionUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const staffBranch = currentUser?.branch || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [codCollecting, setCodCollecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);
  const [filterBranch, setFilterBranch] = useState(isAdmin ? "" : staffBranch);
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  const [ordersPage, setOrdersPage] = useState(1);
  const [totalOrdersPages, setTotalOrdersPages] = useState(1);
  const [hasNextOrders, setHasNextOrders] = useState(false);
  const [hasPreviousOrders, setHasPreviousOrders] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrderPayload>({
    ...emptyCreateForm,
    branch: isAdmin ? "" : staffBranch,
  });

  // Set Price modal state
  const [setPriceOpen, setSetPriceOpen] = useState(false);
  const [setPriceOrderId, setSetPriceOrderId] = useState<number | null>(null);
  const [setPriceSubmitting, setSetPriceSubmitting] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  // Rider Assignment state
  const [assignRiderOpen, setAssignRiderOpen] = useState(false);
  const [assignRiderOrderId, setAssignRiderOrderId] = useState<number | null>(null);
  const [assignRiderSubmitting, setAssignRiderSubmitting] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<UserAdminRecord[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [assignmentMode, setAssignmentMode] = useState<'pickup' | 'delivery'>('delivery');

  const openAssignRiderModal = async (order: Order, mode: 'pickup' | 'delivery' = 'delivery') => {
    setAssignRiderOrderId(order.id);
    setAssignmentMode(mode);
    setAssignRiderOpen(true);
    setAssignRiderSubmitting(true);
    try {
      const drivers = await usersApi.listDrivers(order.branch);
      setAvailableDrivers(drivers);
    } catch (err) {
      console.error("Failed to fetch drivers", err);
      toast.error("Failed to load available drivers.");
    } finally {
      setAssignRiderSubmitting(false);
    }
  };

  const submitAssignRider = async () => {
    if (!assignRiderOrderId || !selectedDriverId) return;
    const driver = availableDrivers.find(d => d.id === parseInt(selectedDriverId));
    if (!driver) return;

    setAssignRiderSubmitting(true);
    try {
      if (assignmentMode === 'pickup') {
        await ordersApi.assignPickupRider(assignRiderOrderId, { driverId: driver.id });
        toast.success(`Pickup rider ${driver.fullName} assigned successfully!`);
      } else {
        await ordersApi.assignDeliveryRider(assignRiderOrderId, { driverId: driver.id });
        toast.success(`Delivery rider ${driver.fullName} assigned successfully!`);
      }

      setAssignRiderOpen(false);
      setSelectedDriverId("");
      await loadOrders(Math.max(0, ordersPage - 1), true);

      // Update side panel if needed
      if (selectedOrder && selectedOrder.id === assignRiderOrderId) {
        const refreshed = await ordersApi.getById(assignRiderOrderId);
        setSelectedOrder(mapOrder(refreshed));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign rider.");
    } finally {
      setAssignRiderSubmitting(false);
    }
  };

  // Pricing helpers moved to @/lib/pricingUtils — computeOrderPricing is imported via FinalizeWeightModal

  const openSetPriceModal = (order: Order) => {
    setSetPriceOrderId(order.id);
    setSetPriceOpen(true);
  };

  const submitSetPrice = async (params: {
    actualWeightKg: number;
    finalPrice: number;
    deliveryFee: number;
    detergentQuantity?: number;
    conditionerQuantity?: number;
  }) => {
    if (!setPriceOrderId) return;
    setSetPriceSubmitting(true);
    try {
      await ordersApi.setActualWeight(setPriceOrderId, {
        actualWeightKg: params.actualWeightKg,
        finalPrice: params.finalPrice,
        deliveryFee: params.deliveryFee,
        detergentQuantity: params.detergentQuantity,
        conditionerQuantity: params.conditionerQuantity,
      });
      toast.success("Receipt sent to the customer");
      setSetPriceOpen(false);
      await loadOrders(Math.max(0, ordersPage - 1), true);
      if (selectedOrder && selectedOrder.id === setPriceOrderId) {
        const refreshed = await ordersApi.getById(setPriceOrderId);
        setSelectedOrder(mapOrder(refreshed));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to send receipt.");
    } finally {
      setSetPriceSubmitting(false);
    }
  };

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState<UpdateOrderPayload>({
    customerName: "",
    serviceType: "DROP_OFF",
    branch: "",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const [deliveryMetaByTracking, setDeliveryMetaByTracking] = useState<Record<string, DeliveryAssignmentMeta>>({});

  const loadOrders = useCallback(async (requestedPage = 0, silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const response = await ordersApi.listPaged({
        page: requestedPage,
        size: ORDERS_SERVER_PAGE_SIZE,
        sort: "updatedAt",
        direction: "desc",
        branch: isAdmin ? (filterBranch || undefined) : (staffBranch || undefined),
        search: debouncedSearchQuery.trim() || undefined,
        paymentStatus: filterPaymentStatus || undefined,
        paymentMethod: filterPaymentMethod || undefined,
      });
      setOrders((response.content || []).map(mapOrder));
      setOrdersPage((response.page || 0) + 1);
      setTotalOrders(response.totalElements || 0);
      setTotalOrdersPages(Math.max(1, response.totalPages || 1));
      setHasNextOrders(Boolean(response.hasNext));
      setHasPreviousOrders(Boolean(response.hasPrevious));
      setLastRefreshed(new Date());
    } catch (err: any) {
      const message = err?.message || "Unable to load orders.";
      setError(message);
      setOrders([]);
      setOrdersPage(1);
      setTotalOrders(0);
      setTotalOrdersPages(1);
      setHasNextOrders(false);
      setHasPreviousOrders(false);
      if (!silent) toast.error(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAdmin, staffBranch, filterBranch, debouncedSearchQuery, filterPaymentStatus, filterPaymentMethod]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadOrders(Math.max(0, ordersPage - 1), true);
    setRefreshing(false);
  };

  const handleExportCsv = async () => {
    try {
      const csv = await ordersApi.exportCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `washalert-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed.";
      toast.error(msg);
    }
  };

  useEffect(() => {
    setOrdersPage(1);
    void loadOrders(0, false);
  }, [loadOrders]);

  useEffect(() => {
    // Poll frequently so webhook-confirmed payment updates surface quickly in Order Management.
    autoRefreshRef.current = setInterval(() => {
      void loadOrders(Math.max(0, ordersPage - 1), true);
    }, 5000); // 5s polling for near real-time updates

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [loadOrders, ordersPage]);

  const applyStatusUpdate = async (order: Order, codCollected?: boolean) => {
    let currentOrder = order;

    const allowed = getAllowedStatusTransitions(currentOrder.status);
    const fallbackStatus = allowed[0];
    const nextStatus = fallbackStatus || currentOrder.status;

    // Check if GCash payment is pending verification (only for statuses that require payment)
    const isGcash = currentOrder.paymentMethod?.toUpperCase().includes("GCASH");
    let isUnpaidGcash = isGcash && !currentOrder.isPaid;
    const requiresPaymentVerification = nextStatus === "WASHING" || nextStatus === "DELIVERED";

    if (isUnpaidGcash && requiresPaymentVerification) {
      setStatusUpdatingId(currentOrder.id);
      try {
        toast.info("Verifying GCash payment status with PayMongo...");
        const trackRes = await paymentsApi.track(currentOrder.trackingNumber);
        if (trackRes && (trackRes.status === "PAID" || trackRes.status === "VERIFIED")) {
          // Re-fetch since backend tracking updated it in database
          const freshOrder = await ordersApi.getById(currentOrder.id);
          const mapped = mapOrder(freshOrder);
          setOrders((prev) => prev.map((o) => (o.id === mapped.id ? mapped : o)));
          setSelectedOrder(mapped);
          
          currentOrder = mapped;
          isUnpaidGcash = isGcash && !currentOrder.isPaid;
          toast.success("GCash payment successfully verified!");
        } else {
          toast.info("GCash payment could not be automatically verified yet.");
        }
      } catch (err: any) {
        console.error("Failed to track payment status:", err);
      } finally {
        setStatusUpdatingId(null);
      }
    }

    // If the order already transitioned to or past the target state (e.g. from PRICE_CONFIRMED to WASHING automatically via track payment)
    if (nextStatus === currentOrder.status) {
      await loadOrders(Math.max(0, ordersPage - 1), true);
      return;
    }

    if (!allowed.includes(nextStatus)) {
      toast.error(`Invalid transition from ${statusLabel[currentOrder.status]} to ${statusLabel[nextStatus]}.`);
      return;
    }

    const washingPaymentBlocked = nextStatus === "WASHING" && isUnpaidGcash;
    const deliveryPaymentBlocked = nextStatus === "DELIVERED" && isUnpaidGcash;

    if (washingPaymentBlocked || deliveryPaymentBlocked) {
      const confirmManualPay = window.confirm(
        `GCash payment for order ${currentOrder.orderId} has not been verified yet.\n\n` +
        `Do you want to confirm this payment manually and proceed to ${statusLabel[nextStatus]}?`
      );
      if (confirmManualPay) {
        setStatusUpdatingId(currentOrder.id);
        try {
          // First mark as paid
          const updatedPay = await ordersApi.markAsPaid(currentOrder.id);
          toast.success(`Payment manually marked as Paid for ${currentOrder.orderId}.`);
          
          // Then update status
          const updated = await ordersApi.updateStatus(currentOrder.id, nextStatus, codCollected);
          const mapped = mapOrder(updated);
          setOrders((prev) => prev.map((o) => (o.id === mapped.id ? mapped : o)));
          setSelectedOrder(mapped);
          toast.success(`Order ${updated.trackingNumber} moved to ${statusLabel[mapped.status]}.`);
          await loadOrders(Math.max(0, ordersPage - 1), true);
        } catch (err: any) {
          toast.error(err?.message || "Failed to confirm payment and update status.");
          await loadOrders(Math.max(0, ordersPage - 1), true);
        } finally {
          setStatusUpdatingId(null);
        }
      }
      return;
    }

    setStatusUpdatingId(currentOrder.id);
    try {
      const updated = await ordersApi.updateStatus(currentOrder.id, nextStatus, codCollected);
      const mapped = mapOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === mapped.id ? mapped : o)));
      setSelectedOrder(mapped);
      toast.success(`Order ${updated.trackingNumber} moved to ${statusLabel[mapped.status]}.`);
      await loadOrders(Math.max(0, ordersPage - 1), true);
    } catch (err: any) {
      const isTransitionError = err?.status === 409 || err?.status === 400;
      toast.error(
        isTransitionError
          ? err?.message || "Status transition was rejected. Refreshing orders..."
          : err?.message || "Unable to update order status.",
      );
      await loadOrders(Math.max(0, ordersPage - 1), true);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleCollectCod = async (order: Order) => {
    if (codCollecting) return;
    setCodCollecting(true);
    try {
      const delivery = await deliveriesApi.track(order.trackingNumber);
      await deliveriesApi.collectCod(delivery.id);
      await loadOrders(Math.max(0, ordersPage - 1), true);
      toast.success(`Cash collected for order ${order.trackingNumber}.`);
    } catch (err: any) {
      toast.error(err?.message || "Unable to record COD collection.");
    } finally {
      setCodCollecting(false);
    }
  };

  const openCreateModal = () => {
    setCreateForm({ ...emptyCreateForm, branch: isAdmin ? "" : staffBranch });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!createForm.customerName.trim() || !createForm.branch.trim()) {
      toast.error("Customer name and branch are required.");
      return;
    }

    if (createForm.serviceType === 'PICKUP_DELIVERY' && !createForm.deliveryAddress.trim()) {
      toast.error("Delivery address is required for Pickup & Delivery orders.");
      return;
    }

    setCreateSubmitting(true);
    try {
      const created = await ordersApi.create({
        customerName: createForm.customerName.trim(),
        serviceType: createForm.serviceType,
        branch: createForm.branch.trim(),
        customerPhone: createForm.customerPhone.trim(),
        customerEmail: createForm.customerEmail.trim(),
        deliveryAddress: createForm.deliveryAddress.trim(),
        deliveryContactName: createForm.deliveryContactName.trim() || undefined,
        deliveryContactPhone: createForm.deliveryContactPhone.trim() || undefined,
        paymentMethod: createForm.paymentMethod,
      });
      setOrders((prev) => [mapOrder(created), ...prev]);
      setCreateOpen(false);
      toast.success("Order created successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Unable to create order.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openDetails = async (orderId: number) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setFeedbackData(null);
    setStaffNoteInput("");
    try {
      let detail = await ordersApi.getById(orderId);
      let mapped = mapOrder(detail);

      // Auto-verify unpaid GCash payment when opening details to sync state
      const isGcash = mapped.paymentMethod?.toUpperCase().includes("GCASH");
      if (isGcash && !mapped.isPaid) {
        try {
          const trackRes = await paymentsApi.track(mapped.trackingNumber);
          if (trackRes && (trackRes.status === "PAID" || trackRes.status === "VERIFIED")) {
            // Re-fetch since backend tracking updated it in database
            detail = await ordersApi.getById(orderId);
            mapped = mapOrder(detail);
            toast.success("GCash payment verified successfully!");
            // Update orders list to reflect the verified payment status
            setOrders((prev) => prev.map((o) => (o.id === mapped.id ? mapped : o)));
          }
        } catch (trackErr) {
          console.error("Auto-tracking payment failed on details open:", trackErr);
        }
      }

      setSelectedOrder(mapped);
      if (mapped.status === "DELIVERED" || mapped.status === "READY") {
        void loadFeedback(mapped.orderId);
      }
    } catch (err: any) {
      const fallback = orders.find((o) => o.id === orderId) || null;
      setSelectedOrder(fallback);
      toast.error(err?.message || "Unable to load order details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const openEditModal = () => {
    if (!selectedOrder) return;
    setEditForm({
      customerName: selectedOrder.customerName,
      serviceType: selectedOrder.serviceType,
      branch: selectedOrder.branch,
      customerPhone: selectedOrder.customerPhone || "",
      customerEmail: selectedOrder.customerEmail || "",
      deliveryAddress: selectedOrder.deliveryAddress || "",
      deliveryContactName: selectedOrder.deliveryContactName || "",
      deliveryContactPhone: selectedOrder.deliveryContactPhone || "",
      paymentMethod: selectedOrder.paymentMethod || "CASH",
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!selectedOrder) return;
    if (!editForm.customerName.trim() || !editForm.branch.trim()) {
      toast.error("Customer name and branch are required.");
      return;
    }

    setEditSubmitting(true);
    try {
      const updated = await ordersApi.update(selectedOrder.id, {
        customerName: editForm.customerName.trim(),
        serviceType: editForm.serviceType,
        branch: editForm.branch.trim(),
        customerPhone: editForm.customerPhone?.trim(),
        customerEmail: editForm.customerEmail?.trim(),
        deliveryAddress: editForm.deliveryAddress?.trim(),
        deliveryContactName: editForm.deliveryContactName?.trim() || undefined,
        deliveryContactPhone: editForm.deliveryContactPhone?.trim() || undefined,
        paymentMethod: editForm.paymentMethod,
      });
      const mapped = mapOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === mapped.id ? mapped : o)));
      setSelectedOrder(mapped);
      setEditOpen(false);
      toast.success("Order updated successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Unable to update order.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitDelete = async () => {
    if (!selectedOrder) return;
    setDeleteSubmitting(true);
    try {
      await ordersApi.remove(selectedOrder.id);
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id));
      setDeleteOpen(false);
      setDetailsOpen(false);
      toast.success("Order deleted successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Unable to delete order.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const submitCancel = async () => {
    if (!selectedOrder) return;
    setCancelSubmitting(true);
    try {
      await ordersApi.cancel(selectedOrder.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: "CANCELLED" as any } : o)),
      );
      setDetailsOpen(false);
      toast.success("Order cancelled successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Unable to cancel order.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleManualMarkAsPaid = async (orderId: number) => {
    setMarkingPaidId(orderId);
    try {
      const updated = await ordersApi.markAsPaid(orderId);
      const mapped = mapOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === mapped.id ? mapped : o)));
      setSelectedOrder(mapped);
      toast.success("Payment manually marked as Paid successfully.");
      await loadOrders(Math.max(0, ordersPage - 1), true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark payment as paid.");
    } finally {
      setMarkingPaidId(null);
    }
  };

  const [feedbackData, setFeedbackData] = useState<FeedbackResponse | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [staffNoteInput, setStaffNoteInput] = useState("");
  const [staffNoteSubmitting, setStaffNoteSubmitting] = useState(false);

  const loadFeedback = useCallback(async (trackingNumber: string) => {
    setFeedbackLoading(true);
    try {
      const data = await feedbackApi.getForOrder(trackingNumber);
      setFeedbackData(data);
      setStaffNoteInput(data.staffNote ?? "");
    } catch {
      setFeedbackData(null);
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  const submitStaffNote = async () => {
    if (!selectedOrder) return;
    setStaffNoteSubmitting(true);
    try {
      await feedbackApi.submitStaffNote(selectedOrder.orderId, staffNoteInput);
      toast.success("Staff note saved.");
      void loadFeedback(selectedOrder.orderId);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save staff note.");
    } finally {
      setStaffNoteSubmitting(false);
    }
  };

  useEffect(() => {
    let active = true;
    const pickupDeliveryOrders = orders.filter((order) =>
      order.serviceType === "PICKUP_DELIVERY" &&
      !["PENDING", "ORDER_RECEIVED", "WASHING", "DRYING"].includes(order.status)
    );
    if (pickupDeliveryOrders.length === 0) {
      setDeliveryMetaByTracking({});
      return () => {
        active = false;
      };
    }

    (async () => {
      const results = await Promise.allSettled(
        pickupDeliveryOrders.map((order) => deliveriesApi.track(order.orderId)),
      );
      if (!active) return;

      const nextMeta: Record<string, DeliveryAssignmentMeta> = {};
      pickupDeliveryOrders.forEach((order, index) => {
        const result = results[index];
        if (result.status === "fulfilled" && result.value) {
          nextMeta[order.orderId] = {
            driverName: result.value.driverName?.trim() || "Unassigned",
            status: result.value.status || "UNASSIGNED",
          };
          return;
        }

        nextMeta[order.orderId] = {
          driverName: "Unassigned",
          status: "UNASSIGNED",
        };
      });
      setDeliveryMetaByTracking(nextMeta);
    })();

    return () => {
      active = false;
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = debouncedSearchQuery.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) =>
      [
        order.orderId,
        order.customerName,
        order.branch,
        statusLabel[order.status],
        resolvePaymentStatusLabel(order),
      ].some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [orders, debouncedSearchQuery]);

  useEffect(() => {
    setTablePage(1);
  }, [debouncedSearchQuery, filterBranch, filterPaymentMethod, filterPaymentStatus]);

  const uniqueBranches = useMemo(() => {
    // Dedupe by normalized (trimmed, lowercased) name so variant spellings collapse.
    const seen = new Map<string, string>(); // normalizedKey → canonical display name
    const allNames = orders.map((o) => o.branch).filter(Boolean) as string[];
    if (filterBranch) allNames.push(filterBranch);
    for (const name of allNames) {
      const key = name.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, name.trim());
    }
    return Array.from(seen.values()).sort();
  }, [orders, filterBranch]);
  const totalTablePages = Math.max(1, Math.ceil(filteredOrders.length / tablePageSize));
  const safeTablePage = Math.min(tablePage, totalTablePages);
  const tableStart = (safeTablePage - 1) * tablePageSize;
  const pagedOrders = filteredOrders.slice(tableStart, tableStart + tablePageSize);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      <motion.div
        variants={item}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-brand-text tracking-tight">Order Management</h1>
          <p className="text-sm text-brand-muted mt-1">
            {isAdmin
              ? "View and manage all laundry orders across all branches."
              : `Viewing orders for ${staffBranch || "your branch"}. Update order status from the table actions.`}
          </p>
          {lastRefreshed && (
            <p className="text-[11px] text-brand-muted/80 mt-0.5">
              Last updated: {lastRefreshed.toLocaleTimeString()} - auto-refreshes every 10s
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 rounded-brand border-brand-border text-brand-text hover:bg-brand-mintSoft"
            onClick={() => setShowHelp((prev) => !prev)}
          >
            <HelpCircle className="h-4 w-4" />
            {showHelp ? "Hide Help" : "How This Module Works"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 rounded-brand border-brand-border text-brand-text hover:bg-brand-mintSoft"
            onClick={() => void handleManualRefresh()}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 rounded-brand border-brand-border text-brand-text hover:bg-brand-mintSoft"
            onClick={() => void handleExportCsv()}
          >
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          {isAdmin && (
            <Button className="h-10 px-5 rounded-brand bg-brand-navy text-white hover:bg-brand-navyDark" onClick={openCreateModal}>
              <Plus className="h-4 w-4" /> Create Order
            </Button>
          )}
        </div>
      </motion.div>

      <motion.div variants={item} className="overflow-hidden">
        {showHelp ? (
          <div className="rounded-brand border border-brand-border bg-brand-bg p-4 sm:p-5 space-y-2.5">
            <p className="text-sm font-semibold text-brand-text flex items-center gap-2">
              <Info className="h-4 w-4 text-brand-navy" /> Order Management Guide
            </p>
            <p className="text-xs text-brand-muted">
              Overview: This table tracks each order lifecycle with status controls and delivery metadata in one place.
            </p>
            <p className="text-xs text-brand-muted">
              Updating status: Use the `Next` action through processing stages (Pending → Washing → Drying → Ready). Driver assignment is captured from the driver app acceptance flow and shown in this table.
            </p>
            <p className="text-xs text-brand-muted">
              Payment status: Order progress status and payment status are separate. Online and e-wallet payments update automatically to PAID after provider webhook confirmation. Cash remains manual confirmation only.
            </p>
            <p className="text-xs text-brand-muted">
              Search and filter: Use keyword search for customer or order ID and branch filters (admin only) to narrow visible cards.
            </p>
            <p className="text-xs text-brand-muted">
              When status changes: The backend writes timeline history updates, refreshes dashboard data, and syncs the latest order state for live visibility.
            </p>
          </div>
        ) : null}
      </motion.div>

      {loading ? <p className="text-sm text-brand-muted">Loading orders...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <motion.div variants={item} className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-5 py-3 flex-1 min-w-[280px] max-w-lg shadow-[0_4px_20px_rgba(0,0,0,0.03)] focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, tracking ID or phone..."
            className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder:text-slate-400 font-medium"
          />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.03)] focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="bg-transparent text-sm outline-none text-slate-600 font-bold cursor-pointer"
            >
              <option value="">All Branches</option>
              {uniqueBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.03)] focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <Badge className="h-2 w-2 rounded-full bg-blue-500 p-0" />
          <select
            value={filterPaymentStatus}
            onChange={(e) => setFilterPaymentStatus(e.target.value)}
            className="bg-transparent text-sm outline-none text-slate-600 font-bold cursor-pointer"
          >
            <option value="">Payment Status</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.03)] focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <Badge className="h-2 w-2 rounded-full bg-slate-300 p-0" />
          <select
            value={filterPaymentMethod}
            onChange={(e) => setFilterPaymentMethod(e.target.value)}
            className="bg-transparent text-sm outline-none text-slate-600 font-bold cursor-pointer"
          >
            <option value="">Payment Method</option>
            <option value="GCASH">GCash / E-Wallet</option>
            <option value="CASH">Cash / COD</option>
          </select>
        </div>
      </motion.div>

      {totalOrders > 0 ? (
        <motion.div variants={item} className="flex items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => void loadOrders(Math.max(0, ordersPage - 2), false)}
            disabled={!hasPreviousOrders}
          >
            Previous Page
          </Button>
          <span className="text-xs text-brand-muted">
            Data page {ordersPage} of {totalOrdersPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => void loadOrders(ordersPage, false)}
            disabled={!hasNextOrders}
          >
            Next Page
          </Button>
        </motion.div>
      ) : null}

      {!filteredOrders.length && debouncedSearchQuery.trim() ? (
        <motion.div variants={item} className="rounded-brand border border-brand-border bg-white p-4 text-sm text-brand-muted shadow-brand">
          No results found
        </motion.div>
      ) : null}

      <motion.div variants={item} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 backdrop-blur-sm text-slate-500 text-[10px] font-black uppercase tracking-[0.15em] border-b border-slate-100">
                <th className="text-left p-5 font-black">Order & Date</th>
                <th className="text-left p-5 font-black">Customer Details</th>
                <th className="text-left p-5 font-black">Service & Mode</th>
                <th className="text-left p-5 font-black">Load Detail</th>
                <th className="text-left p-5 font-black">Live Status</th>
                <th className="text-left p-5 font-black">Logistics</th>
                <th className="text-right p-5 font-black">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedOrders.map((order) => {
                const paymentStatus = resolvePaymentStatusLabel(order);
                const driverName = order.serviceType === "PICKUP_DELIVERY"
                  ? (deliveryMetaByTracking[order.orderId]?.driverName || "Unassigned")
                  : "-";
                const nextStatuses = getAllowedStatusTransitions(order.status);
                return (
                  <tr key={order.id} className={`group hover:bg-slate-50/80 transition-all duration-200 ${isEscalated(order) ? "bg-red-50/50" : ""
                    }`}>
                    <td className="p-5">
                      <div className="font-black text-brand-navy tabular-nums mb-0.5">{order.orderId}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatDateTime(order.createdAt)}</div>
                    </td>
                    <td className="p-5">
                      <div className="font-black text-slate-900 leading-none mb-1">{order.customerName}</div>
                      <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1.5">
                        <div className="h-1 w-1 rounded-full bg-slate-300" />
                        {order.customerPhone || "No Phone"}
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-slate-500 font-medium pl-5 leading-tight">
                          {order.deliveryAddress ? (
                            <span className="text-slate-700">{order.deliveryAddress}</span>
                          ) : (
                            <span className="text-slate-400 italic">
                              {order.serviceType === 'PICKUP_DELIVERY' ? '⚠️ No Address Set' : 'In-Store Walk-in'}
                            </span>
                          )}
                        </div>
                        {(order.customerPhone || order.customerEmail) && (
                          <div className="flex flex-col gap-0.5 pl-5 border-l border-slate-100">
                            {order.customerPhone && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Phone className="h-2.5 w-2.5" />
                                {order.customerPhone}
                              </div>
                            )}
                            {order.customerEmail && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Mail className="h-2.5 w-2.5" />
                                {order.customerEmail}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-2">
                        <div className="font-black text-slate-800 text-[12px] uppercase tracking-tight leading-none">
                          {order.serviceName || serviceTypeLabel[order.serviceType]}
                        </div>
                        {order.serviceName?.toLowerCase().includes("dry") && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 w-fit">
                            <span className="text-[8px] font-black text-amber-700 uppercase tracking-wide">Quote Required</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          {(order.paymentMethod?.toUpperCase().includes('GCASH')) ? (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-100 shadow-sm">
                              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                              <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">GCash</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100">
                              <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                {order.paymentMethod || 'COD'}
                              </span>
                            </div>
                          )}

                          {order.isPaid ? (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                              <span className="text-[8px] font-black uppercase">Paid</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-500 border border-rose-100">
                              <span className="text-[8px] font-black uppercase">Unpaid</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="bg-slate-100/50 rounded-xl px-3 py-2 border border-slate-100 w-fit">
                        {order.actualWeightKg != null ? (
                          <div className="flex items-center gap-1.5">
                            <Scale className="h-3 w-3 text-blue-500" />
                            <span className="font-black text-slate-900 tabular-nums">{order.actualWeightKg} <span className="text-[10px] text-slate-400">kg</span></span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 opacity-60">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{order.estimatedWeightKg > 0 ? `~${order.estimatedWeightKg}kg` : "PENDING"}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="space-y-2.5">
                        {renderStatusBadge(order.status)}
                        <div className={`px-2 py-1 rounded-lg w-fit text-[9px] font-black uppercase tracking-[0.1em] flex items-center gap-2 ${order.isPaid ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                          }`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${order.isPaid ? "bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-amber-400"}`} />
                          {order.isPaid ? "Verified Paid" : "Awaiting Payment"}
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      {order.serviceType === "DROP_OFF" ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-500 border border-slate-200 w-fit">
                          <span className="text-[9px] font-black uppercase tracking-widest">Drop-off</span>
                        </div>
                      ) : order.status === "DELIVERED" ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 w-fit">
                            <span className="text-[9px] font-black uppercase tracking-widest">Delivered</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{formatDateTime(order.deliveredAt)}</span>
                        </div>
                      ) : order.status === "COLLECTION_FAILED" ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-100 w-fit">
                            <span className="text-[9px] font-black uppercase tracking-widest">Failed</span>
                          </div>
                          <span className="text-[10px] text-rose-400 font-bold max-w-[120px] truncate">{order.deliveryFailedReason}</span>
                        </div>
                      ) : order.status === "PENDING" && order.serviceType === "PICKUP_DELIVERY" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 rounded-lg font-black text-[10px] uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          onClick={() => openAssignRiderModal(order, 'pickup')}
                        >
                          Assign Pickup
                        </Button>
                      ) : order.status === "READY" && order.serviceType === "PICKUP_DELIVERY" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 rounded-lg font-black text-[10px] uppercase tracking-widest border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                          onClick={() => openAssignRiderModal(order, 'delivery')}
                        >
                          Assign Delivery
                        </Button>
                      ) : order.assignedDriverName ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-black text-blue-600 uppercase">{order.assignedDriverName[0]}</span>
                            </div>
                            <span className="text-[11px] font-black text-slate-700 truncate max-w-[100px]">{order.assignedDriverName}</span>
                          </div>
                          {order.status === "ASSIGNED_FOR_DELIVERY" && (
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Awaiting Pickup</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 text-slate-400 border border-slate-100 w-fit">
                          <span className="text-[9px] font-black uppercase tracking-widest">Awaiting Ready</span>
                        </div>
                      )}
                    </td>
                    <td className="p-5">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 px-3 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                          onClick={() => void openDetails(order.id)}
                        >
                          Details
                        </Button>

                        {order.status === "ORDER_RECEIVED" && (
                          <Button
                            size="sm"
                            className="h-9 px-4 rounded-xl font-black text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                            onClick={() => openSetPriceModal(order)}
                          >
                            {order.serviceName?.toLowerCase().includes("dry") ? "Set Quote" : "Set Weight"}
                          </Button>
                        )}

                        {(order.status === "PENDING" || (nextStatuses.length && order.status !== "ORDER_RECEIVED")) ? (
                          <Button
                            size="sm"
                            className={`h-9 px-4 rounded-xl font-black text-xs text-white shadow-lg transition-all ${order.status === "PENDING"
                                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                                : "bg-slate-900 hover:bg-black shadow-slate-900/20"
                              }`}
                            onClick={() => void applyStatusUpdate(order)}
                            disabled={
                              statusUpdatingId === order.id ||
                              (order.status === "PRICE_CONFIRMED" && !order.priceConfirmedByCustomer)
                            }
                          >
                            {statusUpdatingId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                            {order.status === "PENDING" ? "Receive" : `Next Step`}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!pagedOrders.length ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-sm text-brand-muted">
                    No orders found for the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-brand-border px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-brand-muted">
            <span>Rows per page</span>
            <select
              value={tablePageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value) || 10;
                setTablePageSize(nextSize);
                setTablePage(1);
              }}
              className="h-8 rounded-brand border border-brand-border bg-white px-2 text-xs text-brand-text"
            >
              {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => setTablePage(Math.max(1, safeTablePage - 1))}
              disabled={safeTablePage <= 1}
            >
              Previous
            </Button>
            <span className="text-xs text-brand-muted">Page {safeTablePage} of {totalTablePages}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs"
              onClick={() => setTablePage(Math.min(totalTablePages, safeTablePage + 1))}
              disabled={safeTablePage >= totalTablePages}
            >
              Next
            </Button>
          </div>
        </div>
      </motion.div>

      <FinalizeWeightModal
        open={setPriceOpen}
        order={(() => {
          const o = orders.find(x => x.id === setPriceOrderId);
          if (!o) return null;
          return {
            id: o.id,
            orderId: o.orderId,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            branch: o.branch,
            estimatedWeightKg: o.estimatedWeightKg,
            actualWeightKg: o.actualWeightKg,
            serviceType: o.serviceType,
            serviceName: o.serviceName,
            paymentMethod: o.paymentMethod,
            detergent: o.detergent,
            detergentQuantity: o.detergentQuantity,
            conditioner: o.conditioner,
            conditionerQuantity: o.conditionerQuantity,
            rushPrice: o.rushPrice,
            deliveryPrice: o.deliveryPrice,
          } satisfies FinalizeOrderData;
        })()}
        submitting={setPriceSubmitting}
        onSubmit={submitSetPrice}
        onCancel={() => setSetPriceOpen(false)}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl border-slate-200 rounded-3xl p-0 overflow-hidden bg-[#F8FAFC] shadow-2xl [&>button:last-child]:text-white [&>button:last-child]:opacity-80 [&>button:last-child]:hover:opacity-100">
          <div className="bg-gradient-to-br from-slate-900 to-brand-navy px-8 py-10 pr-16 text-white border-b border-white/5">
            <DialogTitle className="text-3xl font-black tracking-tight flex items-center gap-3">
              <Plus className="h-8 w-8 text-blue-400" /> New Job Order
            </DialogTitle>
            <DialogDescription className="text-slate-400 font-bold mt-1 uppercase tracking-widest text-[10px]">Manual Staff Intake</DialogDescription>
          </div>

          <div className="p-8 space-y-8">
            <div className="space-y-3">
              <Label htmlFor="create-customer" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Customer Identification</Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-500">
                  <Search className="h-4 w-4 text-slate-300" />
                </div>
                <Input
                  id="create-customer"
                  value={createForm.customerName}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Full Name (e.g. John Doe)"
                  className="pl-11 h-14 bg-white border-slate-200 rounded-2xl font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="create-phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Customer Phone</Label>
                <Input
                  id="create-phone"
                  value={createForm.customerPhone}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                  placeholder="09123456789"
                  className="h-14 bg-white border-slate-200 rounded-2xl font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="create-branch" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assign Branch</Label>
                <Input
                  id="create-branch"
                  value={createForm.branch}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, branch: e.target.value }))}
                  placeholder="Makati Branch"
                  className="h-14 bg-white border-slate-200 rounded-2xl font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="create-address" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Delivery Address {createForm.serviceType === 'PICKUP_DELIVERY' ? '(Required)' : '(Optional)'}
              </Label>
              <Input
                id="create-address"
                value={createForm.deliveryAddress}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, deliveryAddress: e.target.value }))}
                placeholder={createForm.serviceType === 'PICKUP_DELIVERY' ? "Enter customer's home address" : "Optional for walk-ins"}
                className={`h-14 bg-white border-slate-200 rounded-2xl font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all ${createForm.serviceType === 'PICKUP_DELIVERY' && !createForm.deliveryAddress ? 'border-amber-300 bg-amber-50/20' : ''
                  }`}
              />
            </div>

            {createForm.serviceType === 'PICKUP_DELIVERY' && (
              <div className="grid grid-cols-2 gap-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                <div className="space-y-3">
                  <Label htmlFor="create-contact" className="text-[10px] font-black uppercase tracking-widest text-blue-500 ml-1">Person to Meet (Contact)</Label>
                  <Input
                    id="create-contact"
                    value={createForm.deliveryContactName}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, deliveryContactName: e.target.value }))}
                    placeholder="e.g. Amanda"
                    className="h-12 bg-white border-blue-200 rounded-xl font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="create-contact-phone" className="text-[10px] font-black uppercase tracking-widest text-blue-500 ml-1">Contact Phone</Label>
                  <Input
                    id="create-contact-phone"
                    value={createForm.deliveryContactPhone}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, deliveryContactPhone: e.target.value }))}
                    placeholder="09..."
                    className="h-12 bg-white border-blue-200 rounded-xl font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            )}
            {createForm.serviceType === 'PICKUP_DELIVERY' && (
              <p className="text-[10px] text-slate-400 font-medium px-1 -mt-2">
                * Leave contact blank to use the customer's registered details. NEVER use your own name.
              </p>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="create-service" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Workflow Mode</Label>
                <select
                  id="create-service"
                  value={createForm.serviceType}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, serviceType: e.target.value as any }))}
                  className="w-full h-14 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none"
                >
                  <option value="DROP_OFF">Drop Off Only</option>
                  <option value="PICKUP_DELIVERY">Pickup & Delivery</option>
                </select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="create-payment" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Initial Payment Method</Label>
                <select
                  id="create-payment"
                  value={createForm.paymentMethod}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full h-14 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none appearance-none"
                >
                  <option value="CASH">Cash / COD</option>
                  <option value="GCash">GCash</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-100 flex items-center justify-between">
            <Button variant="ghost" className="font-bold text-slate-400 hover:text-slate-600" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Discard
            </Button>
            <Button
              onClick={() => void submitCreate()}
              disabled={createSubmitting}
              className="bg-slate-900 hover:bg-black text-white font-black px-8 h-12 rounded-xl shadow-xl shadow-slate-900/10 transition-all active:scale-95"
            >
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {createSubmitting ? "Creating..." : "Confirm & Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignRiderOpen} onOpenChange={setAssignRiderOpen}>
        <DialogContent className="sm:max-w-md border-brand-border rounded-2xl p-0 overflow-hidden bg-white shadow-2xl [&>button:last-child]:text-white [&>button:last-child]:opacity-90 [&>button:last-child]:hover:opacity-100">
          <div className="bg-gradient-to-br from-brand-navy to-slate-900 px-8 py-8 text-white border-b border-white/10">
            <div className="flex items-center gap-4 mb-4 pr-10">
              <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">
                  Assign Rider
                </DialogTitle>
                <DialogDescription className="text-slate-200 font-semibold uppercase tracking-wide text-xs mt-1">
                  Order {orders.find(o => o.id === assignRiderOrderId)?.orderId}
                </DialogDescription>
              </div>
            </div>

            {assignRiderOrderId && (() => {
              const riderOrder = orders.find(o => o.id === assignRiderOrderId);
              const bookDate = formatBookingDate(riderOrder?.bookingDate);
              const bookSlot = formatSlotTime(riderOrder?.slotStartTime, riderOrder?.slotEndTime);
              const isFuture = isBookingFutureDate(riderOrder?.bookingDate);
              return (
                <div className="bg-white/10 rounded-2xl p-4 border border-white/20 space-y-2.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-200 font-semibold uppercase tracking-wide">Customer</span>
                    <span className="font-black text-white">{riderOrder?.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-200 font-semibold uppercase tracking-wide">Total Due</span>
                    <span className="font-black text-white">PHP {(riderOrder?.finalPrice ?? riderOrder?.totalPrice)?.toFixed(2) ?? "-"}</span>
                  </div>
                  {bookDate && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-200 font-semibold uppercase tracking-wide">Booking Date</span>
                      <span className="font-black text-white">{bookDate}</span>
                    </div>
                  )}
                  {bookSlot && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-200 font-semibold uppercase tracking-wide">Time Slot</span>
                      <span className="font-black text-white">{bookSlot}</span>
                    </div>
                  )}
                  {isFuture && (
                    <div className="mt-1 flex items-center gap-2 bg-amber-100 border border-amber-300 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Scheduled for a future date</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="p-8 space-y-6 bg-slate-50/70">
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 ml-1">Delivery Destination</Label>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3 shadow-sm">
                <div className="h-8 w-8 rounded-lg bg-brand-mint/20 flex items-center justify-center shrink-0 border border-brand-mint/40">
                  <Search className="h-4 w-4 text-brand-navy" />
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                  {orders.find(o => o.id === assignRiderOrderId)?.deliveryAddress || "No address provided"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wide text-slate-600 ml-1">Select Available Courier</Label>
              {assignRiderSubmitting && availableDrivers.length === 0 ? (
                <div className="h-16 flex items-center justify-center bg-white rounded-2xl border border-slate-200">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-navy" />
                </div>
              ) : availableDrivers.length === 0 ? (
                <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col items-center gap-2">
                  <Info className="h-6 w-6 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800 text-center">No drivers are currently active in this branch.</p>
                </div>
              ) : (
                <div className="relative group">
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full h-16 rounded-2xl border-2 border-slate-200 bg-white px-6 text-sm font-semibold text-slate-900 focus:ring-4 focus:ring-brand-navy/10 focus:border-brand-navy transition-all outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Choose a rider from the fleet...</option>
                    {availableDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.fullName} ({driver.email})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-slate-400">
                    <Plus className="h-5 w-5 rotate-45" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="bg-white p-8 border-t border-slate-100 flex items-center justify-end gap-4">
            <Button
              variant="ghost"
              className="font-black text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl h-14 px-8"
              onClick={() => setAssignRiderOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitAssignRider()}
              disabled={assignRiderSubmitting || !selectedDriverId}
              className="bg-brand-navy hover:bg-brand-navy/90 text-white font-black px-10 h-14 rounded-2xl shadow-xl shadow-brand-navy/20 transition-all active:scale-[0.98] group flex-1 sm:flex-none"
            >
              {assignRiderSubmitting
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><CheckCircle2 className="h-5 w-5 mr-2" /> Confirm Assignment</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-4xl border-brand-border rounded-xl p-0 overflow-hidden bg-slate-50 [&>button:last-child]:text-white [&>button:last-child]:opacity-80 [&>button:last-child]:hover:opacity-100">
          {detailsLoading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-brand-navy" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Order Details...</p>
            </div>
          ) : selectedOrder ? (
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* Header */}
              <div className="bg-slate-900 px-6 py-5 pr-16 text-white flex justify-between items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order</p>
                  <h2 className="text-xl font-black tracking-tight truncate">{selectedOrder.orderId}</h2>
                  <p className="text-slate-400 text-[11px] font-medium mt-0.5">{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
                <div className="flex max-w-[220px] flex-col items-end gap-2 shrink-0 text-right">
                  <Badge className={`px-3 py-1.5 rounded-lg text-[12px] font-black uppercase tracking-wide border-none whitespace-nowrap ${selectedOrder.status === 'READY' || selectedOrder.status === 'PRICE_CONFIRMED' ? 'bg-emerald-500 text-white' :
                      selectedOrder.status === 'AWAITING_PRICE_CONFIRMATION' ? 'bg-amber-500 text-white' :
                        selectedOrder.status === 'WASHING' || selectedOrder.status === 'DRYING' ? 'bg-blue-600 text-white' :
                          selectedOrder.status === 'CANCELLED' ? 'bg-red-500 text-white' :
                            'bg-slate-600 text-white'
                    }`}>
                    {statusLabel[selectedOrder.status]}
                  </Badge>
                  <span className="text-[10px] text-slate-400 font-semibold break-words">{selectedOrder.branch}</span>
                </div>
              </div>

              {/* Main Content (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* COD Warning Banner */}
                {selectedOrder.serviceType === 'PICKUP_DELIVERY' &&
                  (selectedOrder.paymentMethod?.toUpperCase().includes('CASH') || !selectedOrder.paymentMethod) &&
                  selectedOrder.status === 'DELIVERED' &&
                  !selectedOrder.codCollected && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                      <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                        <AlertCircle className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-amber-900">COD Collection Required</p>
                        <p className="text-xs font-bold text-amber-700/80">Rider has not yet confirmed cash collection.</p>
                      </div>
                      <button
                        className="shrink-0 text-xs font-black text-amber-900 bg-amber-200 hover:bg-amber-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                        disabled={codCollecting}
                        onClick={() => void handleCollectCod(selectedOrder)}
                      >
                        {codCollecting ? "Recording…" : "Mark Collected"}
                      </button>
                    </div>
                  )}

                {/* COD Success Banner */}
                {selectedOrder.codCollected && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-emerald-900">Cash Collected</p>
                      <p className="text-xs font-bold text-emerald-700/80">
                        Rider confirmed collection at {formatDateTime(selectedOrder.codCollectedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Customer */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Name</p>
                      <p className="font-black text-slate-800 text-sm">{selectedOrder.customerName}</p>
                      {selectedOrder.customerEmail && (
                        <div className="flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="text-xs text-slate-500 font-medium">{selectedOrder.customerEmail}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Phone</p>
                      <a href={`tel:${selectedOrder.customerPhone}`} className="font-black text-blue-600 text-sm hover:underline">{selectedOrder.customerPhone || '—'}</a>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Address</p>
                      <p className="font-semibold text-slate-700 text-sm leading-tight">
                        {selectedOrder.deliveryAddress || (selectedOrder.serviceType === 'PICKUP_DELIVERY' ? '⚠️ Missing Delivery Address' : 'Walk-in (No Delivery)')}
                      </p>
                    </div>
                    {(selectedOrder.deliveryContactName || selectedOrder.deliveryContactPhone) && (
                      <div className="col-span-3 mt-2 pt-3 border-t border-slate-100">
                        <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-2">Delivery Contact</p>
                        <div className="flex items-center gap-6">
                          {selectedOrder.deliveryContactName && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-slate-400" />
                              <span className="text-xs text-slate-700 font-semibold">{selectedOrder.deliveryContactName}</span>
                            </div>
                          )}
                          {selectedOrder.deliveryContactPhone && (
                            <a href={`tel:${selectedOrder.deliveryContactPhone}`} className="flex items-center gap-1.5 hover:underline">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span className="text-xs text-blue-600 font-semibold">{selectedOrder.deliveryContactPhone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Details */}
                {selectedOrder.assignedDriverName && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Details</p>
                      <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${selectedOrder.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          selectedOrder.status === 'COLLECTION_FAILED' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                            'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                        {statusLabel[selectedOrder.status]}
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Rider</p>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center">
                              <User className="h-3 w-3 text-slate-400" />
                            </div>
                            <p className="font-black text-slate-800 text-sm">{selectedOrder.assignedDriverName}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Rider Contact</p>
                          <div className="font-black text-slate-700 text-sm flex items-center gap-1.5">
                            <Phone className="h-3 w-3" /> {selectedOrder.assignedDriverPhone || 'No driver contact on file'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Assigned At</p>
                          <p className="font-semibold text-slate-700 text-[11px]">{formatDateTime(selectedOrder.assignedAt)}</p>
                        </div>
                        {selectedOrder.pickupConfirmedAt && (
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Picked Up At</p>
                            <p className="font-semibold text-slate-700 text-[11px]">{formatDateTime(selectedOrder.pickupConfirmedAt)}</p>
                          </div>
                        )}
                      </div>

                      {selectedOrder.status === 'COLLECTION_FAILED' && (
                        <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 flex items-start gap-3 mt-2">
                          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-black text-rose-700 uppercase tracking-tight">Delivery Failed</p>
                            <p className="text-xs font-bold text-rose-600/80 mt-1">{selectedOrder.deliveryFailedReason || 'No reason provided'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Laundry Services */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Laundry Services</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedOrder.bookingDate && (
                      <div className="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Booking Schedule</p>
                          <p className="font-bold text-slate-700 text-[11px] mt-0.5">
                            {formatBookingDate(selectedOrder.bookingDate)}
                            {formatSlotTime(selectedOrder.slotStartTime, selectedOrder.slotEndTime) && (
                              <span className="ml-2 text-slate-500">{formatSlotTime(selectedOrder.slotStartTime, selectedOrder.slotEndTime)}</span>
                            )}
                          </p>
                        </div>
                        {isBookingFutureDate(selectedOrder.bookingDate) && (
                          <span className="text-[8px] font-black text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 uppercase tracking-wide">Future</span>
                        )}
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Package</p>
                      <p className="font-black text-slate-800 text-sm">{selectedOrder.serviceName || serviceTypeLabel[selectedOrder.serviceType]}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Est. Weight</p>
                      <p className="font-semibold text-slate-500 text-sm">{selectedOrder.estimatedWeightKg > 0 ? `~${selectedOrder.estimatedWeightKg} kg` : 'TBD'}</p>
                    </div>
                    {selectedOrder.actualWeightKg != null && (
                      <div className="flex justify-between items-center bg-blue-50 rounded-lg px-3 py-2">
                        <p className="text-blue-600 text-[10px] font-black uppercase">✓ Actual Weight</p>
                        <p className="font-black text-blue-700 text-sm">{selectedOrder.actualWeightKg} kg</p>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Detergent</p>
                      <p className="font-semibold text-slate-700 text-sm">{selectedOrder.detergent || '—'}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Conditioner</p>
                      <p className="font-semibold text-slate-700 text-sm">{selectedOrder.conditioner || '—'}</p>
                    </div>
                    {selectedOrder.specialInstructions && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Instructions</p>
                        <p className="text-slate-600 text-xs italic">&ldquo;{selectedOrder.specialInstructions}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Method</p>
                      <p className="font-black text-slate-800 text-sm">
                        {selectedOrder.paymentMethod?.toUpperCase().includes('GCASH') ? 'GCash' : (selectedOrder.paymentMethod || 'Cash on Delivery')}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Status</p>
                      <div className="flex items-center gap-2">
                        {selectedOrder.isPaid ? (
                          <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase">● Paid</span>
                        ) : (
                          <>
                            <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase">● Pending</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px] font-bold rounded-lg border-emerald-200 text-emerald-600 hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1"
                              onClick={() => void handleManualMarkAsPaid(selectedOrder.id)}
                              disabled={markingPaidId === selectedOrder.id}
                            >
                              {markingPaidId === selectedOrder.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Confirm Payment"
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 flex justify-between items-center mt-2">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Amount Due</p>
                        <p className="text-2xl font-black text-white mt-1">
                          ₱{selectedOrder.finalPrice != null ? Number(selectedOrder.finalPrice).toFixed(2) : (selectedOrder.totalPrice != null ? Number(selectedOrder.totalPrice).toFixed(2) : (selectedOrder.confirmedPrice != null ? Number(selectedOrder.confirmedPrice).toFixed(2) : '—'))}
                        </p>
                      </div>
                      {selectedOrder.actualWeightKg != null && (
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Actual Weight</p>
                          <p className="text-xl font-black text-blue-400">{selectedOrder.actualWeightKg} kg</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Timeline</p>
                  </div>
                  <div className="p-4 pl-6 space-y-5">
                    <div className="relative pl-6 border-l-2 border-blue-500 pb-4">
                      <div className="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full bg-blue-600 ring-2 ring-white" />
                      <p className="text-xs font-black text-slate-800">Order received</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(selectedOrder.createdAt)}</p>
                    </div>
                    {selectedOrder.priceConfirmedByCustomer && (
                      <div className="relative pl-6 border-l-2 border-emerald-500 pb-4">
                        <div className="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white" />
                        <p className="text-xs font-black text-slate-800">Price confirmed by customer</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Customer approved the total</p>
                      </div>
                    )}
                    <div className="relative pl-6">
                      <div className={`absolute -left-[9px] top-0.5 h-4 w-4 rounded-full ring-2 ring-white ${['READY', 'PRICE_CONFIRMED', 'WASHING', 'DRYING'].includes(selectedOrder.status) ? 'bg-emerald-500' : 'bg-slate-200'
                        }`} />
                      <p className={`text-xs font-black ${['READY', 'PRICE_CONFIRMED', 'WASHING', 'DRYING'].includes(selectedOrder.status) ? 'text-emerald-600' : 'text-slate-300'
                        }`}>{statusLabel[selectedOrder.status]}</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer Actions */}
              <div className="bg-white border-t border-slate-200 p-6 space-y-4">
                <div className="flex flex-wrap gap-3">
                  {selectedOrder.status === 'PENDING' ? (
                    <>
                      {selectedOrder.serviceType === 'PICKUP_DELIVERY' ? (
                        <Button
                          className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl h-14 shadow-lg shadow-blue-200"
                          onClick={() => openAssignRiderModal(selectedOrder, 'pickup')}
                        >
                          <CheckCircle2 className="mr-2 h-5 w-5" /> Assign Pickup
                        </Button>
                      ) : (
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl h-14"
                          onClick={() => void applyStatusUpdate(selectedOrder)}
                        >
                          {statusUpdatingId === selectedOrder.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                          Receive Order
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="flex-1 border-slate-200 text-slate-600 font-black rounded-xl h-14"
                        onClick={() => setShowReceiptPreview(true)}
                      >
                        <Eye className="mr-2 h-4 w-4" /> Receipt
                      </Button>
                    </>
                  ) : selectedOrder.status === 'ORDER_RECEIVED' ? (
                    <Button
                      className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-xl h-14 shadow-lg shadow-violet-200"
                      onClick={() => openSetPriceModal(selectedOrder)}
                    >
                      <Scale className="mr-2 h-5 w-5" /> {selectedOrder.serviceName?.toLowerCase().includes("dry") ? "Set Dry-Clean Quote" : "Set Weight & Price"}
                    </Button>
                  ) : selectedOrder.status === 'AWAITING_PRICE_CONFIRMATION' ? (
                    <>
                      <Button
                        className="flex-[2] bg-slate-100 text-slate-400 font-black rounded-xl h-14 cursor-not-allowed border-2 border-dashed border-slate-200"
                        disabled
                      >
                        <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Waiting for Customer...
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-brand-navy text-brand-navy font-black rounded-xl h-14"
                        onClick={() => openSetPriceModal(selectedOrder)}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-slate-200 text-slate-600 font-black rounded-xl h-14"
                        onClick={() => setShowReceiptPreview(true)}
                      >
                        <Eye className="mr-2 h-4 w-4" /> Receipt
                      </Button>
                    </>
                  ) : selectedOrder.status === 'PRICE_CONFIRMED' ? (
                    <>
                      <Button
                        className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl h-14 shadow-lg shadow-blue-200"
                        onClick={() => void applyStatusUpdate(selectedOrder)}
                      >
                        {statusUpdatingId === selectedOrder.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <RefreshCw className="h-5 w-5 mr-2" />}
                        Mark as Washing
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-slate-200 text-slate-600 font-black rounded-xl h-14"
                        onClick={() => setShowReceiptPreview(true)}
                      >
                        <Eye className="mr-2 h-4 w-4" /> Receipt
                      </Button>
                    </>
                  ) : selectedOrder.status === 'READY' && selectedOrder.serviceType === 'PICKUP_DELIVERY' ? (
                    <>
                      <Button
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl h-14 shadow-lg shadow-emerald-200"
                        onClick={() => openAssignRiderModal(selectedOrder, 'delivery')}
                      >
                        <CheckCircle2 className="mr-2 h-5 w-5" /> Assign Delivery
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-slate-200 text-slate-600 font-black rounded-xl h-14"
                        onClick={() => setShowReceiptPreview(true)}
                      >
                        <Eye className="mr-2 h-4 w-4" /> Receipt
                      </Button>
                    </>
                  ) : ['CANCELLED', 'FAILED'].includes(selectedOrder.status) ? (
                    <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                      <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest italic">
                        This order has been {selectedOrder.status === 'CANCELLED' ? 'cancelled' : 'failed'} and cannot be modified.
                      </p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const nextStatus = getAllowedStatusTransitions(selectedOrder.status)[0];
                        const isGcash = selectedOrder.paymentMethod?.toUpperCase().includes("GCASH");
                        const isCash = isCashPaymentMethod(selectedOrder.paymentMethod);
                        const washingPaymentBlocked = nextStatus === "WASHING" && isGcash && !selectedOrder.isPaid;
                        const deliveryPaymentBlocked = nextStatus === "DELIVERED" && isGcash && !selectedOrder.isPaid;
                        const needsCodConfirm = nextStatus === "DELIVERED" && isCash && !selectedOrder.isPaid;
                        const handleMarkNextStep = () => {
                          if (needsCodConfirm) {
                            if (window.confirm(`Confirm COD collection for order ${selectedOrder.trackingNumber}?\n\nDid the customer pay with cash?\n\nClick OK to mark as Delivered + Payment Collected, or Cancel to mark Delivered without payment.`)) {
                              void applyStatusUpdate(selectedOrder, true);
                            } else {
                              void applyStatusUpdate(selectedOrder, false);
                            }
                          } else {
                            void applyStatusUpdate(selectedOrder);
                          }
                        };
                        return (
                          <>
                            <Button
                              className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl h-14 disabled:opacity-50"
                              onClick={handleMarkNextStep}
                              disabled={statusUpdatingId === selectedOrder.id}
                            >
                              {statusUpdatingId === selectedOrder.id ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                              Mark as {statusLabel[nextStatus] || 'Next Step'}
                            </Button>
                            {(['WASHING', 'DRYING', 'READY', 'DELIVERED', 'OUT_FOR_DELIVERY'].includes(selectedOrder.status)) && (
                              <Button
                                variant="outline"
                                className="flex-1 border-slate-200 text-slate-600 font-black rounded-xl h-14"
                                onClick={() => setShowReceiptPreview(true)}
                              >
                                <Eye className="mr-2 h-4 w-4" /> Receipt
                              </Button>
                            )}
                            {washingPaymentBlocked && (
                              <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 text-center flex flex-col items-center gap-2">
                                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest italic">
                                  GCash payment must be confirmed before washing can start.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 text-xs font-bold border-amber-300 text-amber-700 hover:bg-amber-100/50"
                                  onClick={() => void handleManualMarkAsPaid(selectedOrder.id)}
                                  disabled={markingPaidId === selectedOrder.id}
                                >
                                  {markingPaidId === selectedOrder.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    "Confirm GCash Payment Manually"
                                  )}
                                </Button>
                              </div>
                            )}
                            {deliveryPaymentBlocked && (
                              <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 text-center flex flex-col items-center gap-2">
                                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest italic">
                                  Payment must be confirmed before marking this order as delivered.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 text-xs font-bold border-amber-300 text-amber-700 hover:bg-amber-100/50"
                                  onClick={() => void handleManualMarkAsPaid(selectedOrder.id)}
                                  disabled={markingPaidId === selectedOrder.id}
                                >
                                  {markingPaidId === selectedOrder.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    "Confirm GCash Payment Manually"
                                  )}
                                </Button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}

                  {!['CANCELLED', 'FAILED', 'DELIVERED'].includes(selectedOrder.status) && (
                    <Button variant="destructive" className="font-black rounded-xl h-14 px-8" onClick={() => void submitCancel()}>
                      Cancel Order
                    </Button>
                  )}
                </div>

                {selectedOrder.status === 'PRICE_CONFIRMED' && !selectedOrder.priceConfirmedByCustomer && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest italic">
                      Mark as Washing is locked until customer confirms the price.
                    </p>
                  </div>
                )}
              </div>

              {(selectedOrder.status === 'DELIVERED' || selectedOrder.status === 'READY') && (
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Customer Feedback
                  </h3>

                  {feedbackLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                    </div>
                  ) : feedbackData?.customerRating ? (
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-5 w-5 ${star <= (feedbackData.customerRating ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                          />
                        ))}
                        <span className="ml-2 text-sm font-black text-slate-600">{feedbackData.customerRating}/5</span>
                      </div>
                      {feedbackData.customerComment && (
                        <p className="text-sm text-slate-600 italic leading-relaxed">
                          &ldquo;{feedbackData.customerComment}&rdquo;
                        </p>
                      )}
                      {feedbackData.feedbackSubmittedAt && (
                        <p className="text-[10px] text-slate-300">
                          Submitted {new Date(feedbackData.feedbackSubmittedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No customer rating yet.</p>
                  )}

                  {/* Staff Note */}
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Staff Note
                  </h3>
                  <textarea
                    className="w-full text-sm border border-slate-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-700 placeholder:text-slate-300"
                    rows={3}
                    maxLength={300}
                    placeholder="Add an internal note about this order…"
                    value={staffNoteInput}
                    onChange={(e) => setStaffNoteInput(e.target.value)}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-300">{staffNoteInput.length}/300</span>
                    <Button
                      size="sm"
                      className="font-bold rounded-lg"
                      disabled={staffNoteSubmitting}
                      onClick={() => void submitStaffNote()}
                    >
                      {staffNoteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Save Note
                    </Button>
                  </div>
                  {feedbackData?.staffNoteUpdatedAt && (
                    <p className="text-[10px] text-slate-300">
                      Last updated {new Date(feedbackData.staffNoteUpdatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">No order selected.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>Update order details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-customer">Customer Name</Label>
              <Input
                id="edit-customer"
                value={editForm.customerName}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, customerName: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-service">Service Type</Label>
              <select
                id="edit-service"
                value={editForm.serviceType}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    serviceType: e.target.value as ApiServiceType,
                  }))
                }
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="DROP_OFF">Drop Off</option>
                <option value="PICKUP_DELIVERY">Pickup & Delivery</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch">Branch</Label>
              <Input
                id="edit-branch"
                value={editForm.branch}
                onChange={(e) => setEditForm((prev) => ({ ...prev, branch: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact">Delivery Contact Name</Label>
              <Input
                id="edit-contact"
                value={editForm.deliveryContactName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, deliveryContactName: e.target.value }))}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact-phone">Delivery Contact Phone</Label>
              <Input
                id="edit-contact-phone"
                value={editForm.deliveryContactPhone}
                onChange={(e) => setEditForm((prev) => ({ ...prev, deliveryContactPhone: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitEdit()} disabled={editSubmitting}>
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {editSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The order will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(e) => {
                e.preventDefault();
                void submitDelete();
              }}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {deleteSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Receipt Preview Dialog ── */}
      {selectedOrder && (
        <Dialog open={showReceiptPreview} onOpenChange={setShowReceiptPreview}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                <span className="text-xl font-black tracking-widest uppercase">WashAlert</span>
                <br />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Official Receipt / Transaction Record
                </span>
              </DialogTitle>
              <DialogDescription className="text-center font-black text-blue-600 text-xl tracking-tight mt-1">
                WA-{selectedOrder.orderId.replace(/^WA-/, "")}
              </DialogDescription>
            </DialogHeader>

            {(() => {
              const o = selectedOrder;
              const actualKg = o.actualWeightKg ?? 0;
              const serviceBase = o.servicePrice ?? 0;
              const extraWeight = o.extraWeightCost ?? 0;
              const rush = o.rushPrice ?? 0;
              const isShopSupply = (s?: string | null) =>
                !!s && s.toLowerCase() !== "none" && s.toLowerCase() !== "customer provided";
              const detPPP = isShopSupply(o.detergent)
                ? (o.detergent!.toLowerCase().includes("ariel") ? 30 : 25) : 0;
              const detCost = detPPP * (o.detergentQuantity || 1);
              const conPPP = isShopSupply(o.conditioner)
                ? (o.conditioner!.toLowerCase().includes("downy") ? 25 : 15) : 0;
              const conCost = conPPP * (o.conditionerQuantity || 1);
              const delivery = o.deliveryPrice ?? 0;
              const subtotal = serviceBase + extraWeight + rush + detCost + conCost + delivery;
              const sysFee = o.systemFee ?? Math.round(subtotal * 0.02 * 100) / 100;
              const total = o.finalPrice ?? o.totalPrice ?? (subtotal + sysFee);

              const nm = (o.serviceName ?? "").toLowerCase();
              let loadsText = "N/A";
              if (actualKg > 0) {
                if (nm.includes("handwash")) {
                  loadsText = "1 load (by kg)";
                } else {
                  const limit = nm.includes("ecowash") ? 5 : (nm.includes("wash") && !nm.includes("full")) ? 7 : 8;
                  const loads = Math.ceil(actualKg / limit);
                  loadsText = `${loads} load${loads !== 1 ? "s" : ""}`;
                }
              }

              const infoRow = (label: string, value: string) => (
                <div key={label} className="flex justify-between py-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                  <span className="text-[11px] font-bold text-slate-800 text-right max-w-[58%]">{value}</span>
                </div>
              );
              const amtRow = (label: string, value: number, muted = false) => (
                <div key={label} className={`flex justify-between items-center py-1 ${muted ? "text-slate-400" : ""}`}>
                  <span className={`text-xs font-semibold ${muted ? "text-slate-400" : "text-slate-600"}`}>{label}</span>
                  <span className={`text-sm font-black tabular-nums font-mono ${muted ? "text-slate-400" : "text-slate-900"}`}>
                    ₱{value.toFixed(2)}
                  </span>
                </div>
              );

              return (
                <div className="space-y-3 py-1 text-sm max-h-[55vh] overflow-y-auto pr-1">
                  {/* Date */}
                  <div className="text-center text-[10px] text-slate-400 font-mono">
                    {new Date(o.createdAt || Date.now()).toLocaleString("en-PH", {
                      dateStyle: "medium", timeStyle: "short",
                    })}
                  </div>

                  {/* Order info */}
                  <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-0.5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Order Information</p>
                    {infoRow("Customer", o.customerName || "N/A")}
                    {o.customerPhone ? infoRow("Contact", o.customerPhone) : null}
                    {infoRow("Branch", o.branch || "N/A")}
                    {infoRow("Service", o.serviceName || "N/A")}
                    {infoRow("Service Type", o.serviceType === "PICKUP_DELIVERY" ? "Pickup & Delivery" : "Drop-Off")}
                    {o.loadSize ? infoRow("Load Classification", String(o.loadSize).charAt(0).toUpperCase() + String(o.loadSize).slice(1).toLowerCase()) : null}
                    {infoRow("Est. Weight", o.estimatedWeightKg ? `${o.estimatedWeightKg} kg` : "N/A")}
                    {infoRow("Actual Weight", o.actualWeightKg ? `${o.actualWeightKg} kg` : "N/A")}
                    {infoRow("No. of Loads", loadsText)}
                    {isShopSupply(o.detergent)
                      ? infoRow("Detergent", `${o.detergent} ×${o.detergentQuantity || 1} (₱${detPPP}/pack)`)
                      : infoRow("Detergent", o.detergent || "Customer Provided")}
                    {isShopSupply(o.conditioner)
                      ? infoRow("Fabric Conditioner", `${o.conditioner} ×${o.conditionerQuantity || 1} (₱${conPPP}/pack)`)
                      : infoRow("Fabric Conditioner", o.conditioner || "Customer Provided")}
                    {infoRow("Order Status", statusLabel[o.status] || o.status)}
                  </div>

                  {/* Charges */}
                  <div className="border-t border-dashed border-slate-200 pt-2 space-y-0.5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Charges</p>
                    {serviceBase > 0 && amtRow(o.serviceName || "Service Fee", serviceBase)}
                    {extraWeight > 0 && amtRow(`Extra Weight${actualKg > 8 ? ` (${(actualKg - 8).toFixed(1)} kg × ₱50)` : ""}`, extraWeight)}
                    {rush > 0 && amtRow("⚡ Rush Fee", rush)}
                    {detCost > 0 && amtRow(`${o.detergent} Detergent ×${o.detergentQuantity || 1}`, detCost)}
                    {conCost > 0 && amtRow(`${o.conditioner} Conditioner ×${o.conditionerQuantity || 1}`, conCost)}
                    {delivery > 0 && amtRow("Pickup / Delivery Fee", delivery)}
                    {amtRow("System & Convenience Fee (2%)", sysFee, true)}
                  </div>

                  {/* Total */}
                  <div className="pt-3 border-t-2 border-dashed border-slate-200 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Amount Due</p>
                      <p className="text-2xl font-black text-blue-600 tabular-nums font-mono">₱{total.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-800">
                        {(o.paymentMethod || "Cash on Delivery").replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-slate-400">{resolvePaymentStatusLabel(o)}</p>
                    </div>
                  </div>

                  <p className="text-center text-[9px] text-slate-300 italic">This receipt is system-generated.</p>
                </div>
              );
            })()}

            <DialogFooter className="flex-row gap-2 pt-1 flex-wrap">
              <Button
                variant="outline"
                className="flex-1 font-bold"
                onClick={() => printOrderReceipt({ ...selectedOrder, loadSize: selectedOrder.loadSize ?? undefined, laundryType: selectedOrder.laundryType ?? undefined })}
              >
                <Printer className="h-4 w-4 mr-2" /> Print Receipt
              </Button>
              <Button
                variant="outline"
                className="flex-1 font-bold"
                onClick={() => downloadOrderReceipt({ ...selectedOrder, loadSize: selectedOrder.loadSize ?? undefined, laundryType: selectedOrder.laundryType ?? undefined })}
              >
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
              <Button
                variant="outline"
                className="flex-1 font-bold"
                onClick={() => setShowReceiptPreview(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </motion.div>
  );
}

