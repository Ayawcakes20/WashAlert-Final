import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  ArrowUpRight,
  Info,
  CreditCard,
  ClipboardList,
  ChevronRight,
  Zap,
  Layers,
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

// ─── Animation ────────────────────────────────────────────────────────────────
const ANIM_ITEM = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };
const ANIM_CONTAINER = { show: { transition: { staggerChildren: 0.08 } } };

// ─── Status maps ──────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  "Pending Confirmation": "bg-amber-100 text-amber-700 border border-amber-200",
  "Washing":             "bg-blue-100 text-blue-700 border border-blue-200",
  "Drying":              "bg-violet-100 text-violet-700 border border-violet-200",
  "Ready":               "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "Delivering":          "bg-slate-800 text-white",
  "Awaiting Confirmation": "bg-indigo-100 text-indigo-700 border border-indigo-200",
  "Price Approved":      "bg-teal-100 text-teal-700 border border-teal-200",
  "Completed":           "bg-emerald-50 text-emerald-600 border border-emerald-200",
  "Cancelled":           "bg-red-100 text-red-600 border border-red-200",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(v);

const timeGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const todayLabel = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

function mapOrder(order: JobOrderResponse) {
  const ts = new Date(order.updatedAt || order.createdAt);
  return {
    id: order.trackingNumber,
    customer: order.customerName,
    service: order.serviceType === "PICKUP_DELIVERY" ? "Pickup & Delivery" : "Drop Off",
    branch: order.branch,
    status: STATUS_LABEL[order.status] || order.status,
    dateTime:
      ts.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " · " +
      ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

// ─── Gradient Stat Card ───────────────────────────────────────────────────────
type GradientVariant = "navy" | "mint" | "gold" | "red" | "violet" | "blue" | "slate";

const GRADIENT: Record<GradientVariant, string> = {
  navy:   "linear-gradient(135deg, hsl(218,58%,20%) 0%, hsl(218,58%,30%) 100%)",
  mint:   "linear-gradient(135deg, hsl(168,55%,38%) 0%, hsl(168,60%,50%) 100%)",
  gold:   "linear-gradient(135deg, hsl(38,80%,45%) 0%, hsl(42,86%,60%) 100%)",
  red:    "linear-gradient(135deg, hsl(0,65%,50%) 0%, hsl(0,72%,60%) 100%)",
  violet: "linear-gradient(135deg, hsl(262,52%,40%) 0%, hsl(262,52%,55%) 100%)",
  blue:   "linear-gradient(135deg, hsl(220,72%,40%) 0%, hsl(220,82%,55%) 100%)",
  slate:  "linear-gradient(135deg, hsl(215,25%,30%) 0%, hsl(215,25%,45%) 100%)",
};

function GradientStatCard({
  icon: Icon,
  label,
  value,
  sub,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  variant: GradientVariant;
}) {
  return (
    <motion.div
      variants={ANIM_ITEM}
      className="rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden shadow-lg"
      style={{ background: GRADIENT[variant] }}
    >
      {/* Decorative circle */}
      <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full opacity-10 bg-white" />
      <div className="absolute -right-2 -bottom-6 h-20 w-20 rounded-full opacity-10 bg-white" />

      <div className="flex items-center justify-between relative z-10">
        <div className="p-2.5 rounded-xl bg-white/20">
          <Icon className="h-4 w-4 text-white" />
        </div>
        {sub && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white/90 uppercase tracking-wide">
            {sub}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        <p className="text-xs text-white/70 mt-1">{label}</p>
      </div>
    </motion.div>
  );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────
const QA_STYLE: Record<string, { bg: string; iconBg: string; iconColor: string; border: string; hoverBorder: string }> = {
  navy:   { bg: "hover:bg-primary/5",    iconBg: "bg-primary/10",    iconColor: "text-primary",      border: "border-primary/20",   hoverBorder: "hover:border-primary/50" },
  mint:   { bg: "hover:bg-emerald-50",   iconBg: "bg-emerald-100",   iconColor: "text-emerald-700",  border: "border-emerald-200",  hoverBorder: "hover:border-emerald-400" },
  gold:   { bg: "hover:bg-amber-50",     iconBg: "bg-amber-100",     iconColor: "text-amber-700",    border: "border-amber-200",    hoverBorder: "hover:border-amber-400" },
  red:    { bg: "hover:bg-red-50",       iconBg: "bg-red-100",       iconColor: "text-red-600",      border: "border-red-200",      hoverBorder: "hover:border-red-400" },
  violet: { bg: "hover:bg-violet-50",    iconBg: "bg-violet-100",    iconColor: "text-violet-700",   border: "border-violet-200",   hoverBorder: "hover:border-violet-400" },
  blue:   { bg: "hover:bg-blue-50",      iconBg: "bg-blue-100",      iconColor: "text-blue-700",     border: "border-blue-200",     hoverBorder: "hover:border-blue-400" },
  teal:   { bg: "hover:bg-teal-50",      iconBg: "bg-teal-100",      iconColor: "text-teal-700",     border: "border-teal-200",     hoverBorder: "hover:border-teal-400" },
};

function QuickActionCard({
  icon: Icon,
  label,
  description,
  badge,
  badgePulse,
  variant,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  badge?: string | number;
  badgePulse?: boolean;
  variant: keyof typeof QA_STYLE;
  onClick: () => void;
}) {
  const s = QA_STYLE[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-4 border bg-card/80 backdrop-blur-sm ${s.border} ${s.hoverBorder} ${s.bg} transition-all duration-200 hover:shadow-lg group active:scale-[0.98]`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-xl shrink-0 ${s.iconBg}`}>
          <Icon className={`h-4 w-4 ${s.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {badge != null && (
              <span className={`relative flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] bg-red-500 text-white ${badgePulse ? "animate-pulse" : ""}`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
        <ChevronRight className={`h-4 w-4 shrink-0 mt-0.5 ${s.iconColor} opacity-40 group-hover:opacity-80 transition-opacity`} />
      </div>
    </button>
  );
}

// ─── Section Header with colored accent ───────────────────────────────────────
function SectionHeading({
  title,
  subtitle,
  accent = "navy",
  action,
}: {
  title: string;
  subtitle?: string;
  accent?: GradientVariant;
  action?: React.ReactNode;
}) {
  const accentColor: Record<GradientVariant, string> = {
    navy: "bg-primary",
    mint: "bg-emerald-500",
    gold: "bg-amber-500",
    red: "bg-red-500",
    violet: "bg-violet-500",
    blue: "bg-blue-500",
    slate: "bg-slate-500",
  };
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-start gap-3">
        <div className={`w-1 h-8 rounded-full mt-0.5 shrink-0 ${accentColor[accent]}`} />
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2.5 text-center">
      <div className="p-3 rounded-2xl bg-muted/60">
        <Icon className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Loading skeleton rows ────────────────────────────────────────────────────
function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <tr key={i}>
          {[...Array(cols)].map((__, j) => (
            <td key={j} className="py-3 pr-4">
              <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${55 + (j % 3) * 20}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Recent Orders Table ──────────────────────────────────────────────────────
function RecentOrdersTable({ orders, loading, showBranch }: { orders: ReturnType<typeof mapOrder>[]; loading: boolean; showBranch: boolean }) {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const paginated = useMemo(() => orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [orders, page]);

  return (
    <div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-muted-foreground text-[11px] uppercase tracking-wider">
              <th className="text-left pb-3 pl-1 font-semibold">Order ID</th>
              <th className="text-left pb-3 font-semibold">Customer</th>
              <th className="text-left pb-3 font-semibold hidden sm:table-cell">Service</th>
              {showBranch && <th className="text-left pb-3 font-semibold hidden lg:table-cell">Branch</th>}
              <th className="text-left pb-3 font-semibold">Status</th>
              <th className="text-right pb-3 pr-1 font-semibold hidden md:table-cell">Date & Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              <LoadingRows cols={showBranch ? 6 : 5} />
            ) : paginated.length > 0 ? (
              paginated.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="py-3 pl-1 font-mono text-xs font-bold text-primary">{o.id}</td>
                  <td className="py-3 font-medium text-foreground text-sm">{o.customer}</td>
                  <td className="py-3 text-muted-foreground text-xs hidden sm:table-cell">{o.service}</td>
                  {showBranch && <td className="py-3 text-muted-foreground text-xs hidden lg:table-cell">{o.branch}</td>}
                  <td className="py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-[11px] font-semibold ${STATUS_COLOR[o.status] || "bg-muted text-muted-foreground"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="py-3 pr-1 text-right text-muted-foreground text-xs hidden md:table-cell">{o.dateTime}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showBranch ? 6 : 5} className="py-10 text-center text-sm text-muted-foreground">
                  No recent orders available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {orders.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="h-8 px-3 rounded-lg border border-border text-xs disabled:opacity-40 hover:bg-muted/50 transition-colors">
            ← Prev
          </button>
          <span className="text-xs text-muted-foreground px-1">Page {page} of {totalPages}</span>
          <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="h-8 px-3 rounded-lg border border-border text-xs disabled:opacity-40 hover:bg-muted/50 transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Announcement type helpers ────────────────────────────────────────────────
const ANN_COLOR: Record<string, string> = {
  CLOSURE: "bg-red-100 text-red-700 border-red-200",
  HOLIDAY: "bg-amber-100 text-amber-700 border-amber-200",
  GENERAL: "bg-blue-100 text-blue-700 border-blue-200",
};
const ANN_DOT: Record<string, string> = {
  CLOSURE: "bg-red-400",
  HOLIDAY: "bg-amber-400",
  GENERAL: "bg-blue-400",
};
const ANN_LABEL: Record<string, string> = { CLOSURE: "Closure", HOLIDAY: "Holiday", GENERAL: "General" };

// ─── Dashboard Hero ───────────────────────────────────────────────────────────
function DashboardHero({
  greeting,
  name,
  roleText,
}: {
  greeting: string;
  name: string;
  roleText: React.ReactNode;
}) {
  return (
    <div className="relative w-full rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] mb-8 bg-[#0c2054]">
      {/* Dynamic Background Gradient */}
      <div 
        className="absolute inset-0 pointer-events-none z-0" 
        style={{
          background: "linear-gradient(110deg, #0b1c4a 0%, #17428f 60%, #1e5ab3 100%)",
        }}
      />
      
      {/* Concentric rings on the right */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[350px] h-[350px] sm:w-[500px] sm:h-[500px] border-[1px] border-white/5 rounded-full pointer-events-none z-0 translate-x-[20%]" />
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[250px] h-[250px] sm:w-[350px] sm:h-[350px] border-[1px] border-white/5 rounded-full pointer-events-none z-0 translate-x-[15%]" />

      {/* The Wave Circle (Animated) */}
      <div className="absolute right-6 sm:right-20 top-1/2 -translate-y-1/2 w-32 h-32 sm:w-48 sm:h-48 rounded-full overflow-hidden z-0"
           style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* CSS Water Waves via rotating rounded squares */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin-slow { 100% { transform: rotate(360deg); } }
          @keyframes spin-slow-reverse { 100% { transform: rotate(-360deg); } }
        `}} />
        <div className="absolute w-[250%] h-[250%] rounded-[40%] bg-white/5 left-[-75%] top-[40%]" style={{ animation: 'spin-slow 12s linear infinite' }} />
        <div className="absolute w-[250%] h-[250%] rounded-[45%] bg-white/10 left-[-75%] top-[50%]" style={{ animation: 'spin-slow-reverse 15s linear infinite' }} />
        <div className="absolute w-[250%] h-[250%] rounded-[43%] bg-white/10 left-[-75%] top-[60%]" style={{ animation: 'spin-slow 10s linear infinite' }} />
      </div>

      <div className="relative z-10 p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
           <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-2">{todayLabel()}</p>
           <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2 flex items-center gap-2">
             {greeting}, {name} <span className="animate-bounce origin-bottom-right inline-block">👋</span>
           </h1>
           <p className="text-white/70 text-sm font-medium">
             {roleText}
           </p>
        </div>
        
        {/* Live Data Badge */}
        <div className="relative z-10 flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 self-start sm:self-auto shadow-lg">
           <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
           <span className="text-white/90 text-xs font-semibold tracking-wide">Live data</span>
        </div>
      </div>
      
      {/* Wave bottom shape cut-out */}
      <svg 
        className="absolute bottom-0 left-0 w-full h-6 sm:h-10 text-background translate-y-px z-10 pointer-events-none" 
        viewBox="0 0 1440 54" 
        fill="currentColor" 
        preserveAspectRatio="none"
      >
        <path d="M0,54 L1440,54 L1440,24 C1152,54 864,54 576,28.8 C288,3.6 144,3.6 0,14.6 Z" />
      </svg>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function StaffDashboard() {
  const navigate = useNavigate();
  const user = getSessionUser();
  const branchName = user?.branch || "Your Branch";
  const fullName = user?.fullName?.split(" ")[0] || "Staff";

  const [summaryLoading, setSummaryLoading]         = useState(true);
  const [kpiLoading, setKpiLoading]                 = useState(true);
  const [inventoryLoading, setInventoryLoading]     = useState(true);
  const [ticketsLoading, setTicketsLoading]         = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const [orders, setOrders] = useState({ pending: 0, washing: 0, drying: 0, ready: 0 });
  const [recentOrders, setRecentOrders] = useState<ReturnType<typeof mapOrder>[]>([]);
  const [kpi, setKpi] = useState<{ ordersToday: number; ordersThisWeek: number; avgKgPerOrder30d: number } | null>(null);
  const [lowStockItems, setLowStockItems] = useState<InventoryRecord[]>([]);
  const [openTickets, setOpenTickets] = useState<Array<{ ticketNumber: string; issue: string; createdAt: string; status: string }>>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);

  useEffect(() => {
    const run = async () => {
      try { const d = await dashboardApi.summary(); setOrders(d.orders); setRecentOrders((d.recentOrders || []).map(mapOrder)); } catch { /**/ } finally { setSummaryLoading(false); }
      try { setKpi(await inventoryApi.operationsKpi()); } catch { /**/ } finally { setKpiLoading(false); }
      try { const d = await inventoryApi.alerts(); setLowStockItems(d.filter(i => i.lowStock)); } catch { /**/ } finally { setInventoryLoading(false); }
      try {
        const d = await supportApi.allTickets();
        setOpenTickets((d as Array<{ ticketNumber: string; issue: string; createdAt: string; status: string }>).filter(t => t.status === "OPEN").slice(0, 5));
      } catch { /**/ } finally { setTicketsLoading(false); }
      try {
        const d = await announcementsApi.list();
        setAnnouncements(d.filter(a => a.targetAllBranches || !a.branch || a.branch === branchName).slice(0, 4));
      } catch { /**/ } finally { setAnnouncementsLoading(false); }
    };
    void run();
  }, [branchName]);

  const openTicketCount = openTickets.length;
  // Split low-stock alerts into consumables (quantity-based) vs assets (condition-based)
  const lowStockConsumables = lowStockItems.filter(i => !i.assetType || i.assetType !== "Asset");
  const lowStockConsumableCount = lowStockConsumables.length;
  const outOfStockConsumables = lowStockConsumables.filter(i => i.currentStock === 0);
  const outOfStockCount = outOfStockConsumables.length;
  const lowStockCount = lowStockConsumableCount;

  return (
    <motion.div initial="hidden" animate="show" variants={ANIM_CONTAINER} className="space-y-8">

      {/* ── Hero header ── */}
      <motion.div variants={ANIM_ITEM}>
        <DashboardHero 
          greeting={timeGreeting()}
          name={fullName}
          roleText={<>You're managing <span className="text-white font-semibold">{branchName}</span></>}
        />
      </motion.div>

      {/* ── 3 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GradientStatCard icon={Clock} label="Pending Orders" value={summaryLoading ? "—" : orders.pending} sub="Needs action" variant="gold" />
        <GradientStatCard icon={Activity} label="Washing + Drying" value={summaryLoading ? "—" : orders.washing + orders.drying} sub="In progress" variant="violet" />
        <GradientStatCard icon={CheckCircle2} label="Ready for Pickup" value={summaryLoading ? "—" : orders.ready} sub="Ready" variant="mint" />
      </div>

      {/* ── Quick Actions ── */}
      <motion.div variants={ANIM_ITEM}>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionCard
            icon={ClipboardList}
            label="Process Orders"
            description={!summaryLoading && orders.pending > 0 ? `${orders.pending} pending order${orders.pending !== 1 ? "s" : ""} need attention` : "View & manage branch orders"}
            badge={!summaryLoading && orders.pending > 0 ? orders.pending : undefined}
            badgePulse={orders.pending > 0}
            variant="navy"
            onClick={() => navigate("/orders")}
          />
          <QuickActionCard
            icon={Package}
            label="Check Inventory"
            description={
              !inventoryLoading && outOfStockCount > 0
                ? `${outOfStockCount} supply item${outOfStockCount !== 1 ? "s" : ""} out of stock`
                : !inventoryLoading && lowStockConsumableCount > 0
                  ? `${lowStockConsumableCount} item${lowStockConsumableCount !== 1 ? "s" : ""} below reorder level`
                  : "All stock levels are sufficient"
            }
            badge={!inventoryLoading && lowStockConsumableCount > 0 ? lowStockConsumableCount : undefined}
            variant="gold"
            onClick={() => navigate("/inventory")}
          />
          <QuickActionCard
            icon={MessageSquare}
            label="Support Tickets"
            description={!ticketsLoading && openTicketCount > 0 ? `${openTicketCount} open ticket${openTicketCount !== 1 ? "s" : ""} need response` : "No open tickets right now"}
            badge={!ticketsLoading && openTicketCount > 0 ? openTicketCount : undefined}
            badgePulse={openTicketCount > 0}
            variant="red"
            onClick={() => navigate("/support-tickets")}
          />
          <QuickActionCard
            icon={Megaphone}
            label="Announcements"
            description="View branch & system notices"
            variant="blue"
            onClick={() => navigate("/announcements")}
          />
        </div>
      </motion.div>

      {/* ── Operational KPIs ── */}
      {(kpiLoading || kpi) && (
        <motion.div variants={ANIM_ITEM} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Orders Today",         value: kpi?.ordersToday,         suffix: "" },
            { label: "Orders This Week",     value: kpi?.ordersThisWeek,      suffix: "" },
            { label: "Avg. Weight (30d)",    value: kpi?.avgKgPerOrder30d != null ? kpi.avgKgPerOrder30d.toFixed(1) : null, suffix: " kg" },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="glass-card rounded-2xl p-5 border-l-4 border-primary/40">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">{label}</p>
              {kpiLoading
                ? <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                : <p className="text-3xl font-bold text-foreground">{value != null ? `${value}${suffix}` : "—"}</p>
              }
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Recent Orders ── */}
      <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
        <SectionHeading
          title="Recent Orders"
          subtitle={`Branch activity · ${branchName}`}
          accent="navy"
          action={
            <button type="button" onClick={() => navigate("/orders")}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          }
        />
        <RecentOrdersTable orders={recentOrders} loading={summaryLoading} showBranch={false} />
      </motion.div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Inventory alerts */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <SectionHeading
            title="Supply Alerts"
            subtitle="Consumable stock · Detergent &amp; Fabric Conditioner"
            accent="gold"
            action={
              lowStockConsumableCount > 0
                ? <button type="button" onClick={() => navigate("/inventory")} className="text-xs font-semibold text-amber-700 hover:underline flex items-center gap-1">Manage <ChevronRight className="h-3 w-3" /></button>
                : undefined
            }
          />
          {inventoryLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : lowStockConsumables.length > 0 ? (
            <div className="space-y-2">
              {lowStockConsumables.slice(0, 6).map(item => {
                const isZero = item.currentStock === 0;
                return (
                  <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isZero ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                  }`}>
                    <div className={`p-1.5 rounded-lg shrink-0 ${isZero ? "bg-red-100" : "bg-amber-100"}`}>
                      <Package className={`h-3.5 w-3.5 ${isZero ? "text-red-600" : "text-amber-600"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{item.itemName}</p>
                      <p className={`text-[10px] font-medium ${isZero ? "text-red-600" : "text-amber-600"}`}>
                        {isZero ? "Out of stock" : "Low stock"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isZero ? "text-red-700" : "text-amber-700"}`}>
                        {item.currentStock}<span className="text-[10px] font-medium ml-0.5">{item.unit}</span>
                      </p>
                      <p className={`text-[10px] ${isZero ? "text-red-400" : "text-amber-500"}`}>min {item.reorderLevel}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Package} message="All consumable stock levels are sufficient." />
          )}
        </motion.div>

        {/* Open Tickets */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <SectionHeading
            title="Open Tickets"
            subtitle="Unresolved support issues"
            accent="red"
            action={
              <div className="flex items-center gap-2">
                {!ticketsLoading && openTicketCount > 0 && (
                  <span className="h-6 min-w-[24px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{openTicketCount}</span>
                )}
                <button type="button" onClick={() => navigate("/support-tickets")} className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1">View all <ChevronRight className="h-3 w-3" /></button>
              </div>
            }
          />
          {ticketsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : openTickets.length > 0 ? (
            <div className="space-y-2">
              {openTickets.map(ticket => (
                <div key={ticket.ticketNumber} className="p-3 rounded-xl border-l-4 border-red-400 bg-red-50">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[11px] font-bold text-red-700 font-mono">{ticket.ticketNumber}</p>
                    <span className="text-[10px] text-red-400">{new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <p className="text-xs text-foreground line-clamp-2">{ticket.issue}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={MessageSquare} message="No open tickets right now." />
          )}
        </motion.div>

        {/* Announcements */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
          <SectionHeading
            title="Announcements"
            subtitle="Branch & system notices"
            accent="blue"
            action={
              <button type="button" onClick={() => navigate("/announcements")} className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1">View all <ChevronRight className="h-3 w-3" /></button>
            }
          />
          {announcementsLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : announcements.length > 0 ? (
            <div className="space-y-2">
              {announcements.map(a => (
                <div key={a.id} className={`p-3 rounded-xl border-l-4 ${ANN_DOT[a.type] ? `border-l-[${ANN_DOT[a.type]}]` : "border-l-border"} bg-muted/40`}
                  style={{ borderLeftColor: a.type === "CLOSURE" ? "#f87171" : a.type === "HOLIDAY" ? "#fbbf24" : "#60a5fa" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ANN_COLOR[a.type] || "bg-muted text-muted-foreground"}`}>
                      {ANN_LABEL[a.type] || a.type}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
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

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function AdminDashboard() {
  const navigate = useNavigate();

  const [summaryLoading, setSummaryLoading]             = useState(true);
  const [kpiLoading, setKpiLoading]                     = useState(true);
  const [analyticsLoading, setAnalyticsLoading]         = useState(true);
  const [inventoryLoading, setInventoryLoading]         = useState(true);
  const [ticketsLoading, setTicketsLoading]             = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const [orders, setOrders] = useState({ pending: 0, washing: 0, drying: 0, ready: 0 });
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

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const run = async () => {
      try { const d = await dashboardApi.summary(); setOrders(d.orders); setRecentOrders((d.recentOrders || []).map(mapOrder)); } catch { /**/ } finally { setSummaryLoading(false); }
      try { setKpi(await inventoryApi.operationsKpi()); } catch { /**/ } finally { setKpiLoading(false); }
      try {
        const d = await analyticsApi.summary({ fromDate: todayStr, toDate: todayStr });
        setAnalytics({ totalRevenue: d.totalRevenue, totalOrders: d.totalOrders, branchBreakdown: d.branchBreakdown || [], paymentMethodBreakdown: d.paymentMethodBreakdown || {} });
      } catch { /**/ } finally { setAnalyticsLoading(false); }
      try { const d = await inventoryApi.alerts(); setLowStockItems(d.filter(i => i.lowStock)); } catch { /**/ } finally { setInventoryLoading(false); }
      try { const d = await supportApi.allTickets(); setOpenTicketCount((d as Array<{ status: string }>).filter(t => t.status === "OPEN").length); } catch { /**/ } finally { setTicketsLoading(false); }
      try { setAnnouncements((await announcementsApi.list()).slice(0, 4)); } catch { /**/ } finally { setAnnouncementsLoading(false); }
    };
    void run();
  }, [todayStr]);

  const paymentChartData = useMemo(() =>
    Object.entries(analytics?.paymentMethodBreakdown || {}).map(([method, count]) => ({ method, count })),
    [analytics]
  );
  const activeOrders = orders.pending + orders.washing + orders.drying + orders.ready;
  // Split low-stock by type: consumables (quantity-based) vs assets (condition-based)
  const lowStockConsumables = lowStockItems.filter(i => !i.assetType || i.assetType !== "Asset");
  const lowStockConsumableCount = lowStockConsumables.length;
  const outOfStockConsumableCount = lowStockConsumables.filter(i => i.currentStock === 0).length;
  const lowStockCount = lowStockConsumableCount;

  return (
    <motion.div initial="hidden" animate="show" variants={ANIM_CONTAINER} className="space-y-8">

      {/* ── Hero header ── */}
      <motion.div variants={ANIM_ITEM}>
        <DashboardHero 
          greeting={timeGreeting()}
          name={getSessionUser()?.fullName?.split(" ")[0] || "Admin"}
          roleText="Business overview · All branches"
        />
      </motion.div>

      {/* ── 5 Stat Cards (no Machines Available) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <GradientStatCard icon={ShoppingCart}  label="Active Orders"     value={summaryLoading ? "—" : activeOrders}              sub="Live"    variant="navy" />
        <GradientStatCard icon={CheckCircle2}  label="Ready for Delivery" value={summaryLoading ? "—" : orders.ready}             sub="Ready"   variant="mint" />
        <GradientStatCard icon={CalendarDays}  label="Orders Today"      value={kpiLoading ? "—" : (kpi?.ordersToday ?? "—")}     variant="blue" />
        <GradientStatCard icon={TrendingUp}    label="This Week"         value={kpiLoading ? "—" : (kpi?.ordersThisWeek ?? "—")}  variant="violet" />
        <GradientStatCard icon={MessageSquare} label="Open Tickets"      value={ticketsLoading ? "—" : openTicketCount}           sub={openTicketCount > 0 ? "Needs attention" : undefined} variant={openTicketCount > 0 ? "red" : "slate"} />
      </div>

      {/* ── Quick Actions (no orders/deliveries for admin) ── */}
      <motion.div variants={ANIM_ITEM}>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionCard
            icon={Users}
            label="User Management"
            description="Manage staff accounts, roles & branch access"
            variant="navy"
            onClick={() => navigate("/users")}
          />
          <QuickActionCard
            icon={BarChart3}
            label="AI Analytics & Reports"
            description="Revenue trends, branch performance & export"
            variant="violet"
            onClick={() => navigate("/analytics")}
          />
          <QuickActionCard
            icon={Package}
            label="Inventory Overview"
            description={
              !inventoryLoading && outOfStockConsumableCount > 0
                ? `${outOfStockConsumableCount} supply item${outOfStockConsumableCount !== 1 ? "s" : ""} out of stock across branches`
                : !inventoryLoading && lowStockConsumableCount > 0
                  ? `${lowStockConsumableCount} item${lowStockConsumableCount !== 1 ? "s" : ""} need restocking`
                  : "Check stock levels across all branches"
            }
            badge={!inventoryLoading && lowStockConsumableCount > 0 ? lowStockConsumableCount : undefined}
            variant="gold"
            onClick={() => navigate("/inventory")}
          />
          <QuickActionCard
            icon={MessageSquare}
            label="Support Tickets"
            description={!ticketsLoading && openTicketCount > 0 ? `${openTicketCount} open ticket${openTicketCount !== 1 ? "s" : ""} awaiting response` : "Review customer support issues"}
            badge={!ticketsLoading && openTicketCount > 0 ? openTicketCount : undefined}
            badgePulse={openTicketCount > 0}
            variant="red"
            onClick={() => navigate("/support-tickets")}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <QuickActionCard
            icon={Megaphone}
            label="Announcements"
            description="Post notices to branches or all staff"
            variant="blue"
            onClick={() => navigate("/announcements")}
          />
          <QuickActionCard
            icon={Layers}
            label="Predictive Inventory"
            description="AI-powered stock forecasting & reorder planning"
            variant="teal"
            onClick={() => navigate("/inventory")}
          />
        </div>
      </motion.div>

      {/* ── Revenue + Branch breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Revenue snapshot */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 pb-4" style={{ background: "linear-gradient(135deg, hsl(218,58%,20%) 0%, hsl(218,58%,30%) 100%)" }}>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-white/70" />
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Today's Revenue</p>
            </div>
            {analyticsLoading
              ? <div className="h-9 w-36 bg-white/20 rounded animate-pulse mt-1" />
              : analytics
                ? <p className="text-3xl sm:text-4xl font-bold text-white mt-1">{formatCurrency(analytics.totalRevenue)}</p>
                : <p className="text-2xl font-bold text-white/50 mt-1">No data</p>
            }
            {!analyticsLoading && analytics && (
              <p className="text-white/60 text-xs mt-1">
                From <span className="text-white font-semibold">{analytics.totalOrders}</span> orders across all branches
              </p>
            )}
          </div>
          <div className="p-5 pt-4">
            {analyticsLoading ? (
              <div className="h-28 bg-muted rounded-xl animate-pulse" />
            ) : paymentChartData.length > 0 ? (
              <>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Payment Methods</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={paymentChartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="method" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: "12px", color: "hsl(var(--foreground))" }}
                      cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                      {paymentChartData.map(entry => (
                        <Cell key={entry.method} fill={PAYMENT_COLORS[entry.method] || "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <EmptyState icon={CreditCard} message="No payment data for today." />
            )}
            <button type="button" onClick={() => navigate("/analytics")}
              className="mt-3 text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              Open full analytics report <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>

        {/* Branch breakdown */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 pb-4" style={{ background: "linear-gradient(135deg, hsl(168,55%,32%) 0%, hsl(168,55%,42%) 100%)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-white/70" />
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Branch Overview</p>
            </div>
            <p className="text-white/60 text-xs mt-0.5">Orders & revenue by branch today</p>
          </div>
          <div className="p-5">
            {analyticsLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />)}</div>
            ) : analytics && analytics.branchBreakdown.length > 0 ? (
              <div className="space-y-2">
                {analytics.branchBreakdown.sort((a, b) => b.revenue - a.revenue).map((b, i) => (
                  <div key={b.branch} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors">
                    <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{b.branch}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="h-1 rounded-full bg-primary/20 flex-1 overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${analytics.branchBreakdown.length > 0 ? Math.round((b.totalOrders / Math.max(...analytics.branchBreakdown.map(x => x.totalOrders), 1)) * 100) : 0}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{b.totalOrders} orders</span>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-emerald-700 shrink-0">{formatCurrency(b.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={BarChart3} message="No branch data available for today." />
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Recent Orders ── */}
      <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl p-6">
        <SectionHeading
          title="Recent Orders"
          subtitle="Latest orders across all branches"
          accent="navy"
          action={
            <button type="button" onClick={() => navigate("/orders")}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          }
        />
        <RecentOrdersTable orders={recentOrders} loading={summaryLoading} showBranch={true} />
      </motion.div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* System consumable supply alerts */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-border/50" style={lowStockConsumableCount > 0 ? {
            borderLeftWidth: 4,
            borderLeftColor: outOfStockConsumableCount > 0 ? "#ef4444" : "#f59e0b",
            paddingLeft: "1.25rem"
          } : {}}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Supply Alerts</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Consumable stock across all branches</p>
              </div>
              <div className="flex items-center gap-2">
                {!inventoryLoading && outOfStockConsumableCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="h-3 w-3" /> {outOfStockConsumableCount} out of stock
                  </span>
                )}
                {!inventoryLoading && lowStockConsumableCount > outOfStockConsumableCount && (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="h-3 w-3" /> {lowStockConsumableCount - outOfStockConsumableCount} low
                  </span>
                )}
                <button type="button" onClick={() => navigate("/inventory")} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  Manage <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {inventoryLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />)}</div>
            ) : lowStockConsumables.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border/50">
                      <th className="text-left pb-2.5 font-semibold">Item</th>
                      <th className="text-left pb-2.5 font-semibold hidden sm:table-cell">Branch</th>
                      <th className="text-left pb-2.5 font-semibold">Status</th>
                      <th className="text-right pb-2.5 font-semibold">Stock</th>
                      <th className="text-right pb-2.5 font-semibold">Reorder At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {lowStockConsumables.slice(0, 8).map(item => {
                      const isZero = item.currentStock === 0;
                      return (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5">
                            <p className="text-xs font-semibold text-foreground">{item.itemName}</p>
                            <p className="text-[10px] text-muted-foreground">{item.category}</p>
                          </td>
                          <td className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{item.branch}</td>
                          <td className="py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isZero ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {isZero ? "Out of Stock" : "Low Stock"}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <span className={`text-xs font-bold ${isZero ? "text-red-700" : "text-amber-700"}`}>
                              {item.currentStock} {item.unit}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-xs text-muted-foreground">{item.reorderLevel} {item.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Package} message="All consumable stock levels are sufficient." />
            )}
          </div>
        </motion.div>

        {/* Announcements */}
        <motion.div variants={ANIM_ITEM} className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Latest Announcements</h2>
                <p className="text-xs text-muted-foreground mt-0.5">System & branch notices</p>
              </div>
              <button type="button" onClick={() => navigate("/announcements")} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Post / View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="p-6">
            {announcementsLoading ? (
              <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
            ) : announcements.length > 0 ? (
              <div className="space-y-2.5">
                {announcements.map(a => (
                  <div key={a.id} className="p-3.5 rounded-xl bg-muted/40 border border-border/40"
                    style={{ borderLeftWidth: 4, borderLeftColor: a.type === "CLOSURE" ? "#f87171" : a.type === "HOLIDAY" ? "#fbbf24" : "#60a5fa" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ANN_COLOR[a.type] || "bg-muted text-muted-foreground"}`}>
                        {ANN_LABEL[a.type] || a.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{a.targetAllBranches ? "All Branches" : (a.branch || "All Branches")}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                    <p className="text-xs font-semibold text-foreground">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
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
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const user = getSessionUser();
  return user?.role === "ADMIN" ? <AdminDashboard /> : <StaffDashboard />;
}
