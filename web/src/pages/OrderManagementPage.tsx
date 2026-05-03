import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Info,
  Eye,
  Filter,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  ordersApi,
  deliveriesApi,
  type CreateOrderPayload,
  type JobOrderResponse,
  type UpdateOrderPayload,
} from "@/lib/api";
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

type ApiOrderStatus = "PENDING" | "WASHING" | "DRYING" | "READY" | "PICKED_UP" | "DELIVERED" | "CANCELLED";
type ApiServiceType = "DROP_OFF" | "PICKUP_DELIVERY";

type Order = {
  id: number;
  orderId: string;
  customerName: string;
  serviceType: ApiServiceType;
  branch: string;
  status: ApiOrderStatus;
  createdAt: string;
  updatedAt: string;
  customerPhone: string;
  estimatedWeightKg: number;
  specialInstructions?: string;
  paymentMethod?: string;
  paymentStatus?: "PENDING" | "VERIFIED" | "REJECTED" | "PAID" | null;
  isPaid?: boolean;
  totalPrice?: number;
};

type DeliveryAssignmentMeta = {
  driverName: string;
  status: string;
};

const statusLabel: Record<ApiOrderStatus, string> = {
  PENDING: "Pending",
  WASHING: "Washing",
  DRYING: "Drying",
  READY: "Ready for Pickup",
  PICKED_UP: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const getAllowedStatusTransitions = (status: ApiOrderStatus): ApiOrderStatus[] => {
  switch (status) {
    case "PENDING":
      return ["WASHING"];
    case "WASHING":
      return ["DRYING"];
    case "DRYING":
      return ["READY"];
    case "READY":
      return [];
    case "PICKED_UP":
      return ["DELIVERED"];
    default:
      return [];
  }
};

const statusBadgeVariant = (status: ApiOrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "DELIVERED") return "default";
  if (status === "CANCELLED") return "destructive";
  return "secondary";
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
  status: order.status,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  customerPhone: order.customerPhone || "-",
  estimatedWeightKg: Number(order.estimatedWeightKg || 0),
  specialInstructions: order.specialInstructions,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  isPaid: order.isPaid,
  totalPrice: order.totalPrice,
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
};

export default function OrderManagementPage() {
  const currentUser = getSessionUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const staffBranch = currentUser?.branch || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
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

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

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

  useEffect(() => {
    setOrdersPage(1);
    void loadOrders(0, false);
  }, [loadOrders]);

  useEffect(() => {
    // Poll frequently so webhook-confirmed payment updates surface quickly in Order Management.
    autoRefreshRef.current = setInterval(() => {
      void loadOrders(Math.max(0, ordersPage - 1), true);
    }, 10000);

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [loadOrders, ordersPage]);

  const applyStatusUpdate = async (order: Order) => {
    const allowed = getAllowedStatusTransitions(order.status);
    const fallbackStatus = allowed[0];
    const nextStatus = fallbackStatus || order.status;
    if (nextStatus === order.status) return;
    if (!allowed.includes(nextStatus)) {
      toast.error(`Invalid transition from ${statusLabel[order.status]} to ${statusLabel[nextStatus]}.`);
      return;
    }
    setStatusUpdatingId(order.id);
    try {
      const updated = await ordersApi.updateStatus(order.id, nextStatus);
      const mapped = mapOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === mapped.id ? mapped : o)));
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

  const openCreateModal = () => {
    setCreateForm({ ...emptyCreateForm, branch: isAdmin ? "" : staffBranch });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!createForm.customerName.trim() || !createForm.branch.trim()) {
      toast.error("Customer name and branch are required.");
      return;
    }

    setCreateSubmitting(true);
    try {
      const created = await ordersApi.create({
        customerName: createForm.customerName.trim(),
        serviceType: createForm.serviceType,
        branch: createForm.branch.trim(),
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
    try {
      const detail = await ordersApi.getById(orderId);
      setSelectedOrder(mapOrder(detail));
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

  useEffect(() => {
    let active = true;
    const pickupDeliveryOrders = orders.filter((order) => order.serviceType === "PICKUP_DELIVERY");
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
    const set = new Set(orders.map((o) => o.branch).filter(Boolean));
    if (filterBranch) set.add(filterBranch);
    return Array.from(set).sort();
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

      <motion.div variants={item} className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-brand-mintSoft rounded-brand border border-brand-border px-4 py-2.5 flex-1 min-w-[200px] max-w-md">
          <Search className="h-4 w-4 text-brand-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer or order ID..."
            className="bg-transparent text-sm outline-none w-full text-brand-text placeholder:text-brand-muted"
          />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 bg-brand-mintSoft rounded-brand border border-brand-border px-4 py-2.5">
            <Filter className="h-4 w-4 text-brand-muted" />
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="bg-transparent text-sm outline-none text-brand-text"
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
        <div className="flex items-center gap-2 bg-brand-mintSoft rounded-brand border border-brand-border px-4 py-2.5">
          <Filter className="h-4 w-4 text-brand-muted" />
          <select
            value={filterPaymentStatus}
            onChange={(e) => setFilterPaymentStatus(e.target.value)}
            className="bg-transparent text-sm outline-none text-brand-text"
          >
            <option value="">All Payment Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="VERIFIED">Verified</option>
            <option value="PAID">Paid</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-brand-mintSoft rounded-brand border border-brand-border px-4 py-2.5">
          <Filter className="h-4 w-4 text-brand-muted" />
          <select
            value={filterPaymentMethod}
            onChange={(e) => setFilterPaymentMethod(e.target.value)}
            className="bg-transparent text-sm outline-none text-brand-text"
          >
            <option value="">All Payment Methods</option>
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

      <motion.div variants={item} className="bg-white rounded-brand shadow-brand border border-brand-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-modern">
            <thead>
              <tr className="bg-brand-mintSoft text-brand-muted text-xs uppercase tracking-wider border-b border-brand-border">
                <th className="text-left p-4 font-medium">Order ID</th>
                <th className="text-left p-4 font-medium">Customer</th>
                <th className="text-left p-4 font-medium">Branch</th>
                <th className="text-left p-4 font-medium">Service</th>
                <th className="text-left p-4 font-medium">Load/KG</th>
                <th className="text-left p-4 font-medium">Payment</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Driver</th>
                <th className="text-left p-4 font-medium">Created At</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order) => {
                const paymentStatus = resolvePaymentStatusLabel(order);
                const driverName = order.serviceType === "PICKUP_DELIVERY"
                  ? (deliveryMetaByTracking[order.orderId]?.driverName || "Unassigned")
                  : "-";
                const nextStatuses = getAllowedStatusTransitions(order.status);
                return (
                  <tr key={order.id} className="border-b border-brand-border last:border-0 hover:bg-brand-mintSoft/40 transition-colors">
                    <td className="p-4 font-mono text-xs font-semibold text-brand-navy">{order.orderId}</td>
                    <td className="p-4">
                      <div className="font-medium text-brand-text">{order.customerName}</div>
                      <div className="text-xs text-brand-muted">{order.customerPhone || "-"}</div>
                    </td>
                    <td className="p-4 text-brand-muted">{order.branch}</td>
                    <td className="p-4">
                      <div className="text-brand-text">{serviceTypeLabel[order.serviceType]}</div>
                      <div className="text-xs text-brand-muted">{order.paymentMethod || "N/A"}</div>
                    </td>
                    <td className="p-4 text-brand-muted">{order.estimatedWeightKg}kg</td>
                    <td className="p-4">
                      <span
                        className={`text-xs font-semibold ${
                          paymentStatus === "PAID" || paymentStatus === "VERIFIED"
                            ? "text-green-700"
                            : paymentStatus === "REJECTED"
                            ? "text-destructive"
                            : "text-brand-gold"
                        }`}
                      >
                        {paymentStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <Badge variant={statusBadgeVariant(order.status)} className="text-[11px]">
                        {statusLabel[order.status]}
                      </Badge>
                    </td>
                    <td className="p-4 text-brand-muted">{driverName}</td>
                    <td className="p-4 text-brand-muted text-xs">{formatDateTime(order.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs shrink-0"
                          onClick={() => void openDetails(order.id)}
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        {nextStatuses.length ? (
                          <Button
                            size="sm"
                            className="h-8 px-2.5 text-xs bg-brand-navy text-white hover:bg-brand-navyDark"
                            onClick={() => void applyStatusUpdate(order)}
                            disabled={statusUpdatingId === order.id}
                          >
                            {statusUpdatingId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            {`Next: ${statusLabel[nextStatuses[0]]}`}
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-brand-muted border-brand-border">
                            Closed
                          </Badge>
                        )}
                        {order.status === "PENDING" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs shrink-0 border-brand-border text-brand-muted hover:text-brand-text"
                            onClick={async () => {
                              try {
                                await ordersApi.cancel(order.id);
                                toast.success("Order cancelled successfully.");
                                await loadOrders(Math.max(0, ordersPage - 1), true);
                              } catch (err: any) {
                                toast.error(err?.message || "Unable to cancel order.");
                              }
                            }}
                          >
                            Cancel
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Order</DialogTitle>
            <DialogDescription>Add a new laundry order.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-customer">Customer Name</Label>
              <Input
                id="create-customer"
                value={createForm.customerName}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, customerName: e.target.value }))
                }
                placeholder="Juan Dela Cruz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-service">Service Type</Label>
              <select
                id="create-service"
                value={createForm.serviceType}
                onChange={(e) =>
                  setCreateForm((prev) => ({
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
              <Label htmlFor="create-branch">Branch</Label>
              <Input
                id="create-branch"
                value={createForm.branch}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, branch: e.target.value }))}
                placeholder="Makati Branch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={createSubmitting}>
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {createSubmitting ? "Creating..." : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>Review and manage the selected order.</DialogDescription>
          </DialogHeader>
          {detailsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading order details...
            </div>
          ) : selectedOrder ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs">Order ID</p>
                  <p className="font-medium font-mono text-primary">{selectedOrder.orderId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant={statusBadgeVariant(selectedOrder.status)} className="mt-0.5">
                    {statusLabel[selectedOrder.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Customer</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  <p className="font-medium">{selectedOrder.customerPhone || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Service Type</p>
                  <p className="font-medium">{serviceTypeLabel[selectedOrder.serviceType]}</p>
                </div>
                {selectedOrder.serviceType === "PICKUP_DELIVERY" ? (
                  <div>
                    <p className="text-muted-foreground text-xs">Assigned Driver</p>
                    <p className="font-medium">
                      {deliveryMetaByTracking[selectedOrder.orderId]?.driverName || "Unassigned"}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-muted-foreground text-xs">Branch</p>
                  <p className="font-medium">{selectedOrder.branch}</p>
                </div>
                {selectedOrder.serviceType === "PICKUP_DELIVERY" ? (
                  <div>
                    <p className="text-muted-foreground text-xs">Delivery Status</p>
                    <p className="font-medium">
                      {resolveDeliveryStatusLabel(deliveryMetaByTracking[selectedOrder.orderId]?.status)}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-muted-foreground text-xs">Payment Method</p>
                  <p className="font-medium">{selectedOrder.paymentMethod || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Payment Status</p>
                  <p
                    className={`font-medium ${
                      resolvePaymentStatusLabel(selectedOrder) === "PAID" || resolvePaymentStatusLabel(selectedOrder) === "VERIFIED"
                        ? "text-green-600"
                        : resolvePaymentStatusLabel(selectedOrder) === "REJECTED"
                        ? "text-destructive"
                        : "text-amber-600"
                    }`}
                  >
                    {resolvePaymentStatusLabel(selectedOrder)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="font-medium">
                    {selectedOrder.totalPrice != null
                      ? `₱${Number(selectedOrder.totalPrice).toFixed(2)}`
                      : "–"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-medium">{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Updated</p>
                  <p className="font-medium">{formatDateTime(selectedOrder.updatedAt)}</p>
                </div>
              </div>
              {selectedOrder.specialInstructions && (
                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="text-muted-foreground text-xs mb-1">Special Instructions</p>
                  <p className="text-sm">{selectedOrder.specialInstructions}</p>
                </div>
              )}
              {/* Payment Status Handling */}
              {resolvePaymentStatusLabel(selectedOrder) !== "PAID" && resolvePaymentStatusLabel(selectedOrder) !== "VERIFIED" && (
                <div className="border border-amber-200 rounded-lg p-3 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-2">Payment awaiting confirmation</p>
                  {isCashPaymentMethod(selectedOrder.paymentMethod) ? (
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                      onClick={async () => {
                        if (!selectedOrder) return;
                        try {
                          const updated = await ordersApi.markAsPaid(selectedOrder.id);
                          const mapped = mapOrder(updated);
                          setOrders((prev) => prev.map((o) => (o.id === mapped.id ? mapped : o)));
                          setSelectedOrder(mapped);
                          toast.success(`Cash payment confirmed for ${selectedOrder.orderId}.`);
                        } catch (err: any) {
                          toast.error(err?.message || "Unable to mark as paid.");
                        }
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Cash Payment
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Online and e-wallet payments are auto-marked as PAID after webhook or provider confirmation.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No order selected.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={openEditModal}
                disabled={!selectedOrder || detailsLoading}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
            {(selectedOrder?.status === "PENDING" || String(selectedOrder?.status) === "SCHEDULED") && (
              <Button
                variant="secondary"
                onClick={() => void submitCancel()}
                disabled={cancelSubmitting || detailsLoading}
              >
                {cancelSubmitting ? "Cancelling..." : "Cancel Order"}
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={!selectedOrder || detailsLoading}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </DialogFooter>
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

    </motion.div>
  );
}

