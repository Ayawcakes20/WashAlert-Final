import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Megaphone,
  MessageSquare,
  TrendingUp,
  Users,
  Activity,
  BarChart3,
  CalendarDays,
  Cpu,
  ArrowUpRight,
  Loader2,
  Info,
  CreditCard,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  dashboardApi,
  inventoryApi,
  supportApi,
  announcementsApi,
  analyticsApi,
  type JobOrderResponse,
  type InventoryRecord,
  type AnnouncementRecord,
} from "@/lib/api";
import { getSessionUser } from "@/lib/session";

// ─── Shared constants ─────────────────────────────────────────────────────────

const ANIM_ITEM = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
const ANIM_CONTAINER = { show: { transition: { staggerChildren: 0.07 } } };

const STATUS_COLOR: Record<string, string> = {
  "Pending Confirmation": "bg-amber-100 text-amber-700",
  "Washing": "bg-blue-100 text-blue-700",
  "Drying": "bg-violet-100 text-violet-700",
  "Ready": "bg-emerald-100 text-emerald-700",
  "Delivering": "bg-slate-800 text-white",
  "Awaiting Confirmation": "bg-indigo-100 text-indigo-700",
  "Price Approved": "bg-teal-100 text-teal-700",
  "Completed": "bg-emerald-50 text-emerald-600",
  "Cancelled": "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending Confirmation",
  ORDER_RECEIVED: "Order Received",
  AWAITING_PRICE_CONFIRMATION: "Awaiting Confirmation",
  PRICE_CONFIRMED: "Price Approved",
  WASHING: "Washing",
  DRYING: "Drying",
  READY: "Ready",
  ASSIGNED_FOR_DELIVERY: "Delivering",
  EN_ROUTE_TO_BRANCH: "Delivering",
  PICKED_UP_FROM_BRANCH: "Delivering",
  OUT_FOR_DELIVERY: "Delivering",
  DELIVERED: "Completed",
  CANCELLED: "Cancelled",
};

const PAYMENT_COLORS: Record<string, string> = {
  GCASH: "hsl(220, 82%, 48%)",
  MAYA: "hsl(168, 60%, 40%)",
  CASH: "hsl(42, 80%, 52%)",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(value);

const timeGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const todayLabel = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

function mapOrder(order: JobOrderResponse) {
  const timestamp = new Date(order.updatedAt || order.createdAt);
  return {
    id: order.trackingNumber,
    customer: order.customerName,
    service: order.serviceType === "PICKUP_DELIVERY" ? "Pickup & Delivery" : "Drop Off",
    branch: order.branch,
    status: STATUS_LABEL[order.status] || order.status,
    dateTime: timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " • " +
      timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  badge,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  badge?: string;
  accent?: "primary" | "mint" | "gold" | "red" | "violet";
}) {
  const accentClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    mint: "bg-emerald-100 text-emerald-700",
    gold: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-600",
    violet: "bg-violet-100 text-violet-700",
  };
  const iconClass = accentClasses[accent || "primary"];

  return (
    <motion.div
      variants={ANIM_ITEM}
      className="glass-card rounded-2xl p-5 flex flex-col gap-3 hover:shadow-[var(--shadow-elevated)] transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div className={`p-2.5 rounded-xl ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        {badge && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </motion.div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <tr key={i}>
          {[...Array(cols)].map((__, j) => (
            <td key={j} className="py-3 pr-4">
              <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + (j % 3) * 20}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function RecentOrdersTable({
  orders,
  loading,
  showBranch,
}: {
  orders: ReturnType<typeof mapOrder>[];
  loading: boolean;
  showBranch: boolean;
}) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const paginated = useMemo(() => orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [orders, page]);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border/50">
              <th className="text-left pb-3 font-medium">Order ID</th>
              <th className="text-left pb-3 font-medium">Customer</th>
              <th className="text-left pb-3 font-medium hidden sm:table-cell">Service</th>
              {showBranch && <th className="text-left pb-3 font-medium hidden lg:table-cell">Branch</th>}
              <th className="text-left pb-3 font-medium">Status</th>
              <th className="text-right pb-3 font-medium hidden md:table-cell">Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={showBranch ? 6 : 5} />
            ) : paginated.length > 0 ? (
              paginated.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-3 font-mono text-xs font-semibold text-primary">{o.id}</td>
                  <td className="py-3 font-medium text-foreground">{o.customer}</td>
                  <td className="py-3 text-muted-foreground hidden sm:table-cell">{o.service}</td>
                  {showBranch && (
                    <td className="py-3 text-muted-foreground text-xs hidden lg:table-cell">{o.branch}</td>
                  )}
                  <td className="py-3">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-medium ${STATUS_COLOR[o.status] || "bg-muted text-muted-foreground"}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="py-3 text-right text-muted-foreground text-xs hidden md:table-cell">
                    {o.dateTime}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showBranch ? 6 : 5} className="py-8 text-center text-sm text-muted-foreground">
                  No recent orders available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {orders.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Staff Dashboard ──────────────────────────────────────────────────────────

function StaffDashboard() {
  const user = getSessionUser();
  const branchName = user?.branch || "Your Branch";
  const fullName = user?.fullName?.split(" ")[0] || "Staff";

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const [orders, setOrders] = useState<{ pending: number; washing: number; drying: number; ready: number }>({
    pending: 0, washing: 0, drying: 0, ready: 0,
  });
  const [recentOrders, setRecentOrders] = useState<ReturnType<typeof mapOrder>[]>([]);
  const [kpi, setKpi] = useState<{ ordersToday: number; ordersThisWeek: number; avgKgPerOrder30d: number } | null>(null);
  const [lowStockItems, setLowStockItems] = useState<InventoryRecord[]>([]);
  const [openTickets, setOpenTickets] = useState<Array<{ ticketNumber: string; issue: string; createdAt: string; status: string }>>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);

  useEffect(() => {
    const loadAll = async () => {
      // Summary
      try {
        const data = await dashboardApi.summary();
        setOrders(data.orders);
        setRecentOrders((data.recentOrders || []).map(mapOrder));
      } catch {
        // leave defaults
      } finally {
        setSummaryLoading(false);
      }

      // KPI
      try {
        const data = await inventoryApi.operationsKpi();
        setKpi(data);
      } catch {
        // leave null
      } finally {
        setKpiLoading(false);
      }

      // Inventory alerts
      try {
        const data = await inventoryApi.alerts();
        // Backend already scopes to logged-in staff's branch
        setLowStockItems(data.filter((item) => item.lowStock));
      } catch {
        // leave empty
      } finally {
        setInventoryLoading(false);
      }

      // Support tickets
      try {
        const data = await supportApi.allTickets();
        const open = (data as Array<{ ticketNumber: string; issue: string; createdAt: string; status: string }>)
          .filter((t) => t.status === "OPEN")
          .slice(0, 5);
        setOpenTickets(open);
      } catch {
        // leave empty
      } finally {
        setTicketsLoading(false);
      }

      // Announcements
      try {
        const data = await announcementsApi.list();
        // Show announcements for all branches or for this staff's branch
        const relevant = data
          .filter((a) => a.targetAllBranches || !a.branch || a.branch === branchName)
          .slice(0, 4);
        setAnnouncements(relevant);
      } catch {
        // leave empty
      } finally {
        setAnnouncementsLoading(false);
      }
    };
    void loadAll();
  }, [branchName]);

  const announcementTypeColor: Record<string, string> = {
    CLOSURE: "bg-red-100 text-red-700",
    HOLIDAY: "bg-amber-100 text-amber-700",
    GENERAL: "bg-blue-100 text-blue-700",
  };
  const announcementTypeLabel: Record<string, string> = {
    CLOSURE: "Closure",
    HOLIDAY: "Holiday",
    GENERAL: "General",
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={ANIM_CONTAINER}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={ANIM_ITEM}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {timeGreeting()}, {fullName} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-primary">{branchName}</span> · {todayLabel()}
            </p>
          </div>
          <div className="glass-card rounded-xl px-4 py-2 text-xs text-muted-foreground flex items-center gap-2 self-start sm:self-auto">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span>Live dashboard</span>
          </div>
        </div>
      </motion.div>

      {/* Stat Cards — 3: Pending, In Progress, Ready */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Clock}
          label="Pending Orders"
          value={summaryLoading ? "—" : orders.pending}
          badge="Needs action"
          accent="gold"
        />
        <StatCard
          icon={Activity}
          label="In Progress (Washing + Drying)"
          value={summaryLoading ? "—" : orders.washing + orders.drying}
          badge="Live"
          accent="violet"
        />
        <StatCard
          icon={CheckCircle2}
          label="Ready for Pickup / Delivery"
          value={summaryLoading ? "—" : orders.ready}
          badge="Ready"
          accent="mint"
        />
      </div>

      {/* Operational KPI row */}
      {(kpiLoading || kpi) && (
        <motion.div variants={ANIM_ITEM} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Orders Today</p>
            {kpiLoading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{kpi?.ordersToday ?? "—"}</p>
            )}
          </div>
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">This Week</p>
            {kpiLoading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-foreground">{kpi?.ordersThisWeek ?? "—"}</p>
            )}
          </div>
          <div className="glass-card rounded-2xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg. Weight / Order (30d)</p>
            {kpiLoading ? (
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-foreground">
                {kpi?.avgKgPerOrder30d != null ? `${kpi.avgKgPerOrder30d.toFixed(1)} kg` : "—"}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Recent Orders */}
      <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
        <SectionHeader
          title="Recent Orders"
          subtitle={`Branch order activity · ${branchName}`}
        />
        <RecentOrdersTable orders={recentOrders} loading={summaryLoading} showBranch={false} />
      </motion.div>

      {/* Bottom row: Inventory alerts + Tickets + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory alerts */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <SectionHeader title="Low Stock Alerts" subtitle="Items below reorder level" />
          {inventoryLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : lowStockItems.length > 0 ? (
            <div className="space-y-2.5">
              {lowStockItems.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-bold text-amber-700">
                      {item.currentStock} {item.unit}
                    </p>
                    <p className="text-[10px] text-amber-600">≤ {item.reorderLevel}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Package} message="No low-stock items. Inventory is well stocked." />
          )}
        </motion.div>

        {/* Support Tickets */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Open Tickets</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Unresolved support issues</p>
            </div>
            {!ticketsLoading && openTickets.length > 0 && (
              <span className="flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {openTickets.length}
              </span>
            )}
          </div>
          {ticketsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : openTickets.length > 0 ? (
            <div className="space-y-2.5">
              {openTickets.map((ticket) => (
                <div
                  key={ticket.ticketNumber}
                  className="p-3 rounded-xl bg-red-50 border border-red-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-red-700 font-mono">{ticket.ticketNumber}</p>
                    <span className="text-[10px] text-red-500 shrink-0">
                      {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground mt-1 line-clamp-2">{ticket.issue}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={MessageSquare} message="No open support tickets." />
          )}
        </motion.div>

        {/* Announcements */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <SectionHeader title="Announcements" subtitle="Latest branch & system notices" />
          {announcementsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : announcements.length > 0 ? (
            <div className="space-y-2.5">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-xl bg-muted/40 border border-border/40"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${announcementTypeColor[a.type] || "bg-muted text-muted-foreground"}`}
                    >
                      {announcementTypeLabel[a.type] || a.type}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Megaphone} message="No recent announcements." />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard() {
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const [orders, setOrders] = useState<{ pending: number; washing: number; drying: number; ready: number; machines: { available: number } }>({
    pending: 0, washing: 0, drying: 0, ready: 0, machines: { available: 0 },
  });
  const [recentOrders, setRecentOrders] = useState<ReturnType<typeof mapOrder>[]>([]);
  const [kpi, setKpi] = useState<{ ordersToday: number; ordersThisWeek: number } | null>(null);
  const [analytics, setAnalytics] = useState<{
    totalRevenue: number;
    totalOrders: number;
    branchBreakdown: Array<{ branch: string; totalOrders: number; revenue: number }>;
    paymentMethodBreakdown: Record<string, number>;
  } | null>(null);
  const [lowStockItems, setLowStockItems] = useState<InventoryRecord[]>([]);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const loadAll = async () => {
      // Summary
      try {
        const data = await dashboardApi.summary();
        setOrders({ ...data.orders, machines: data.machines });
        setRecentOrders((data.recentOrders || []).map(mapOrder));
      } catch {
        // leave defaults
      } finally {
        setSummaryLoading(false);
      }

      // KPI
      try {
        const data = await inventoryApi.operationsKpi();
        setKpi(data);
      } catch {
        // leave null
      } finally {
        setKpiLoading(false);
      }

      // Analytics (today for revenue snapshot)
      try {
        const data = await analyticsApi.summary({ fromDate: todayStr, toDate: todayStr });
        setAnalytics({
          totalRevenue: data.totalRevenue,
          totalOrders: data.totalOrders,
          branchBreakdown: data.branchBreakdown || [],
          paymentMethodBreakdown: data.paymentMethodBreakdown || {},
        });
      } catch {
        // leave null — do not show revenue if unavailable
      } finally {
        setAnalyticsLoading(false);
      }

      // Inventory alerts
      try {
        const data = await inventoryApi.alerts();
        setLowStockItems(data.filter((item) => item.lowStock));
      } catch {
        // leave empty
      } finally {
        setInventoryLoading(false);
      }

      // Support tickets count
      try {
        const data = await supportApi.allTickets();
        const count = (data as Array<{ status: string }>).filter((t) => t.status === "OPEN").length;
        setOpenTicketCount(count);
      } catch {
        // leave 0
      } finally {
        setTicketsLoading(false);
      }

      // Announcements
      try {
        const data = await announcementsApi.list();
        setAnnouncements(data.slice(0, 4));
      } catch {
        // leave empty
      } finally {
        setAnnouncementsLoading(false);
      }
    };
    void loadAll();
  }, [todayStr]);

  const paymentChartData = useMemo(() => {
    if (!analytics?.paymentMethodBreakdown) return [];
    return Object.entries(analytics.paymentMethodBreakdown).map(([method, count]) => ({ method, count }));
  }, [analytics]);

  const activeOrders = orders.pending + orders.washing + orders.drying + orders.ready;

  const announcementTypeColor: Record<string, string> = {
    CLOSURE: "bg-red-100 text-red-700",
    HOLIDAY: "bg-amber-100 text-amber-700",
    GENERAL: "bg-blue-100 text-blue-700",
  };
  const announcementTypeLabel: Record<string, string> = {
    CLOSURE: "Closure",
    HOLIDAY: "Holiday",
    GENERAL: "General",
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={ANIM_CONTAINER}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={ANIM_ITEM}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Command Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Business overview · All branches · {todayLabel()}
            </p>
          </div>
          <div className="glass-card rounded-xl px-4 py-2 text-xs text-muted-foreground flex items-center gap-2 self-start sm:self-auto">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span>Live dashboard</span>
          </div>
        </div>
      </motion.div>

      {/* Stat cards — 6 metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={ShoppingCart}
          label="Active Orders"
          value={summaryLoading ? "—" : activeOrders}
          badge="Live"
          accent="primary"
        />
        <StatCard
          icon={CheckCircle2}
          label="Ready for Delivery"
          value={summaryLoading ? "—" : orders.ready}
          badge="Ready"
          accent="mint"
        />
        <StatCard
          icon={CalendarDays}
          label="Orders Today"
          value={kpiLoading ? "—" : kpi?.ordersToday ?? "—"}
          accent="primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Orders This Week"
          value={kpiLoading ? "—" : kpi?.ordersThisWeek ?? "—"}
          accent="primary"
        />
        <StatCard
          icon={Cpu}
          label="Machines Available"
          value={summaryLoading ? "—" : orders.machines?.available ?? "—"}
          accent="mint"
        />
        <StatCard
          icon={MessageSquare}
          label="Open Tickets"
          value={ticketsLoading ? "—" : openTicketCount}
          accent={openTicketCount > 0 ? "red" : "mint"}
        />
      </div>

      {/* Revenue + Payment method breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's revenue summary */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <SectionHeader
            title="Today's Revenue Snapshot"
            subtitle="Based on completed & paid orders today"
          />
          {analyticsLoading ? (
            <div className="space-y-3">
              <div className="h-10 w-40 bg-muted rounded animate-pulse" />
              <div className="h-4 w-64 bg-muted rounded animate-pulse" />
            </div>
          ) : analytics ? (
            <div>
              <div className="flex items-end gap-3 mb-4">
                <p className="text-4xl font-bold text-foreground">
                  {formatCurrency(analytics.totalRevenue)}
                </p>
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 mb-1">
                  <ArrowUpRight className="h-3.5 w-3.5" /> Today
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                From <span className="font-semibold text-foreground">{analytics.totalOrders}</span> orders processed today across all branches
              </p>

              {/* Payment method breakdown mini chart */}
              {paymentChartData.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Payment Method Breakdown
                  </p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={paymentChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="method" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.75rem",
                          fontSize: "12px",
                          color: "hsl(var(--foreground))",
                        }}
                        cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={52}>
                        {paymentChartData.map((entry) => (
                          <Cell
                            key={entry.method}
                            fill={PAYMENT_COLORS[entry.method] || "hsl(var(--primary))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <EmptyState icon={CreditCard} message="Revenue data not available for today." />
          )}
        </motion.div>

        {/* Branch breakdown */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <SectionHeader title="Branch Overview" subtitle="Orders & revenue by branch today" />
          {analyticsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : analytics && analytics.branchBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border/50">
                    <th className="text-left pb-3 font-medium">Branch</th>
                    <th className="text-right pb-3 font-medium">Orders</th>
                    <th className="text-right pb-3 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.branchBreakdown
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((b, i) => (
                      <tr
                        key={b.branch}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <td className="py-2.5 font-medium text-foreground text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ background: i === 0 ? "hsl(var(--primary))" : "hsl(var(--border))" }}
                            />
                            {b.branch}
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-semibold text-foreground">{b.totalOrders}</td>
                        <td className="py-2.5 text-right text-emerald-700 font-semibold text-xs">
                          {formatCurrency(b.revenue)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={BarChart3} message="No branch data available for today." />
          )}
        </motion.div>
      </div>

      {/* Recent Orders — all branches */}
      <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
        <SectionHeader title="Recent Orders" subtitle="Latest orders across all branches" />
        <RecentOrdersTable orders={recentOrders} loading={summaryLoading} showBranch={true} />
      </motion.div>

      {/* Bottom row: Inventory alerts + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System-wide inventory alerts */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">System Inventory Alerts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Low-stock items across all branches</p>
            </div>
            {!inventoryLoading && lowStockItems.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" />
                {lowStockItems.length} item{lowStockItems.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {inventoryLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : lowStockItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border/50">
                    <th className="text-left pb-3 font-medium">Item</th>
                    <th className="text-left pb-3 font-medium hidden sm:table-cell">Branch</th>
                    <th className="text-right pb-3 font-medium">Stock</th>
                    <th className="text-right pb-3 font-medium">Reorder At</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.slice(0, 8).map((item) => (
                    <tr key={item.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5">
                        <p className="text-xs font-medium text-foreground">{item.itemName}</p>
                        <p className="text-[10px] text-muted-foreground">{item.category}</p>
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{item.branch}</td>
                      <td className="py-2.5 text-right">
                        <span className="text-xs font-bold text-amber-700">
                          {item.currentStock} {item.unit}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-xs text-muted-foreground">
                        {item.reorderLevel} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Package} message="All inventory levels are sufficient." />
          )}
        </motion.div>

        {/* Announcements */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <SectionHeader title="Latest Announcements" subtitle="Recent system & branch notices" />
          {announcementsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : announcements.length > 0 ? (
            <div className="space-y-2.5">
              {announcements.map((a) => (
                <div key={a.id} className="p-3.5 rounded-xl bg-muted/40 border border-border/40">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${announcementTypeColor[a.type] || "bg-muted text-muted-foreground"}`}
                    >
                      {announcementTypeLabel[a.type] || a.type}
                    </span>
                    {a.targetAllBranches ? (
                      <span className="text-[10px] text-muted-foreground">All Branches</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{a.branch || "All Branches"}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
                  {a.createdByName && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Info className="h-3 w-3" /> Posted by {a.createdByName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Megaphone} message="No recent announcements." />
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMIN";
  return isAdmin ? <AdminDashboard /> : <StaffDashboard />;
}
