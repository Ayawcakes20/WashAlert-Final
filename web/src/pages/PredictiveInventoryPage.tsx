import { useEffect, useMemo, useRef, useState } from "react";
import {
  Package,
  AlertTriangle,
  TrendingUp,
  Droplets,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CalendarClock,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Wrench,
  ShoppingCart,
  BarChart2,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { inventoryApi, branchesApi, type InventoryRecord, type BookingPipelineRecord } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getSessionUser } from "@/lib/session";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ──────────────────────────────────────────────────────────────────────

type DailyStatsRecord = {
  itemName: string;
  branch: string;
  unit: string;
  days: Array<{ date: string; consumed: number }>;
};

// ── Catalog ───────────────────────────────────────────────────────────────────

const CONSUMABLE_CATALOG = [
  { name: "Surf Detergent",           category: "Detergent",          unit: "packs" },
  { name: "Ariel Detergent",          category: "Detergent",          unit: "packs" },
  { name: "Charm Fabric Conditioner", category: "Fabric Conditioner", unit: "packs" },
  { name: "Downy Fabric Conditioner", category: "Fabric Conditioner", unit: "packs" },
] as const;

const ASSET_CATALOG = [
  { name: "LG Washing Machine",        brand: "LG",        category: "Washing Machine", unit: "units" },
  { name: "Samsung Washing Machine",   brand: "Samsung",   category: "Washing Machine", unit: "units" },
  { name: "Whirlpool Washing Machine", brand: "Whirlpool", category: "Washing Machine", unit: "units" },
  { name: "Condura Washing Machine",   brand: "Condura",   category: "Washing Machine", unit: "units" },
  { name: "LG Dryer",                  brand: "LG",        category: "Dryer",           unit: "units" },
  { name: "Samsung Dryer",             brand: "Samsung",   category: "Dryer",           unit: "units" },
  { name: "Condura Dryer",             brand: "Condura",   category: "Dryer",           unit: "units" },
  { name: "Carrier Aircon",            brand: "Carrier",   category: "Aircon",          unit: "units" },
  { name: "Panasonic Aircon",          brand: "Panasonic", category: "Aircon",          unit: "units" },
  { name: "Samsung Aircon",            brand: "Samsung",   category: "Aircon",          unit: "units" },
  { name: "Generic Electric Fan",      brand: "Generic",   category: "Electric Fan",    unit: "units" },
  { name: "Panasonic Electric Fan",    brand: "Panasonic", category: "Electric Fan",    unit: "units" },
] as const;

const INVENTORY_CATEGORIES = [
  "Detergent", "Fabric Conditioner",
  "Washing Machine", "Dryer", "Aircon", "Electric Fan",
] as const;

const INVENTORY_UNITS = ["packs", "liters", "kg", "bottles", "pieces", "units"] as const;
const ASSET_STATUSES = ["Active", "Under Maintenance", "Decommissioned"] as const;

const DEFAULT_TABLE_PAGE_SIZE = 10;
const TABLE_PAGE_SIZES = [10, 25, 50] as const;
const ATTENTION_DEFAULT_LIMIT = 5;
const CONSUMABLE_NAMES = [
  "Surf Detergent",
  "Ariel Detergent",
  "Charm Fabric Conditioner",
  "Downy Fabric Conditioner",
];

const CONSUMABLE_DEFAULTS: Record<string, { category: string; unit: string; reorderLevel: number }> = {
  "Surf Detergent":           { category: "Detergent",          unit: "packs", reorderLevel: 2 },
  "Ariel Detergent":          { category: "Detergent",          unit: "packs", reorderLevel: 5 },
  "Charm Fabric Conditioner": { category: "Fabric Conditioner", unit: "packs", reorderLevel: 1 },
  "Downy Fabric Conditioner": { category: "Fabric Conditioner", unit: "packs", reorderLevel: 10 },
};

const ASSET_TYPES = ["Washing Machine", "Dryer", "Aircon", "Electric Fan"] as const;

const ASSET_MAINTENANCE_INTERVALS: Record<string, number> = {
  "Washing Machine": 90,
  "Dryer": 90,
  "Aircon": 180,
  "Electric Fan": 365,
};

// ── InventoryItem type ────────────────────────────────────────────────────────

interface InventoryItem {
  id: number;
  product: string;
  type: "Detergent" | "Fabric Conditioner" | "Asset" | "Other";
  branch: string;
  currentStock: number;
  reorderLevel: number;
  unit: string;
  category: string;
  forecastedUsage: number;
  daysUntilEmpty: number | null;
  projectedAfter7Days: number;
  status: "Healthy" | "Low" | "Critical";
  historicalDailyUsage: number;
  confirmedDemand7D: number;
  isAsset: boolean;
  assetType?: string | null;
  purchaseDate?: string | null;
  lastServicedDate?: string | null;
  maintenanceIntervalDays?: number | null;
  assetStatus?: string | null;
  daysUntilService?: number | null;
  supplierLeadTimeDays?: number | null;
}

// ── Helper functions ──────────────────────────────────────────────────────────

function calcDaysRemaining(currentStock: number, avgDailyUsage: number): number | null {
  if (avgDailyUsage < 0.001) return null;
  return Math.floor(currentStock / avgDailyUsage);
}

function calcDaysUntilService(
  lastServicedDate: string | null | undefined,
  maintenanceIntervalDays: number | null | undefined,
): number | null {
  if (!lastServicedDate || !maintenanceIntervalDays) return null;
  const last = new Date(lastServicedDate);
  const next = new Date(last.getTime() + maintenanceIntervalDays * 24 * 60 * 60 * 1000);
  return Math.floor((next.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function getStatus(daysRemaining: number | null): "Healthy" | "Low" | "Critical" {
  if (daysRemaining === null) return "Healthy";
  if (daysRemaining <= 7) return "Critical";
  if (daysRemaining <= 14) return "Low";
  return "Healthy";
}

function normalizeBranchName(branch?: string): string {
  return (branch ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getCanonicalBranchName(branch?: string): string {
  const normalized = normalizeBranchName(branch);
  const aliases: Record<string, string> = {
    "triplets - makati": "Makati Branch",
    makati: "Makati Branch",
    "makati branch": "Makati Branch",
    "jp rizal": "JP Rizal Branch",
  };
  if (aliases[normalized]) return aliases[normalized];
  const cleaned = (branch ?? "").trim();
  return cleaned || "Unknown Branch";
}

function getRecommendedAction(item: InventoryItem): string {
  if (item.status === "Critical") return "Restock now";
  if (item.status === "Low") return "Plan restock";
  return "Healthy";
}

function formatQuantity(value: number | null | undefined, unit?: string, emptyText = "Not enough data"): string {
  if (typeof value !== "number" || Number.isNaN(value)) return emptyText;
  const rawUnit = unit?.trim() ?? "";
  const safeUnit = rawUnit && !/^\d+$/.test(rawUnit) ? rawUnit : "units";
  const normalized = Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
  return `${normalized} ${safeUnit}`;
}

function formatExpectedUse7D(item: InventoryItem): string {
  if (item.forecastedUsage <= 0.001) return "No recent usage";
  return formatQuantity(item.forecastedUsage * 7, item.unit);
}

function buildForecastBasis(item: InventoryItem): string {
  const hasHist = item.historicalDailyUsage > 0.001;
  const hasDemand = item.confirmedDemand7D > 0.001;
  if (hasHist && hasDemand) {
    return `Forecast basis: ${item.historicalDailyUsage.toFixed(1)} ${item.unit}/day historical usage plus ${item.confirmedDemand7D.toFixed(0)} ${item.unit} confirmed demand in 7 days.`;
  }
  if (hasHist) return `Forecast basis: ${item.historicalDailyUsage.toFixed(1)} ${item.unit}/day historical usage. No upcoming confirmed demand yet.`;
  if (hasDemand) return `Forecast basis: ${item.confirmedDemand7D.toFixed(0)} ${item.unit} confirmed demand in 7 days. No historical usage yet.`;
  return "Forecast basis: no recent usage and no upcoming confirmed demand yet.";
}

function buildNarrative(item: InventoryItem): string {
  const days = item.daysUntilEmpty !== null ? `${item.daysUntilEmpty} day(s)` : "not enough data yet";
  return `${item.product} at ${item.branch} has ${item.currentStock} ${item.unit} in stock with ${days} remaining. Recommended action: ${getRecommendedAction(item)}.`;
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function offsetDate(base: Date, dayOffset: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

// ── Status style map ──────────────────────────────────────────────────────────

const statusStyle: Record<string, string> = {
  Healthy: "bg-emerald-100 text-emerald-700",
  Low: "bg-amber-100 text-amber-700",
  Critical: "bg-red-100 text-red-700",
};

const assetStatusStyle: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  "Under Maintenance": "bg-amber-100 text-amber-700",
  Decommissioned: "bg-red-100 text-red-700",
};

const DONUT_COLORS = ["#EF4444", "#F59E0B", "#10B981"];
const BAR_COLORS = ["hsl(218,58%,20%)", "hsl(218,58%,36%)", "hsl(218,58%,52%)", "hsl(218,58%,68%)"];
const HEATMAP_DAYS_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Sub-components ─────────────────────────────────────────────────────────────

function Paginator({
  page, total, pageSize, pageSizes, onPageSizeChange, onPage,
}: {
  page: number; total: number; pageSize: number;
  pageSizes: readonly number[]; onPageSizeChange: (size: number) => void; onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/20 bg-muted/10 text-sm text-muted-foreground">
      <span>Page {page} of {pages} ({total} item{total !== 1 ? "s" : ""})</span>
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Rows:</label>
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground">
          {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)}
          className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function InfoHint({ text }: { text: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; placeAbove: boolean }>({ top: 0, left: 0, placeAbove: false });
  const TIP_WIDTH = 300;
  const show = () => {
    const el = btnRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); const vw = window.innerWidth; const vh = window.innerHeight;
    let left = r.left + r.width / 2 - TIP_WIDTH / 2;
    left = Math.max(8, Math.min(left, vw - TIP_WIDTH - 8));
    const placeAbove = vh - r.bottom < 150;
    setPos({ top: placeAbove ? r.top - 8 : r.bottom + 8, left, placeAbove });
    setOpen(true);
  };
  return (
    <span className="relative inline-flex items-center">
      <button ref={btnRef} type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
        aria-label={text} onMouseEnter={show} onMouseLeave={() => setOpen(false)} onFocus={show} onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); open ? setOpen(false) : show(); }}>
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span role="tooltip" style={{ position: "fixed", top: pos.top, left: pos.left, width: TIP_WIDTH, maxWidth: "calc(100vw - 16px)", transform: pos.placeAbove ? "translateY(-100%)" : undefined, zIndex: 9999 }}
          className="pointer-events-none rounded-lg border border-slate-300 bg-slate-900 px-3 py-2 text-[13px] font-medium leading-relaxed text-white shadow-xl whitespace-normal">
          {text}
        </span>
      )}
    </span>
  );
}

function StockBar({ current, reorder, max }: { current: number; reorder: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const color = current <= reorder ? "#EF4444" : current <= reorder * 1.5 ? "#F59E0B" : "#10B981";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

// ── 30-day forecast chart data ────────────────────────────────────────────────

function buildTwoLayerChart(item: InventoryItem): Array<{ day: string; stock: number; reorderLevel: number; layer: string }> {
  if (item.forecastedUsage < 0.001) return [];
  const hist = item.historicalDailyUsage || item.forecastedUsage;
  const conf7d = item.confirmedDemand7D;
  return Array.from({ length: 30 }, (_, idx) => {
    const dayNum = idx + 1;
    let dailyUsage: number;
    if (dayNum <= 7 && conf7d > 0.001) {
      dailyUsage = (conf7d / 7) * 0.4 + hist * 0.6;
    } else {
      dailyUsage = hist;
    }
    return {
      day: `Day ${dayNum}`,
      stock: Math.max(0, Math.round((item.currentStock - dailyUsage * dayNum) * 10) / 10),
      reorderLevel: item.reorderLevel,
      layer: dayNum <= 7 ? "confirmed" : "historical",
    };
  });
}

// ── mapInventoryRecord ─────────────────────────────────────────────────────────

function mapInventoryRecord(
  record: InventoryRecord,
  forecastMap: Map<number, { usage: number; historical: number; confirmed7D: number }>,
): InventoryItem {
  const isAsset = record.assetType === "Asset";
  const itemForecast = isAsset ? undefined : forecastMap.get(record.id);
  const dailyUsage = itemForecast?.usage ?? 0;
  const catLower = (record.category ?? "").toLowerCase();
  const type: InventoryItem["type"] = catLower.includes("conditioner") ? "Fabric Conditioner"
    : catLower.includes("detergent") ? "Detergent" : isAsset ? "Asset" : "Other";
  const daysRemaining = isAsset ? null : calcDaysRemaining(Number(record.currentStock || 0), dailyUsage);
  const status = isAsset ? "Healthy" : getStatus(daysRemaining);
  const daysUntilService = calcDaysUntilService(record.lastServicedDate, record.maintenanceIntervalDays);
  return {
    id: record.id,
    product: record.itemName,
    type,
    branch: getCanonicalBranchName(record.branch),
    currentStock: Number(record.currentStock || 0),
    reorderLevel: Number(record.reorderLevel || 0),
    unit: record.unit || "packs",
    category: record.category || "General",
    forecastedUsage: dailyUsage,
    projectedAfter7Days: Math.max(0, Number(record.currentStock || 0) - dailyUsage * 7),
    status,
    daysUntilEmpty: isAsset ? null : daysRemaining,
    historicalDailyUsage: itemForecast?.historical ?? 0,
    confirmedDemand7D: itemForecast?.confirmed7D ?? 0,
    isAsset,
    assetType: record.assetType,
    purchaseDate: record.purchaseDate,
    lastServicedDate: record.lastServicedDate,
    maintenanceIntervalDays: record.maintenanceIntervalDays,
    assetStatus: record.assetStatus || (isAsset ? "Active" : undefined),
    daysUntilService,
    supplierLeadTimeDays: record.supplierLeadTimeDays,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PredictiveInventoryPage() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const userBranch = getCanonicalBranchName(user?.branch || "");

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStatsRecord[]>([]);
  const [orderStats, setOrderStats] = useState<DailyStatsRecord[]>([]);
  const [pendingConsumption, setPendingConsumption] = useState<Record<string, number>>({});
  const [bookingPipelineData, setBookingPipelineData] = useState<BookingPipelineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("All");
  const [branches, setBranches] = useState<string[]>([]);
  const [dynamicBranches, setDynamicBranches] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Critical" | "Low" | "Healthy">("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<"all" | "consumable" | "asset">("all");
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [activeVizTab, setActiveVizTab] = useState<"runway" | "rhythm" | "wave" | "pipeline" | "anomaly" | "risk" | "maintenance">("runway");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [donutSegmentFilter, setDonutSegmentFilter] = useState<"all" | "Critical" | "Low" | "Healthy">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    branch: "", itemName: "", category: "", unit: "", currentStock: "0", reorderLevel: "0",
    assetType: "Consumable", brand: "", purchaseDate: "", lastServicedDate: "", maintenanceIntervalDays: "", assetStatus: "Active",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    branch: "", itemName: "", category: "", unit: "", reorderLevel: "0",
    assetType: "Consumable", brand: "", purchaseDate: "", lastServicedDate: "", maintenanceIntervalDays: "", assetStatus: "Active",
  });

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ quantityDelta: "0", direction: "OUT" as "IN" | "OUT", reason: "" });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [markServicedId, setMarkServicedId] = useState<number | null>(null);
  const [markServicedLoading, setMarkServicedLoading] = useState(false);

  const [orderedItemIds, setOrderedItemIds] = useState<Set<number>>(new Set());

  const loadInventory = async () => {
    try {
      setError("");
      const [items, _alerts, forecastResp, pending, stats, activityStats, pipelineData] = await Promise.all([
        inventoryApi.list(),
        inventoryApi.alerts(),
        inventoryApi.forecast(7),
        inventoryApi.pendingConsumption().catch(() => ({})),
        inventoryApi.dailyStats(60).catch(() => [] as DailyStatsRecord[]),
        inventoryApi.orderActivityStats(60).catch(() => [] as DailyStatsRecord[]),
        inventoryApi.bookingPipeline(14).catch(() => [] as BookingPipelineRecord[]),
      ]);
      setPendingConsumption(pending || {});
      setDailyStats((stats as DailyStatsRecord[]) || []);
      setOrderStats((activityStats as DailyStatsRecord[]) || []);
      setBookingPipelineData((pipelineData as BookingPipelineRecord[]) || []);
      const forecastMap = new Map<number, { usage: number; historical: number; confirmed7D: number }>();
      (forecastResp || []).forEach((f) => {
        const usage = Number(f.projectedDailyUsage ?? f.estimatedDailyUsage ?? 0);
        forecastMap.set(f.itemId, {
          usage,
          historical: Number(f.historicalDailyUsage ?? f.estimatedDailyUsage ?? 0),
          confirmed7D: Number(f.confirmedDemand7D ?? 0),
        });
      });
      const mapped = (items || []).map((i) => mapInventoryRecord(i, forecastMap));
      const dedupedMap = new Map<string, InventoryItem>();
      mapped.forEach((item) => {
        const key = `${item.product}||${normalizeBranchName(item.branch)}`;
        if (!dedupedMap.has(key)) dedupedMap.set(key, item);
      });
      const deduped = Array.from(dedupedMap.values()).filter((item) => {
        if (isStaff) return normalizeBranchName(item.branch) === normalizeBranchName(userBranch);
        return true;
      });
      setInventory(deduped);
      setBranches(Array.from(new Set(deduped.map((i) => i.branch))).sort());
    } catch (err: any) {
      setError(err?.message || "Unable to load inventory data.");
      setInventory([]);
    }
  };

  useEffect(() => {
    const run = async () => { setLoading(true); await loadInventory(); setLoading(false); };
    void run();
    branchesApi.list()
      .then((list) => setDynamicBranches(Array.from(new Set(list.map((b) => getCanonicalBranchName(b)))).sort()))
      .catch(() => setDynamicBranches([]));
  }, []);

  const filteredInventory = useMemo(() => {
    let items: InventoryItem[];
    if (isStaff) items = inventory;
    else if (selectedTab === "All") items = inventory;
    else items = inventory.filter((i) => i.branch === selectedTab);
    if (itemTypeFilter === "consumable") items = items.filter((i) => !i.isAsset);
    if (itemTypeFilter === "asset") items = items.filter((i) => i.isAsset);
    if (categoryFilter !== "all") items = items.filter((i) => i.category === categoryFilter);
    const effectiveStatus = donutSegmentFilter !== "all" ? donutSegmentFilter : statusFilter;
    if (effectiveStatus !== "all") items = items.filter((i) => i.status === effectiveStatus);
    return [...items].sort((a, b) => {
      const score = (s: InventoryItem) => s.status === "Critical" ? 0 : s.status === "Low" ? 1 : 2;
      return score(a) - score(b);
    });
  }, [inventory, selectedTab, isStaff, categoryFilter, statusFilter, itemTypeFilter, donutSegmentFilter]);

  const consumableItems = useMemo(() => filteredInventory.filter((i) => !i.isAsset), [filteredInventory]);
  const assetItems = useMemo(() => filteredInventory.filter((i) => i.isAsset), [filteredInventory]);
  const allConsumables = useMemo(() => inventory.filter((i) => !i.isAsset), [inventory]);
  const allAssets = useMemo(() => inventory.filter((i) => i.isAsset), [inventory]);

  const summary = useMemo(() => {
    const critical = filteredInventory.filter((i) => i.status === "Critical").length;
    const low = filteredInventory.filter((i) => i.status === "Low").length;
    const healthy = filteredInventory.filter((i) => i.status === "Healthy").length;
    const urgent = filteredInventory.filter((i) => i.status !== "Healthy")
      .sort((a, b) => {
        if (a.daysUntilEmpty === null) return 1;
        if (b.daysUntilEmpty === null) return -1;
        return a.daysUntilEmpty - b.daysUntilEmpty;
      })[0] ?? null;
    return { critical, low, healthy, urgent };
  }, [filteredInventory]);

  const actionItems = useMemo(() => {
    const criticalCount = allConsumables.filter((i) => i.status === "Critical").length;
    const overdueAssets = allAssets.filter(
      (i) => i.daysUntilService !== null && i.daysUntilService !== undefined && i.daysUntilService < 0,
    ).length;
    const dueSoonAssets = allAssets.filter(
      (i) => i.daysUntilService !== null && i.daysUntilService !== undefined && i.daysUntilService >= 0 && i.daysUntilService <= 10,
    ).length;
    return { criticalCount, overdueAssets, dueSoonAssets };
  }, [allConsumables, allAssets]);

  const needsAttention = useMemo(() => {
    return filteredInventory.filter((i) => !i.isAsset && (i.status === "Critical" || i.status === "Low"))
      .sort((a, b) => {
        const scoreA = a.status === "Critical" ? 0 : 1;
        const scoreB = b.status === "Critical" ? 0 : 1;
        if (scoreA !== scoreB) return scoreA - scoreB;
        if (a.daysUntilEmpty === null) return 1;
        if (b.daysUntilEmpty === null) return -1;
        return a.daysUntilEmpty - b.daysUntilEmpty;
      });
  }, [filteredInventory]);

  const reorderSuggestions = useMemo(() => {
    return needsAttention.map((item) => {
      const recommended = Math.max(0, Math.round(item.historicalDailyUsage * 30 - item.currentStock));
      return { ...item, recommended };
    });
  }, [needsAttention]);

  const visibleAttention = showAllAttention ? needsAttention : needsAttention.slice(0, ATTENTION_DEFAULT_LIMIT);

  const pagedTable = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredInventory.slice(start, start + tablePageSize);
  }, [filteredInventory, tablePage, tablePageSize]);

  const branchOverview = useMemo(() => {
    const grouped = new Map<string, InventoryItem[]>();
    inventory.forEach((item) => {
      if (!grouped.has(item.branch)) grouped.set(item.branch, []);
      grouped.get(item.branch)?.push(item);
    });
    return Array.from(grouped.entries()).map(([branch, items]) => {
      const critical = items.filter((i) => i.status === "Critical").length;
      const low = items.filter((i) => i.status === "Low").length;
      const healthy = items.filter((i) => i.status === "Healthy").length;
      const urgent = items.filter((i) => i.status !== "Healthy").sort((a, b) => {
        if (a.daysUntilEmpty === null) return 1;
        if (b.daysUntilEmpty === null) return -1;
        return a.daysUntilEmpty - b.daysUntilEmpty;
      })[0] ?? null;
      const daysCandidates = items.map((i) => i.daysUntilEmpty).filter((d): d is number => typeof d === "number");
      const fewestDaysLeft = daysCandidates.length ? Math.min(...daysCandidates) : null;
      const expectedUse7DTotal = items.reduce((sum, i) => sum + Math.max(0, i.forecastedUsage * 7), 0);
      return {
        branch, totalItems: items.length, critical, low, healthy,
        urgentItem: urgent?.product ?? "No urgent item", fewestDaysLeft, expectedUse7DTotal,
        action: urgent ? getRecommendedAction(urgent) : "Healthy",
      };
    }).sort((a, b) => {
      if (b.critical !== a.critical) return b.critical - a.critical;
      if (b.low !== a.low) return b.low - a.low;
      const ad = a.fewestDaysLeft ?? Number.POSITIVE_INFINITY;
      const bd = b.fewestDaysLeft ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    });
  }, [inventory]);

  const selectedExpandedItem = useMemo(
    () => filteredInventory.find((item) => item.id === expandedRowId) ?? null,
    [expandedRowId, filteredInventory],
  );
  const selectedItemChart = useMemo(() => {
    if (!selectedExpandedItem || selectedExpandedItem.forecastedUsage < 0.001) return [];
    return buildTwoLayerChart(selectedExpandedItem);
  }, [selectedExpandedItem]);

  // Donut data — based on all consumables (unfiltered)
  const donutData = useMemo(() => {
    return [
      { name: "Critical", value: allConsumables.filter((i) => i.status === "Critical").length },
      { name: "Low", value: allConsumables.filter((i) => i.status === "Low").length },
      { name: "Healthy", value: allConsumables.filter((i) => i.status === "Healthy").length },
    ];
  }, [allConsumables]);

  // Effective stats: order activity is primary (has data as soon as orders start processing),
  // fall back to dailyStats (movement-based) for any item not covered by orderStats
  const effectiveStats = useMemo<DailyStatsRecord[]>(() => {
    const merged = new Map<string, DailyStatsRecord>();
    orderStats.forEach((r) => merged.set(r.itemName, r));
    dailyStats.forEach((r) => { if (!merged.has(r.itemName)) merged.set(r.itemName, r); });
    return Array.from(merged.values());
  }, [orderStats, dailyStats]);

  // 14-Day Consumption Trend — line chart per item with real dates
  const trend14dData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = offsetDate(today, -(13 - i));
      const dateStr = toYMD(d);
      const label = d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      const row: Record<string, number | string> = { date: label };
      CONSUMABLE_NAMES.forEach((name) => {
        const record = effectiveStats.find((r) => r.itemName === name);
        const shortName = name.replace(" Detergent", "").replace(" Fabric Conditioner", "");
        row[shortName] = record?.days.find((dd) => dd.date === dateStr)?.consumed ?? 0;
      });
      return row;
    });
  }, [effectiveStats]);

  const hasTrend14dData = useMemo(
    () => trend14dData.some((row) => CONSUMABLE_NAMES.some((n) => {
      const k = n.replace(" Detergent", "").replace(" Fabric Conditioner", "");
      return (row[k] as number) > 0;
    })),
    [trend14dData],
  );

  const trend14dKeys = CONSUMABLE_NAMES.map((n) => n.replace(" Detergent", "").replace(" Fabric Conditioner", ""));
  const LINE_COLORS = ["hsl(218,58%,30%)", "#16a34a", "#d97706", "#7c3aed"];

  // Weekly comparison insight for 14-day trend
  const trendInsights = useMemo(() => {
    if (!hasTrend14dData) return [];
    const insights: string[] = [];
    CONSUMABLE_NAMES.forEach((name) => {
      const record = effectiveStats.find((r) => r.itemName === name);
      if (!record) return;
      const today = new Date();
      const thisWeek = Array.from({ length: 7 }, (_, i) => toYMD(offsetDate(today, -(6 - i))));
      const lastWeek = Array.from({ length: 7 }, (_, i) => toYMD(offsetDate(today, -(13 - i))));
      const thisSum = thisWeek.reduce((s, d) => s + (record.days.find((dd) => dd.date === d)?.consumed ?? 0), 0);
      const lastSum = lastWeek.reduce((s, d) => s + (record.days.find((dd) => dd.date === d)?.consumed ?? 0), 0);
      const shortName = name.replace(" Detergent", "").replace(" Fabric Conditioner", "");
      if (thisSum === 0 && lastSum === 0) return;
      if (lastSum === 0) {
        insights.push(`📦 ${shortName}: ${thisSum.toFixed(0)} packs used this week (no prior week data)`);
      } else {
        const pct = Math.round(((thisSum - lastSum) / lastSum) * 100);
        const arrow = pct > 0 ? "📈" : pct < 0 ? "📉" : "➡";
        insights.push(`${arrow} ${shortName}: ${thisSum.toFixed(0)} packs this week vs ${lastSum.toFixed(0)} last week (${pct > 0 ? "+" : ""}${pct}%)`);
      }
    });
    return insights;
  }, [effectiveStats, hasTrend14dData]);

  // 7-Day History stacked bar
  const history7dData = useMemo(() => {
    const today = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = offsetDate(today, -(6 - i));
      return { date: toYMD(d), label: d.toLocaleDateString("en-PH", { weekday: "short", month: "numeric", day: "numeric" }) };
    });
    return last7.map(({ date, label }) => {
      const row: Record<string, number | string> = { day: label };
      CONSUMABLE_NAMES.forEach((name) => {
        const record = effectiveStats.find((r) => r.itemName === name);
        const shortName = name.replace(" Detergent", "").replace(" Fabric Conditioner", "");
        row[shortName] = record?.days.find((d) => d.date === date)?.consumed ?? 0;
      });
      return row;
    });
  }, [effectiveStats]);

  const history7dKeys = CONSUMABLE_NAMES.map((n) => n.replace(" Detergent", "").replace(" Fabric Conditioner", ""));

  const hasHistory7dData = useMemo(
    () => history7dData.some((row) => history7dKeys.some((k) => (row[k] as number) > 0)),
    [history7dData],
  );

  // Peak Heatmap — avg by day-of-week from last 60 days
  const heatmapData = useMemo(() => {
    const jsDowForCol = [1, 2, 3, 4, 5, 6, 0];
    return CONSUMABLE_NAMES.map((name) => {
      const record = effectiveStats.find((r) => r.itemName === name);
      const buckets: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      record?.days.forEach(({ date, consumed }) => {
        if (consumed > 0) {
          const dow = new Date(date + "T00:00:00").getDay();
          buckets[dow].push(consumed);
        }
      });
      const avgs = jsDowForCol.map((dow) => {
        const arr = buckets[dow];
        return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
      });
      const shortName = name.replace(" Detergent", "").replace(" Fabric Conditioner", "");
      return { name: shortName, avgs };
    });
  }, [effectiveStats]);

  const hasHeatmapData = useMemo(
    () => heatmapData.some((r) => r.avgs.some((v) => v > 0)),
    [heatmapData],
  );

  const heatmapMax = useMemo(() => Math.max(...heatmapData.flatMap((r) => r.avgs), 0.001), [heatmapData]);

  const heatmapInsights = useMemo(() => {
    if (!hasHeatmapData) return [];
    const jsDowForCol = [1, 2, 3, 4, 5, 6, 0];
    const insights: string[] = [];
    // Overall busiest day
    const dayTotals = HEATMAP_DAYS_LABELS.map((_, ci) =>
      heatmapData.reduce((s, row) => s + row.avgs[ci], 0));
    const maxDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
    const minDayIdx = dayTotals.indexOf(Math.min(...dayTotals.filter((v) => v > 0)));
    insights.push(`📌 Busiest day overall: ${HEATMAP_DAYS_LABELS[maxDayIdx]} — prepare stock before ${HEATMAP_DAYS_LABELS[(maxDayIdx - 1 + 7) % 7]}`);
    if (minDayIdx >= 0 && minDayIdx !== maxDayIdx) {
      insights.push(`📌 Slowest day: ${HEATMAP_DAYS_LABELS[minDayIdx]} — good time for inventory counts`);
    }
    // Weekend vs weekday
    const weekdayTotal = [0, 1, 2, 3, 4].reduce((s, i) => s + dayTotals[i], 0) / 5;
    const weekendTotal = [5, 6].reduce((s, i) => s + dayTotals[i], 0) / 2;
    if (weekdayTotal > 0) {
      const diff = Math.round(((weekendTotal - weekdayTotal) / weekdayTotal) * 100);
      insights.push(`📌 Weekend usage is ${Math.abs(diff)}% ${diff >= 0 ? "higher" : "lower"} than weekdays`);
    }
    // Per-item peak day
    heatmapData.forEach((row) => {
      const peakIdx = row.avgs.indexOf(Math.max(...row.avgs));
      if (row.avgs[peakIdx] > 0) {
        insights.push(`📌 ${row.name} peaks on ${HEATMAP_DAYS_LABELS[peakIdx]} (avg ${row.avgs[peakIdx].toFixed(1)} packs)`);
      }
    });
    return insights;
  }, [heatmapData, hasHeatmapData]);

  // Weekday multipliers: per-item relative usage per day-of-week (Mon=idx0 ... Sun=idx6)
  const weekdayMultipliers = useMemo(() => {
    const jsDowForCol = [1, 2, 3, 4, 5, 6, 0];
    const result: Record<string, number[]> = {};
    CONSUMABLE_NAMES.forEach((name) => {
      const record = effectiveStats.find((r) => r.itemName === name);
      if (!record) { result[name] = [1, 1, 1, 1, 1, 1, 1]; return; }
      const buckets: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      record.days.forEach(({ date, consumed }) => {
        if (consumed > 0) { const dow = new Date(date + "T00:00:00").getDay(); buckets[dow].push(consumed); }
      });
      const avgs = jsDowForCol.map((dow) => {
        const arr = buckets[dow]; return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
      });
      const totalAvg = avgs.reduce((s, v) => s + v, 0) / 7;
      result[name] = totalAvg > 0 ? avgs.map((a) => a / totalAvg) : [1, 1, 1, 1, 1, 1, 1];
    });
    return result;
  }, [effectiveStats]);

  // 1. Demand Rhythm Curve — avg packs per weekday
  const rhythmData = useMemo(() => {
    return HEATMAP_DAYS_LABELS.map((dayLabel, colIdx) => {
      const row: Record<string, number | string> = { day: dayLabel };
      CONSUMABLE_NAMES.forEach((name) => {
        const multipliers = weekdayMultipliers[name] ?? [1, 1, 1, 1, 1, 1, 1];
        const item = allConsumables.find((i) => i.product === name);
        const avgDaily = item?.forecastedUsage ?? 0;
        const shortName = name.replace(" Detergent", "").replace(" Fabric Conditioner", "");
        row[shortName] = Math.round(avgDaily * (multipliers[colIdx] ?? 1) * 100) / 100;
      });
      return row;
    });
  }, [weekdayMultipliers, allConsumables]);

  const hasRhythmData = useMemo(
    () => rhythmData.some((row) => trend14dKeys.some((k) => (row[k] as number) > 0)),
    [rhythmData],
  );

  // 2. Wave-Shaped 30-Day Forecast — weekday-adjusted depletion per item
  const waveForecastData = useMemo(() => {
    return allConsumables.map((item) => {
      if (item.forecastedUsage < 0.001) return null;
      const multipliers = weekdayMultipliers[item.product] ?? [1, 1, 1, 1, 1, 1, 1];
      const today = new Date();
      let stock = item.currentStock;
      const data = Array.from({ length: 30 }, (_, i) => {
        const d = offsetDate(today, i + 1);
        const dowJS = d.getDay();
        const colIdx = dowJS === 0 ? 6 : dowJS - 1;
        const mult = Math.max(0.1, multipliers[colIdx] ?? 1);
        const dailyUsage = item.forecastedUsage * mult;
        stock = Math.max(0, stock - dailyUsage);
        return {
          day: `D${i + 1}`,
          date: d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
          stock: Math.round(stock * 10) / 10,
          reorderLevel: item.reorderLevel,
        };
      });
      return { item, data };
    }).filter(Boolean) as Array<{ item: InventoryItem; data: Array<{ day: string; date: string; stock: number; reorderLevel: number }> }>;
  }, [allConsumables, weekdayMultipliers]);

  // 3. Anomaly Detector — actual vs expected deviation per day (14 days)
  const anomalyData = useMemo(() => {
    return CONSUMABLE_NAMES.map((name) => {
      const record = effectiveStats.find((r) => r.itemName === name);
      if (!record) return null;
      const item = allConsumables.find((i) => i.product === name);
      const avgDaily = item?.forecastedUsage ?? 0;
      if (avgDaily < 0.001) return null;
      const multipliers = weekdayMultipliers[name] ?? [1, 1, 1, 1, 1, 1, 1];
      const today = new Date();
      const points = Array.from({ length: 14 }, (_, i) => {
        const d = offsetDate(today, -(13 - i));
        const dateStr = toYMD(d);
        const label = d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
        const dowJS = d.getDay();
        const colIdx = dowJS === 0 ? 6 : dowJS - 1;
        const expected = Math.round(avgDaily * (multipliers[colIdx] ?? 1) * 10) / 10;
        const actual = record.days.find((dd) => dd.date === dateStr)?.consumed ?? 0;
        const deviation = Math.round((actual - expected) * 10) / 10;
        return { date: label, expected, actual, deviation };
      });
      if (points.every((p) => p.actual === 0 && p.expected === 0)) return null;
      return {
        name: name.replace(" Detergent", "").replace(" Fabric Conditioner", ""),
        fullName: name,
        points,
      };
    }).filter(Boolean) as Array<{ name: string; fullName: string; points: Array<{ date: string; expected: number; actual: number; deviation: number }> }>;
  }, [effectiveStats, weekdayMultipliers, allConsumables]);

  // 4. Stock Runway Table
  const runwayData = useMemo(() => {
    return allConsumables.map((item) => {
      const daysLeft = item.daysUntilEmpty;
      const leadTime = item.supplierLeadTimeDays ?? 3;
      const today = new Date();
      let stockoutDate: string | null = null;
      let mustOrderBy: string | null = null;
      let urgencyStatus: "OK" | "Order Soon" | "Already Late" = "OK";
      if (daysLeft !== null) {
        stockoutDate = offsetDate(today, daysLeft).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
        const orderByDays = daysLeft - leadTime;
        if (orderByDays <= 0) {
          urgencyStatus = "Already Late";
          mustOrderBy = "Order Now";
        } else if (orderByDays <= 7) {
          urgencyStatus = "Order Soon";
          mustOrderBy = offsetDate(today, orderByDays).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
        } else {
          urgencyStatus = "OK";
          mustOrderBy = offsetDate(today, orderByDays).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
        }
      }
      return { ...item, stockoutDate, mustOrderBy, urgencyStatus, leadTime };
    });
  }, [allConsumables]);

  // 5. Inventory Risk Score
  const riskScoreData = useMemo(() => {
    return allConsumables.map((item) => {
      const daysLeft = item.daysUntilEmpty;
      const leadTime = item.supplierLeadTimeDays ?? 3;
      let riskScore = 0;
      let riskLabel = "Low Risk";
      let riskColor = "#10B981";
      if (daysLeft === null || item.forecastedUsage < 0.001) {
        riskScore = 5; riskLabel = "No Data"; riskColor = "#94A3B8";
      } else {
        const safeDays = daysLeft - leadTime;
        if (safeDays <= 0) { riskScore = Math.min(100, 95 + Math.abs(safeDays)); riskLabel = "Critical"; riskColor = "#EF4444"; }
        else if (safeDays <= 3) { riskScore = 80; riskLabel = "High Risk"; riskColor = "#F97316"; }
        else if (safeDays <= 7) { riskScore = 65; riskLabel = "Elevated"; riskColor = "#F59E0B"; }
        else if (daysLeft <= 14) { riskScore = 40; riskLabel = "Moderate"; riskColor = "#EAB308"; }
        else { riskScore = Math.max(5, Math.round(25 - Math.min(20, (daysLeft - 14) / 2))); riskLabel = "Low Risk"; riskColor = "#10B981"; }
      }
      const shortName = item.product.replace(" Detergent", "").replace(" Fabric Conditioner", "");
      return { name: shortName, branch: item.branch.replace(" Branch", ""), riskScore: Math.round(riskScore), riskLabel, riskColor, daysLeft, leadTime, currentStock: item.currentStock, unit: item.unit };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }, [allConsumables]);

  const handleTabChange = (branch: string) => {
    setSelectedTab(branch);
    setTablePage(1);
    setExpandedRowId(null);
  };

  useEffect(() => {
    setTablePage(1);
  }, [selectedTab, tablePageSize, itemTypeFilter, categoryFilter, statusFilter, donutSegmentFilter]);

  const openCreate = () => {
    setCreateForm({
      branch: isAdmin ? "" : userBranch, itemName: "", category: "", unit: "",
      currentStock: "0", reorderLevel: "0", assetType: "Consumable",
      brand: "", purchaseDate: "", lastServicedDate: "", maintenanceIntervalDays: "", assetStatus: "Active",
    });
    setCreateOpen(true);
  };

  const openEdit = (row: InventoryItem) => {
    setSelectedItem(row);
    setEditForm({
      branch: row.branch, itemName: row.product, category: row.category, unit: row.unit, reorderLevel: String(row.reorderLevel),
      assetType: row.assetType || "Consumable", brand: "",
      purchaseDate: row.purchaseDate || "", lastServicedDate: row.lastServicedDate || "",
      maintenanceIntervalDays: row.maintenanceIntervalDays != null ? String(row.maintenanceIntervalDays) : "", assetStatus: row.assetStatus || "Active",
    });
    setEditOpen(true);
  };

  const openAdjust = (row: InventoryItem) => {
    setSelectedItem(row);
    setAdjustForm({ quantityDelta: "0", direction: "IN", reason: "Restock" });
    setAdjustOpen(true);
  };

  const openDelete = (row: InventoryItem) => { setSelectedItem(row); setDeleteOpen(true); };

  const submitCreate = async () => {
    const isAssetCreate = createForm.assetType === "Asset";
    const computedItemName = isAssetCreate
      ? `${createForm.brand.trim()} ${createForm.category.trim()}`.trim()
      : createForm.itemName.trim();
    if (!createForm.branch.trim() || !computedItemName || !createForm.category.trim() || !createForm.unit.trim()) {
      toast.error(isAssetCreate ? "Branch, asset type, and brand are required." : "Branch, item name, category, and unit are required."); return;
    }
    setCreateSubmitting(true);
    try {
      await inventoryApi.create({
        branch: createForm.branch.trim(), itemName: computedItemName,
        category: createForm.category.trim(), unit: createForm.unit.trim(),
        currentStock: Number(createForm.currentStock || 0), reorderLevel: Number(createForm.reorderLevel || 0),
        assetType: createForm.assetType || null,
        purchaseDate: createForm.purchaseDate || null,
        lastServicedDate: createForm.lastServicedDate || null,
        maintenanceIntervalDays: createForm.maintenanceIntervalDays ? Number(createForm.maintenanceIntervalDays) : null,
        assetStatus: isAssetCreate ? (createForm.assetStatus || "Active") : null,
      } as any);
      toast.success("Inventory item created.");
      setCreateOpen(false);
      await loadInventory();
    } catch (err: any) {
      toast.error(err?.message || "Unable to create inventory item.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!selectedItem) return;
    if (!editForm.branch.trim() || !editForm.itemName.trim() || !editForm.category.trim() || !editForm.unit.trim()) {
      toast.error("Branch, item name, category, and unit are required."); return;
    }
    setEditSubmitting(true);
    try {
      await inventoryApi.update(selectedItem.id, {
        branch: editForm.branch.trim(), itemName: editForm.itemName.trim(),
        category: editForm.category.trim(), unit: editForm.unit.trim(), reorderLevel: Number(editForm.reorderLevel || 0),
        assetType: editForm.assetType || null,

        purchaseDate: editForm.purchaseDate || null,
        lastServicedDate: editForm.lastServicedDate || null,
        maintenanceIntervalDays: editForm.maintenanceIntervalDays ? Number(editForm.maintenanceIntervalDays) : null,
        assetStatus: editForm.assetType === "Asset" ? (editForm.assetStatus || "Active") : null,
      } as any);
      toast.success("Inventory item updated.");
      setEditOpen(false);
      await loadInventory();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update inventory item.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const submitAdjust = async () => {
    if (!selectedItem) return;
    if (!adjustForm.reason.trim()) { toast.error("Adjustment reason is required."); return; }
    setAdjustSubmitting(true);
    try {
      await inventoryApi.adjust(selectedItem.id, {
        quantityDelta: Number(adjustForm.quantityDelta || 0), direction: adjustForm.direction, reason: adjustForm.reason.trim(),
      });
      toast.success("Stock updated successfully.");
      setAdjustOpen(false);
      await loadInventory();
    } catch (err: any) {
      toast.error(err?.message || "Unable to adjust stock.");
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const submitDelete = async () => {
    if (!selectedItem) return;
    setDeleteSubmitting(true);
    try {
      await inventoryApi.remove(selectedItem.id);
      toast.success("Inventory item deleted.");
      setDeleteOpen(false);
      await loadInventory();
    } catch (err: any) {
      toast.error(err?.message || "Unable to delete inventory item.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleMarkServiced = async (id: number) => {
    setMarkServicedId(id);
    setMarkServicedLoading(true);
    try {
      await inventoryApi.markServiced(id);
      toast.success("Asset marked as serviced.");
      await loadInventory();
    } catch (err: any) {
      toast.error(err?.message || "Unable to mark as serviced.");
    } finally {
      setMarkServicedLoading(false);
      setMarkServicedId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Predictive Inventory</h1>
          <p className="text-base text-muted-foreground mt-1">
            {isStaff ? `Viewing inventory for ${userBranch || "your branch"}` : "Actionable restock dashboard for all branches."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 px-4 rounded-xl"
            onClick={() => { setLoading(true); loadInventory().finally(() => setLoading(false)); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {(isAdmin || isStaff) && (
            <Button className="h-10 px-5 rounded-xl gradient-navy" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create Item
            </Button>
          )}
        </div>
      </div>

      {/* Action Banner */}
      {!loading && !bannerDismissed && (actionItems.criticalCount > 0 || actionItems.overdueAssets > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-900 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              {actionItems.criticalCount > 0 && (
                <>{actionItems.criticalCount} item{actionItems.criticalCount > 1 ? "s" : ""} need{actionItems.criticalCount === 1 ? "s" : ""} restocking now</>
              )}
              {actionItems.criticalCount > 0 && actionItems.overdueAssets > 0 && " · "}
              {actionItems.overdueAssets > 0 && (
                <>{actionItems.overdueAssets} asset{actionItems.overdueAssets > 1 ? "s" : ""} overdue for service</>
              )}
            </span>
          </div>
          <button onClick={() => setBannerDismissed(true)} className="shrink-0 text-amber-700 hover:text-amber-900 transition-colors" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-6 space-y-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))
          : [
              { label: "Critical Items", value: summary.critical, icon: AlertTriangle, color: "bg-red-100 text-red-700" },
              { label: "Low Items", value: summary.low, icon: CalendarClock, color: "bg-amber-100 text-amber-700" },
              { label: "Healthy Items", value: summary.healthy, icon: TrendingUp, color: "bg-emerald-100 text-emerald-700" },
              { label: "Next Restock Priority", value: summary.urgent ? `${summary.urgent.product} (${summary.urgent.branch})` : "None", icon: Package, color: "bg-primary/10 text-primary" },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-2xl p-6">
                <div className={`p-2.5 rounded-xl ${s.color} w-fit mb-3`}><s.icon className="h-5 w-5" /></div>
                <p className="text-2xl font-bold text-foreground break-words">{s.value}</p>
                <p className="text-base text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
      </div>

      {error && <p className="text-base text-destructive">{error}</p>}

      {/* Branch tabs */}
      {isAdmin && branches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["All", ...branches].map((branch) => (
            <button key={branch} onClick={() => handleTabChange(branch)}
              className={`px-4 py-2 rounded-lg text-base font-medium transition-colors ${selectedTab === branch ? "bg-primary text-primary-foreground" : "bg-background text-foreground border border-border hover:bg-muted"}`}>
              {branch}
            </button>
          ))}
        </div>
      )}

      {/* Reorder Suggestion Engine */}
      {!loading && reorderSuggestions.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border/30 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Reorder Suggestions</h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reorderSuggestions.map((item) => (
              <div key={item.id} className={`rounded-xl border p-4 space-y-2 ${item.status === "Critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[item.status]}`}>{item.status}</span>
                  <p className="font-semibold text-foreground text-base">{item.product} — {item.status}</p>
                </div>
                <p className="text-sm text-muted-foreground">{item.branch}</p>
                <StockBar current={item.currentStock} reorder={item.reorderLevel} max={Math.max(item.reorderLevel * 3, item.currentStock, 1)} />
                <p className="text-sm text-foreground">
                  Current: <strong>{item.currentStock} {item.unit}</strong> | Avg usage: <strong>{item.historicalDailyUsage > 0 ? `${item.historicalDailyUsage.toFixed(1)}/day` : "no data"}</strong> | ~{item.daysUntilEmpty !== null ? `${item.daysUntilEmpty} days left` : "unknown days left"}
                </p>
                {item.recommended > 0 ? (
                  <p className="text-sm font-semibold text-foreground">
                    Reorder <span className={item.status === "Critical" ? "text-red-700" : "text-amber-700"}>{item.recommended} {item.unit}</span>
                    <span className="text-xs text-muted-foreground font-normal ml-1">to maintain 30-day supply</span>
                  </p>
                ) : item.historicalDailyUsage < 0.001 ? (
                  <p className="text-sm text-muted-foreground">Enable usage tracking to get reorder quantity suggestion</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Reorder quantity calculation pending</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => openAdjust(item)}>Add Stock</Button>
                  {orderedItemIds.has(item.id) ? (
                    <Button size="sm" variant="outline" disabled className="text-emerald-700 border-emerald-300">
                      ✓ Marked as Ordered
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="text-primary border-primary/30"
                      onClick={() => setOrderedItemIds((prev) => new Set([...prev, item.id]))}>
                      Mark as Ordered
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs Attention */}
      {!loading && (
        <div className="rounded-2xl border border-border/30 bg-white p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold text-foreground">Needs Attention</h2>
            {needsAttention.length > ATTENTION_DEFAULT_LIMIT && (
              <Button variant="outline" onClick={() => setShowAllAttention((v) => !v)}>
                {showAllAttention ? "Show top 5" : "View all"}
              </Button>
            )}
          </div>
          {visibleAttention.length === 0 ? (
            <p className="text-base text-muted-foreground">All consumable supplies are healthy based on current stock and expected use.</p>
          ) : (
            <div className="space-y-3">
              {visibleAttention.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/30 p-4 bg-muted/10">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-foreground">{item.product}</p>
                      <p className="text-sm text-muted-foreground">{item.branch}</p>
                      <StockBar current={item.currentStock} reorder={item.reorderLevel} max={Math.max(item.reorderLevel * 3, item.currentStock, 1)} />
                      <p className="text-sm text-foreground">
                        Stock: {formatQuantity(item.currentStock, item.unit)} | 7D use: {formatExpectedUse7D(item)} | Days left:{" "}
                        {item.daysUntilEmpty !== null ? `${item.daysUntilEmpty} day(s)` : "Not enough data yet"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusStyle[item.status]}`}>{item.status}</span>
                      <Button size="sm" onClick={() => openAdjust(item)}>Add Stock</Button>
                      <Button size="sm" variant="outline" onClick={() => setExpandedRowId((v) => (v === item.id ? null : item.id))}>View Details</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Type:</span>
            <Select value={itemTypeFilter} onValueChange={(v) => setItemTypeFilter(v as typeof itemTypeFilter)}>
              <SelectTrigger className="h-9 w-[160px] text-sm rounded-lg"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="consumable">Consumables</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Category:</span>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
              <SelectTrigger className="h-9 w-[200px] text-sm rounded-lg"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {INVENTORY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Select
            value={donutSegmentFilter !== "all" ? donutSegmentFilter : statusFilter}
            onValueChange={(v) => {
              setDonutSegmentFilter("all");
              setStatusFilter(v as typeof statusFilter);
            }}>
            <SelectTrigger className="h-9 w-[160px] text-sm rounded-lg"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Healthy">Healthy</SelectItem>
            </SelectContent>
          </Select>
          {(itemTypeFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all" || donutSegmentFilter !== "all") && (
            <button onClick={() => { setItemTypeFilter("all"); setCategoryFilter("all"); setStatusFilter("all"); setDonutSegmentFilter("all"); }}
              className="text-sm font-semibold text-primary hover:underline">Clear filters</button>
          )}
        </div>
      )}

      {/* Main Inventory Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Inventory Forecast Table</h2>
            <p className="text-base text-muted-foreground mt-1">Sorted by urgency: Critical → Low → Healthy.</p>
          </div>
          <button onClick={() => setShowDetails((v) => !v)}
            className="text-sm font-medium text-primary hover:underline self-start sm:self-auto">
            {showDetails ? "Hide details" : "Show details"}
          </button>
        </div>
        <div className="px-6 py-3 border-b border-border/20 bg-muted/10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="font-semibold text-muted-foreground">Status legend:</span>
          <span className="inline-flex items-center gap-1.5 text-foreground"><span className="h-3 w-3 rounded-full bg-red-500" /> Critical = ≤7 days remaining</span>
          <span className="inline-flex items-center gap-1.5 text-foreground"><span className="h-3 w-3 rounded-full bg-amber-500" /> Low = 8–14 days remaining</span>
          <span className="inline-flex items-center gap-1.5 text-foreground"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Healthy = &gt;14 days remaining</span>
        </div>

        {/* Desktop table — hidden on small screens */}
        <div className="overflow-x-auto overflow-y-visible hidden md:block">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left p-4 font-semibold text-[15px] text-foreground whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">Item <InfoHint text="Inventory item name." /></span>
                </th>
                <th className="text-left p-4 font-semibold text-[15px] text-foreground whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">Current Stock <InfoHint text="Quantity currently available." /></span>
                </th>
                <th className="text-left p-4 font-semibold text-[15px] text-foreground whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">Days Left <InfoHint text="Estimated days before reaching reorder level." /></span>
                </th>
                <th className="text-left p-4 font-semibold text-[15px] text-foreground whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">Status <InfoHint text="Critical, Low, or Healthy." /></span>
                </th>
                {showDetails && (
                  <>
                    <th className="text-left p-4 font-semibold text-[15px] text-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">Expected Use 7D <InfoHint text="Estimated use in next 7 days from history and confirmed bookings." /></span>
                    </th>
                    <th className="text-left p-4 font-semibold text-[15px] text-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">Reorder Level <InfoHint text="Stock level at which reordering is recommended." /></span>
                    </th>
                  </>
                )}
                <th className="text-left p-4 font-semibold text-[15px] text-foreground whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/20">
                      {Array.from({ length: showDetails ? 7 : 5 }).map((__, j) => <td key={j} className="p-4"><Skeleton className="h-5 w-full rounded" /></td>)}
                    </tr>
                  ))
                : pagedTable.map((inv) => {
                    const isExpanded = expandedRowId === inv.id;
                    const daysLeft = inv.daysUntilEmpty !== null ? `${inv.daysUntilEmpty} day(s)` : "Not enough data";
                    const maxStock = Math.max(inv.reorderLevel * 3, inv.currentStock, 1);
                    return (
                      <>
                        <tr key={inv.id} className="border-b border-border/20 hover:bg-muted/20 align-top">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {inv.isAsset ? <Wrench className="h-4 w-4 text-primary" /> : inv.type === "Detergent" ? <Droplets className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-secondary" />}
                              <span className="text-base font-semibold text-foreground">{inv.product}</span>
                            </div>
                            <div className="ml-6 text-xs text-muted-foreground">{inv.branch} · {inv.isAsset ? "Asset" : "Consumable"}</div>
                            <div className="ml-6 mt-1"><StockBar current={inv.currentStock} reorder={inv.reorderLevel} max={maxStock} /></div>
                          </td>
                          <td className="p-4 text-base text-foreground">{inv.isAsset ? `${inv.currentStock} ${inv.unit}` : formatQuantity(inv.currentStock, inv.unit)}</td>
                          <td className="p-4 text-base text-foreground">{inv.isAsset ? "—" : daysLeft}</td>
                          <td className="p-4">
                            {inv.isAsset ? (
                              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${assetStatusStyle[inv.assetStatus || "Active"] ?? assetStatusStyle["Active"]}`}>
                                {inv.assetStatus || "Active"}
                              </span>
                            ) : (
                              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusStyle[inv.status]}`}>{inv.status}</span>
                            )}
                          </td>
                          {showDetails && (
                            <>
                              <td className="p-4 text-base text-foreground">{inv.isAsset ? "—" : formatExpectedUse7D(inv)}</td>
                              <td className="p-4 text-base text-foreground">{inv.isAsset ? "—" : formatQuantity(inv.reorderLevel, inv.unit)}</td>
                            </>
                          )}
                          <td className="p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              {!inv.isAsset && <Button size="sm" onClick={() => openAdjust(inv)}>Add Stock</Button>}
                              {inv.isAsset && (
                                <Button size="sm" variant="outline" className="text-primary border-primary/30"
                                  disabled={markServicedLoading && markServicedId === inv.id}
                                  onClick={() => void handleMarkServiced(inv.id)}>
                                  {markServicedLoading && markServicedId === inv.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                  Mark Serviced
                                </Button>
                              )}
                              <Button size="sm" variant="outline"
                                onClick={() => setExpandedRowId((v) => (v === inv.id ? null : inv.id))}>
                                {isExpanded ? "Hide" : "Details"}
                                <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-border/20 bg-muted/10">
                            <td colSpan={showDetails ? 7 : 5} className="p-5">
                              {inv.isAsset ? (
                                <AssetDetailPanel item={inv} onEdit={openEdit} onDelete={openDelete} onServiced={handleMarkServiced} markServicedLoading={markServicedLoading} markServicedId={markServicedId} isAdmin={isAdmin} isStaff={isStaff} />
                              ) : (
                                <ConsumableDetailPanel item={inv} chartData={selectedItemChart} pendingConsumption={pendingConsumption} onEdit={openEdit} onDelete={openDelete} isAdmin={isAdmin} isStaff={isStaff} />
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
              {!loading && filteredInventory.length === 0 && (
                <tr><td colSpan={showDetails ? 7 : 5} className="p-8 text-center text-base text-muted-foreground">No inventory items found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden divide-y divide-border/20">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))
            : pagedTable.map((inv) => {
                const maxStock = Math.max(inv.reorderLevel * 3, inv.currentStock, 1);
                const isExpanded = expandedRowId === inv.id;
                return (
                  <div key={inv.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground text-base">{inv.product}</p>
                        <p className="text-xs text-muted-foreground">{inv.branch} · {inv.isAsset ? "Asset" : "Consumable"}</p>
                      </div>
                      {inv.isAsset ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${assetStatusStyle[inv.assetStatus || "Active"] ?? assetStatusStyle["Active"]}`}>
                          {inv.assetStatus || "Active"}
                        </span>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusStyle[inv.status]}`}>{inv.status}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">
                      {formatQuantity(inv.currentStock, inv.unit)}
                      {!inv.isAsset && inv.daysUntilEmpty !== null && ` · ${inv.daysUntilEmpty}d left`}
                    </p>
                    <StockBar current={inv.currentStock} reorder={inv.reorderLevel} max={maxStock} />
                    <div className="flex gap-2 pt-1">
                      {!inv.isAsset && <Button size="sm" onClick={() => openAdjust(inv)}>Add Stock</Button>}
                      <Button size="sm" variant="outline" onClick={() => setExpandedRowId((v) => (v === inv.id ? null : inv.id))}>
                        {isExpanded ? "Hide" : "Details"}
                      </Button>
                    </div>
                    {isExpanded && (
                      <div className="pt-2">
                        {inv.isAsset ? (
                          <AssetDetailPanel item={inv} onEdit={openEdit} onDelete={openDelete} onServiced={handleMarkServiced} markServicedLoading={markServicedLoading} markServicedId={markServicedId} isAdmin={isAdmin} isStaff={isStaff} />
                        ) : (
                          <ConsumableDetailPanel item={inv} chartData={selectedItemChart} pendingConsumption={pendingConsumption} onEdit={openEdit} onDelete={openDelete} isAdmin={isAdmin} isStaff={isStaff} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          {!loading && filteredInventory.length === 0 && (
            <div className="p-8 text-center text-base text-muted-foreground">No inventory items found.</div>
          )}
        </div>

        {!loading && filteredInventory.length > tablePageSize && (
          <Paginator page={tablePage} total={filteredInventory.length} pageSize={tablePageSize} pageSizes={TABLE_PAGE_SIZES} onPageSizeChange={setTablePageSize} onPage={setTablePage} />
        )}
      </div>

      {/* Analytics & Visualizations */}
      {!loading && filteredInventory.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border/30 flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Predictive Analytics</h2>
          </div>
          <div className="flex flex-wrap gap-2 px-5 pt-4">
            {([
              { key: "runway",    label: "Stock Runway" },
              { key: "risk",      label: "Risk Score" },
              { key: "rhythm",    label: "Demand Rhythm" },
              { key: "wave",      label: "Wave Forecast" },
              { key: "pipeline",  label: "Booking Pipeline" },
              { key: "anomaly",   label: "Anomaly Detector" },
              { key: "maintenance", label: "Maintenance" },
            ] as const).map((tab) => (
              <button key={tab.key} onClick={() => setActiveVizTab(tab.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeVizTab === tab.key ? "bg-primary text-primary-foreground" : "bg-background border border-border text-foreground hover:bg-muted"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-5">

            {/* Tab 1: Stock Runway Table */}
            {activeVizTab === "runway" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Stock Runway — Exact Stockout Dates</h3>
                <p className="text-sm text-muted-foreground mb-4">Shows when each item runs out and the latest safe date to place an order (accounting for supplier lead time). Items with no usage data are excluded from date calculations.</p>
                {runwayData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No consumable items to show.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-border/30 bg-muted/20">
                          <th className="text-left p-3 font-semibold text-foreground">Item</th>
                          <th className="text-left p-3 font-semibold text-foreground">Branch</th>
                          <th className="text-left p-3 font-semibold text-foreground">Stock</th>
                          <th className="text-left p-3 font-semibold text-foreground">Days Left</th>
                          <th className="text-left p-3 font-semibold text-foreground">Stockout Date</th>
                          <th className="text-left p-3 font-semibold text-foreground">
                            <span className="inline-flex items-center gap-1">Must Order By <InfoHint text="Stockout date minus supplier lead time. If 'Order Now', you're already within the lead time window." /></span>
                          </th>
                          <th className="text-left p-3 font-semibold text-foreground">Lead Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runwayData.map((item) => {
                          const rowBg = item.urgencyStatus === "Already Late" ? "bg-red-50 border-l-4 border-l-red-500"
                            : item.urgencyStatus === "Order Soon" ? "bg-amber-50 border-l-4 border-l-amber-500" : "";
                          const urgencyBadge = item.urgencyStatus === "Already Late"
                            ? "bg-red-100 text-red-700"
                            : item.urgencyStatus === "Order Soon"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700";
                          return (
                            <tr key={item.id} className={`border-b border-border/20 ${rowBg}`}>
                              <td className="p-3 font-medium text-foreground">
                                {item.product.replace(" Detergent", "").replace(" Fabric Conditioner", "")}
                              </td>
                              <td className="p-3 text-muted-foreground text-xs">{item.branch.replace(" Branch", "")}</td>
                              <td className="p-3 text-foreground">{item.currentStock} {item.unit}</td>
                              <td className="p-3 text-foreground">
                                {item.daysUntilEmpty !== null ? `${item.daysUntilEmpty}d` : <span className="text-muted-foreground">No usage data</span>}
                              </td>
                              <td className="p-3 text-foreground">
                                {item.stockoutDate ?? <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="p-3">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${urgencyBadge}`}>
                                  {item.mustOrderBy ?? "—"}
                                </span>
                              </td>
                              <td className="p-3 text-muted-foreground text-xs">{item.leadTime}d</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3">Lead time defaults to 3 days. Edit an item to set a custom supplier lead time.</p>
              </div>
            )}

            {/* Tab 2: Inventory Risk Score */}
            {activeVizTab === "risk" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Inventory Risk Score</h3>
                <p className="text-sm text-muted-foreground mb-4">Risk accounts for supplier lead time — an item with 4 days left and 3-day lead time has only 1 safe day remaining. Higher score = more urgent action needed.</p>
                {riskScoreData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No consumable items to score.</p>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto">
                    {riskScoreData.map((item, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-foreground truncate">{item.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">({item.branch})</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs text-muted-foreground">
                              {item.daysLeft !== null ? `${item.daysLeft}d left` : "no data"}
                              {" · "}{item.leadTime}d lead
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: item.riskColor + "20", color: item.riskColor }}>
                              {item.riskLabel}
                            </span>
                            <span className="text-sm font-bold w-8 text-right" style={{ color: item.riskColor }}>{item.riskScore}</span>
                          </div>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div style={{ width: `${item.riskScore}%`, background: item.riskColor }} className="h-full rounded-full transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {[{ label: "Critical (95–100)", color: "#EF4444" }, { label: "High Risk (80–94)", color: "#F97316" }, { label: "Elevated (65–79)", color: "#F59E0B" }, { label: "Moderate (40–64)", color: "#EAB308" }, { label: "Low Risk (0–39)", color: "#10B981" }].map((l) => (
                    <span key={l.label} className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm" style={{ background: l.color }} />{l.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Demand Rhythm Curve */}
            {activeVizTab === "rhythm" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Demand Rhythm Curve</h3>
                <p className="text-sm text-muted-foreground mb-4">Shows the typical demand shape across the week. A spike on Saturday means that day consumes far more than average — stock accordingly before the weekend.</p>
                {!hasRhythmData ? (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground text-center px-8">
                    No order history yet — appears once orders have been processed.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={rhythmData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                        <defs>
                          {trend14dKeys.map((key, i) => (
                            <linearGradient key={key} id={`rhythmGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0.05} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,25%,90%)" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} label={{ value: "Avg packs/day", angle: -90, position: "insideLeft", offset: 8, fontSize: 12 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          formatter={(value: number, name: string) => [`${value.toFixed(2)} packs`, name]} />
                        <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 4 }} />
                        {trend14dKeys.map((key, i) => (
                          <Area key={key} type="monotone" dataKey={key}
                            stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2.5}
                            fill={`url(#rhythmGrad${i})`} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="mt-4 rounded-xl bg-muted/30 p-4 space-y-1.5">
                      <p className="text-sm font-semibold text-foreground mb-1">Rhythm Insights</p>
                      {trend14dKeys.map((key) => {
                        const fullName = CONSUMABLE_NAMES.find((n) => n.replace(" Detergent", "").replace(" Fabric Conditioner", "") === key) ?? key;
                        const dayData = rhythmData.map((r) => ({ day: r.day as string, val: r[key] as number }));
                        const peakDay = dayData.reduce((a, b) => a.val >= b.val ? a : b);
                        const lowDay = dayData.reduce((a, b) => (a.val <= b.val && a.val > 0) ? a : b);
                        const avg = dayData.reduce((s, d) => s + d.val, 0) / 7;
                        if (avg < 0.001) return null;
                        return (
                          <p key={key} className="text-sm text-foreground">
                            <strong>{key}</strong>: peaks on <strong>{peakDay.day}</strong> ({peakDay.val.toFixed(2)} packs avg), slowest on <strong>{lowDay.day}</strong> ({lowDay.val.toFixed(2)} packs avg)
                          </p>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab 4: Wave-Shaped 30-Day Forecast */}
            {activeVizTab === "wave" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Wave-Shaped 30-Day Stock Forecast</h3>
                <p className="text-sm text-muted-foreground mb-4">Unlike a flat-line forecast, this applies weekday multipliers — higher usage on busy days means steeper drops, creating a realistic wave pattern. Select an item to view.</p>
                {waveForecastData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground text-center px-8">
                    No usage data yet — forecast appears once orders are processing.
                  </div>
                ) : (
                  <WaveForecastPanel data={waveForecastData} lineColors={LINE_COLORS} />
                )}
              </div>
            )}

            {/* Tab 5: Booking Pipeline */}
            {activeVizTab === "pipeline" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Upcoming Booking Pipeline — Next 14 Days</h3>
                <p className="text-sm text-muted-foreground mb-4">Confirmed demand from scheduled bookings (PENDING, ASSIGNED, ORDER_RECEIVED). Each bar shows how many packs are already committed per item on that day — this is real future demand, not a projection.</p>
                {bookingPipelineData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground text-center px-8">
                    No upcoming bookings with supply requests in the next 14 days.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {bookingPipelineData.map((record) => {
                      const totalDemand = record.upcoming.reduce((s, d) => s + d.quantity, 0);
                      const peakDay = record.upcoming.reduce((a, b) => a.quantity >= b.quantity ? a : b);
                      return (
                        <div key={record.itemName}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-foreground">{record.itemName}</p>
                            <span className="text-xs text-muted-foreground">{totalDemand.toFixed(0)} packs confirmed · peak: {peakDay.date} ({peakDay.quantity})</span>
                          </div>
                          <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={record.upcoming} margin={{ top: 4, right: 16, left: 4, bottom: 30 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,25%,90%)" />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                formatter={(value: number) => [`${value} packs`, "Confirmed demand"]} />
                              <Bar dataKey="quantity" name="Confirmed demand" radius={[3, 3, 0, 0]}>
                                {record.upcoming.map((entry, idx) => (
                                  <Cell key={idx} fill={entry.quantity > 0 ? "hsl(218,58%,35%)" : "#e2e8f0"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 6: Anomaly Detector */}
            {activeVizTab === "anomaly" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Consumption Anomaly Detector</h3>
                <p className="text-sm text-muted-foreground mb-4">Compares actual daily consumption against what was expected based on weekday patterns. Positive deviation = more used than expected (spike). Negative = below expected (quiet day).</p>
                {anomalyData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground text-center px-8">
                    No consumption data yet — appears after orders are completed.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {anomalyData.map((record) => {
                      const maxSpike = Math.max(...record.points.map((p) => Math.abs(p.deviation)), 0.01);
                      return (
                        <div key={record.name}>
                          <p className="font-semibold text-foreground mb-2">{record.fullName}</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={record.points} margin={{ top: 4, right: 16, left: 4, bottom: 30 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,25%,90%)" />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                              <YAxis tick={{ fontSize: 11 }} domain={[-maxSpike * 1.3, maxSpike * 1.3]} />
                              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                formatter={(value: number, name: string) => {
                                  if (name === "deviation") return [`${value > 0 ? "+" : ""}${value.toFixed(2)} packs vs expected`, "Deviation"];
                                  if (name === "expected") return [`${value.toFixed(2)} packs`, "Expected"];
                                  return [`${value} packs`, "Actual"];
                                }} />
                              <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1.5} />
                              <Bar dataKey="deviation" name="deviation" radius={[2, 2, 0, 0]}>
                                {record.points.map((entry, idx) => (
                                  <Cell key={idx} fill={entry.deviation > 0.5 ? "#EF4444" : entry.deviation < -0.5 ? "#3B82F6" : "#94A3B8"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-500" />Above expected (spike)</span>
                            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-blue-500" />Below expected (quiet)</span>
                            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-slate-400" />Normal range</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 7: Maintenance */}
            {activeVizTab === "maintenance" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Asset Maintenance Timeline</h3>
                <p className="text-sm text-muted-foreground mb-4">Red = overdue, Amber = due within 10 days, Green = on track.</p>
                {assetItems.filter((i) => i.maintenanceIntervalDays).length === 0 ? (
                  <p className="text-muted-foreground text-sm">No equipment tracked yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {assetItems.filter((i) => i.maintenanceIntervalDays).map((item) => {
                      const days = item.daysUntilService;
                      const totalDays = item.maintenanceIntervalDays || 180;
                      const color = days === null ? "#94A3B8" : days < 0 ? "#EF4444" : days <= 10 ? "#F59E0B" : "#10B981";
                      const pct = days === null ? 50 : Math.min(100, Math.max(0, ((totalDays + days) / totalDays) * 100));
                      const sinceService = days !== null && item.maintenanceIntervalDays
                        ? Math.max(0, item.maintenanceIntervalDays - (days > 0 ? days : 0))
                        : null;
                      const statusLabel = days === null ? "No data" : days < 0 ? `Overdue by ${Math.abs(days)}d` : days === 0 ? "Due today" : `Due in ${days}d`;
                      const barLabel = sinceService !== null
                        ? `${item.product} — ${sinceService}d since service (${statusLabel})`
                        : `${item.product} — ${statusLabel}`;
                      return (
                        <div key={item.id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-foreground truncate max-w-[60%]">{barLabel}</span>
                            <span className="text-xs font-semibold shrink-0 ml-2" style={{ color }}>{statusLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                              <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
                            </div>
                            <span className="text-xs text-muted-foreground w-24 text-right shrink-0">
                              Last: {item.lastServicedDate ? new Date(item.lastServicedDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Branch Overview (admin only) */}
      {isAdmin && branchOverview.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-border/30">
            <h2 className="text-xl font-semibold text-foreground">Branch Restock Overview</h2>
            <p className="text-base text-muted-foreground mt-1">Compare branches by restocking urgency. Click a row to filter the forecast table.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  {["Branch", "Total Items", "Critical", "Low", "Healthy", "Most Urgent Item", "Fewest Days Left", "Expected Use (7D)", "Recommended Action"].map((h) => (
                    <th key={h} className="text-left p-4 font-semibold text-[15px] text-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchOverview.map((row) => (
                  <tr key={row.branch} className="border-b border-border/20 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleTabChange(row.branch)}>
                    <td className="p-4 text-base font-medium text-foreground">{row.branch}</td>
                    <td className="p-4 text-base text-foreground">{row.totalItems}</td>
                    <td className="p-4 text-base"><span className={row.critical > 0 ? "font-semibold text-destructive" : "text-foreground"}>{row.critical}</span></td>
                    <td className="p-4 text-base"><span className={row.low > 0 ? "font-semibold text-amber-600" : "text-foreground"}>{row.low}</span></td>
                    <td className="p-4 text-base text-foreground">{row.healthy}</td>
                    <td className="p-4 text-base text-foreground break-words">{row.urgentItem}</td>
                    <td className="p-4 text-base text-foreground">{row.fewestDaysLeft === null ? "—" : `${row.fewestDaysLeft} day(s)`}</td>
                    <td className="p-4 text-base text-foreground">{row.expectedUse7DTotal > 0 ? row.expectedUse7DTotal.toFixed(1) : "—"}</td>
                    <td className="p-4 text-base text-foreground">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Inventory Item</DialogTitle>
            <DialogDescription>Add a new consumable or asset to track.</DialogDescription>
          </DialogHeader>
          <CreateEditForm form={createForm} setForm={setCreateForm} isAdmin={isAdmin} dynamicBranches={dynamicBranches} userBranch={userBranch} mode="create" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>Cancel</Button>
            <Button onClick={() => void submitCreate()} disabled={createSubmitting}>
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {createSubmitting ? "Creating..." : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>Update item details and thresholds.</DialogDescription>
          </DialogHeader>
          <CreateEditForm form={editForm} setForm={setEditForm} isAdmin={isAdmin} dynamicBranches={dynamicBranches} userBranch={userBranch} mode="edit" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSubmitting}>Cancel</Button>
            <Button onClick={() => void submitEdit()} disabled={editSubmitting}>
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}
              {editSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Stock — {selectedItem?.product}</DialogTitle>
            <DialogDescription>
              <span className="text-foreground font-medium">Current: {selectedItem?.currentStock} {selectedItem?.unit}</span>
              {" | "}Select <strong>IN</strong> to add stock, <strong>OUT</strong> to record usage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="0.01" step="0.01" value={adjustForm.quantityDelta}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, quantityDelta: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <select value={adjustForm.direction} onChange={(e) => setAdjustForm((p) => ({ ...p, direction: e.target.value as "IN" | "OUT" }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="IN">IN (Restock)</option>
                  <option value="OUT">OUT (Usage)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input placeholder="e.g. Weekly restock, Manual usage" value={adjustForm.reason}
                onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjustSubmitting}>Cancel</Button>
            <Button onClick={() => void submitAdjust()} disabled={adjustSubmitting}>
              {adjustSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Applying...</> : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inventory item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedItem?.product || "this item"} and its stock movement history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(e) => { e.preventDefault(); void submitDelete(); }} disabled={deleteSubmitting}>
              {deleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {deleteSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Sub-panel components ───────────────────────────────────────────────────────

// ── WaveForecastPanel ──────────────────────────────────────────────────────────

function WaveForecastPanel({
  data,
  lineColors,
}: {
  data: Array<{ item: InventoryItem; data: Array<{ day: string; date: string; stock: number; reorderLevel: number }> }>;
  lineColors: string[];
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const entry = data[Math.min(selectedIdx, data.length - 1)];
  if (!entry) return null;
  const { item, data: chartData } = entry;
  const crossDay = chartData.findIndex((d) => d.stock <= d.reorderLevel);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {data.map((d, i) => (
          <button key={d.item.id} onClick={() => setSelectedIdx(i)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors border ${i === selectedIdx ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-muted"}`}>
            {d.item.product.replace(" Detergent", "").replace(" Fabric Conditioner", "")}
            <span className="ml-1.5 text-xs opacity-70">({d.item.branch.replace(" Branch", "")})</span>
          </button>
        ))}
      </div>
      {crossDay >= 0 && (
        <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          Wave forecast: <strong>{item.product}</strong> reaches reorder level around <strong>Day {crossDay + 1}</strong>. Weekend demand spikes may accelerate this.
        </div>
      )}
      <p className="text-xs text-muted-foreground mb-3">
        Weekday multipliers applied — usage is higher on busy days and lower on slow days, creating a realistic depletion wave instead of a flat line.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 12, right: 28, left: 16, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,25%,90%)" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4}
            label={{ value: "Forecast days", position: "insideBottom", offset: -12, fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={56}
            label={{ value: `Stock (${item.unit})`, angle: -90, position: "insideLeft", offset: 8, fontSize: 12 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }}
            formatter={(value: number, name: string) => {
              if (name === "stock") return [`${value} ${item.unit}${value <= item.reorderLevel ? " ⚠" : ""}`, "Wave forecast"];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              const dateStr = payload?.[0]?.payload?.date ?? label;
              return dateStr;
            }} />
          <ReferenceLine y={item.reorderLevel} stroke="hsl(12,76%,61%)" strokeDasharray="6 4" strokeWidth={2} ifOverflow="extendDomain"
            label={{ value: "Reorder level", position: "insideTopRight", fontSize: 11, fill: "hsl(12,76%,61%)" }} />
          {crossDay >= 0 && chartData[crossDay] && (
            <ReferenceLine x={chartData[crossDay].day} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: `⚠ D${crossDay + 1}`, position: "top", fontSize: 11, fill: "#B45309" }} />
          )}
          <Line type="monotone" dataKey="stock" name="stock" stroke={lineColors[0]} strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConsumableDetailPanel({
  item, chartData, pendingConsumption, onEdit, onDelete, isAdmin, isStaff,
}: {
  item: InventoryItem;
  chartData: Array<{ day: string; stock: number; reorderLevel: number }>;
  pendingConsumption: Record<string, number>;
  onEdit: (i: InventoryItem) => void;
  onDelete: (i: InventoryItem) => void;
  isAdmin: boolean;
  isStaff: boolean;
}) {
  const crossDay = chartData.findIndex((d) => d.stock <= d.reorderLevel);
  const hasUsage = item.historicalDailyUsage >= 0.001;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-1 rounded-xl border border-border/30 bg-white p-4 space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Forecast Details</h3>
        <p className="text-base text-foreground leading-relaxed">Recommendation: <strong>{buildNarrative(item)}</strong></p>
        <div className="flex items-start gap-2">
          <InfoHint text="Shows whether the forecast is based on completed orders, upcoming bookings, or both." />
          <p className="text-sm text-muted-foreground leading-relaxed">{buildForecastBasis(item)}</p>
        </div>
        <p className="text-sm text-foreground">Current stock: <strong>{formatQuantity(item.currentStock, item.unit)}</strong></p>
        <p className="text-sm text-foreground">Reorder level: <strong>{formatQuantity(item.reorderLevel, item.unit)}</strong></p>
        <p className="text-sm text-foreground">Historical usage: <strong>{formatQuantity(item.historicalDailyUsage, item.unit, "No recent usage")}/day</strong></p>
        <p className="text-sm text-foreground">Confirmed orders 7D: <strong>{item.confirmedDemand7D > 0 ? formatQuantity(item.confirmedDemand7D, item.unit) : "No upcoming orders"}</strong></p>
        <p className="text-sm text-foreground">Pending demand: <strong>{pendingConsumption[item.product] ? formatQuantity(pendingConsumption[item.product], item.unit) : "No pending demand"}</strong></p>
        <p className="text-sm text-foreground">Expected use 7D: <strong>{formatExpectedUse7D(item)}</strong></p>
        <p className="text-sm text-foreground">Days left: <strong>{item.daysUntilEmpty ?? "Not enough data yet"}</strong></p>
        {(isAdmin || isStaff) && (
          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(item)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
            {isAdmin && <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>}
          </div>
        )}
      </div>
      <div className="xl:col-span-2 rounded-xl border border-border/30 bg-white p-4">
        <h3 className="text-lg font-semibold text-foreground mb-1">30-Day Stock Forecast — {item.product} at {item.branch}</h3>
        <p className="text-sm text-muted-foreground mb-2">Days 1–7 blend confirmed bookings (40%) + history (60%). Days 8–30 use historical average.</p>
        {crossDay >= 0 && (
          <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            ⚠ Reorder needed by <strong>Day {crossDay + 1}</strong> — projected stock crosses reorder threshold.
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-4 text-sm text-foreground">
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-8 bg-[hsl(218,58%,20%)]" />Projected stock</span>
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-8 border-t-2 border-dashed border-[hsl(12,76%,61%)]" />Reorder level</span>
        </div>
        {!hasUsage ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            No usage data yet — waiting for completed orders.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 12, right: 28, left: 16, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(215, 20%, 35%)" }} interval={4}
                label={{ value: "Forecast days", position: "insideBottom", offset: -12, fontSize: 12, fill: "hsl(215, 20%, 35%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(215, 20%, 35%)" }} width={72}
                label={{ value: `Stock (${item.unit})`, angle: -90, position: "insideLeft", offset: 8, fontSize: 12, fill: "hsl(215, 20%, 35%)" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }}
                formatter={(value: number, name: string) => {
                  if (name === "stock" && typeof value === "number") {
                    const below = value <= item.reorderLevel;
                    return [below ? `${value} ⚠ Below reorder level` : `${value} ${item.unit}`, "Projected stock"];
                  }
                  return [value, name];
                }} />
              <ReferenceLine y={item.reorderLevel} stroke="hsl(12,76%,61%)" strokeDasharray="6 4" strokeWidth={2} ifOverflow="extendDomain" />
              {crossDay >= 0 && chartData[crossDay] && (
                <ReferenceLine x={chartData[crossDay].day} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: `⚠ Reorder by Day ${crossDay + 1}`, position: "top", fontSize: 11, fill: "#B45309" }} />
              )}
              <Line type="monotone" dataKey="stock" name="stock" stroke="hsl(218,58%,20%)" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function AssetDetailPanel({
  item, onEdit, onDelete, onServiced, markServicedLoading, markServicedId, isAdmin, isStaff,
}: {
  item: InventoryItem;
  onEdit: (i: InventoryItem) => void;
  onDelete: (i: InventoryItem) => void;
  onServiced: (id: number) => Promise<void>;
  markServicedLoading: boolean;
  markServicedId: number | null;
  isAdmin: boolean;
  isStaff: boolean;
}) {
  const days = item.daysUntilService;
  const serviceColor = days === null ? "#94A3B8" : days < 0 ? "#EF4444" : days <= 10 ? "#F59E0B" : "#10B981";
  const serviceLabel = days === null ? "No schedule" : days < 0 ? `Overdue by ${Math.abs(days)} day(s)` : days === 0 ? "Due today" : `${days} day(s) until next service`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <div className="rounded-xl border border-border/30 bg-white p-4 space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Asset Details — {item.product}</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><span className="text-muted-foreground">Category:</span> <strong>{item.category}</strong></div>
          <div><span className="text-muted-foreground">Branch:</span> <strong>{item.branch}</strong></div>
          <div><span className="text-muted-foreground">Purchase Date:</span> <strong>{item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"}</strong></div>
          <div><span className="text-muted-foreground">Last Serviced:</span> <strong>{item.lastServicedDate ? new Date(item.lastServicedDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"}</strong></div>
          <div><span className="text-muted-foreground">Service Interval:</span> <strong>{item.maintenanceIntervalDays ? `Every ${item.maintenanceIntervalDays} days` : "—"}</strong></div>
          <div><span className="text-muted-foreground">Status:</span> <strong>{item.assetStatus || "Active"}</strong></div>
        </div>
        <div className="rounded-lg p-3 border" style={{ borderColor: serviceColor + "50", background: serviceColor + "15" }}>
          <p className="text-sm font-semibold" style={{ color: serviceColor }}>{serviceLabel}</p>
          {item.maintenanceIntervalDays && item.lastServicedDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Next service: {new Date(new Date(item.lastServicedDate).getTime() + item.maintenanceIntervalDays * 86400000).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          )}
        </div>
        {(isAdmin || isStaff) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={markServicedLoading && markServicedId === item.id}
              onClick={() => void onServiced(item.id)}>
              {markServicedLoading && markServicedId === item.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              ✓ Mark as Serviced
            </Button>
            <Button size="sm" variant="outline" className="text-amber-600 border-amber-300"
              onClick={() => { toast.info(`Issue reported for ${item.product}. Please contact branch management.`); }}>
              Report Issue
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(item)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
            {isAdmin && <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border/30 bg-white p-4">
        <h3 className="text-lg font-semibold text-foreground mb-3">Maintenance Timeline</h3>
        {!item.maintenanceIntervalDays ? (
          <p className="text-sm text-muted-foreground">No maintenance schedule set. Edit this asset to add a service interval.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">Progress through current maintenance cycle.</p>
            {(() => {
              const total = item.maintenanceIntervalDays;
              const daysGone = total - (days ?? total);
              const pct = Math.min(100, Math.max(0, (daysGone / total) * 100));
              const color = (days ?? 0) < 0 ? "#EF4444" : (days ?? 999) <= 10 ? "#F59E0B" : "#10B981";
              return (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Last service</span><span>Next service due</span>
                  </div>
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full transition-all" />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.lastServicedDate ? new Date(item.lastServicedDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "—"}</span>
                    <span className="font-semibold" style={{ color }}>{Math.round(pct)}% through cycle</span>
                    <span>{item.lastServicedDate && item.maintenanceIntervalDays ? new Date(new Date(item.lastServicedDate).getTime() + item.maintenanceIntervalDays * 86400000).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "—"}</span>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

function CreateEditForm({
  form, setForm, isAdmin, dynamicBranches, userBranch, mode,
}: {
  form: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  isAdmin: boolean;
  dynamicBranches: string[];
  userBranch: string;
  mode: "create" | "edit";
}) {
  const isAsset = form.assetType === "Asset";

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {/* Item Type */}
      <div className="space-y-2">
        <Label>Item Type</Label>
        <Select value={form.assetType} onValueChange={(v) => setForm((p: any) => ({
          ...p, assetType: v, itemName: "", category: "", unit: "", brand: "",
          maintenanceIntervalDays: "",
        }))}>
          <SelectTrigger className="w-full text-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Consumable">Consumable (Detergent, Fabric Conditioner)</SelectItem>
            <SelectItem value="Asset">Asset (Washing Machine, Dryer, Aircon, Fan)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Branch */}
      <div className="space-y-2">
        <Label>Branch</Label>
        {isAdmin ? (
          <Select value={form.branch} onValueChange={(v) => setForm((p: any) => ({ ...p, branch: v }))}>
            <SelectTrigger className="w-full text-foreground"><SelectValue placeholder={dynamicBranches.length ? "Select a branch" : "No branches available"} /></SelectTrigger>
            <SelectContent>{dynamicBranches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <Input value={form.branch || userBranch} readOnly className="bg-muted text-muted-foreground" />
        )}
      </div>

      {/* ── Consumable fields ── */}
      {!isAsset && (
        <>
          <div className="space-y-2">
            <Label>Item Name</Label>
            <Select value={form.itemName} onValueChange={(v) => {
              const def = CONSUMABLE_DEFAULTS[v];
              setForm((p: any) => ({
                ...p, itemName: v,
                category: def?.category ?? p.category,
                unit: def?.unit ?? p.unit,
                reorderLevel: String(def?.reorderLevel ?? p.reorderLevel),
              }));
            }}>
              <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select an item" /></SelectTrigger>
              <SelectContent>
                {CONSUMABLE_CATALOG.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={form.category} readOnly className="bg-muted text-muted-foreground" placeholder="Auto-filled" />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input value={form.unit} readOnly className="bg-muted text-muted-foreground" placeholder="Auto-filled" />
            </div>
          </div>
          {mode === "create" && (
            <div className="space-y-2">
              <Label>Current Stock</Label>
              <Input type="number" min="0" step="0.01" value={form.currentStock}
                onChange={(e) => setForm((p: any) => ({ ...p, currentStock: e.target.value }))} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Reorder Level <span className="text-xs text-muted-foreground">(auto-filled, editable)</span></Label>
            <Input type="number" min="0" step="0.01" value={form.reorderLevel}
              onChange={(e) => setForm((p: any) => ({ ...p, reorderLevel: e.target.value }))} />
          </div>
        </>
      )}

      {/* ── Asset fields ── */}
      {isAsset && (
        <>
          <div className="space-y-2">
            <Label>Asset Type</Label>
            <Select value={form.category} onValueChange={(v) => {
              const interval = ASSET_MAINTENANCE_INTERVALS[v] ?? "";
              setForm((p: any) => ({ ...p, category: v, unit: "units", maintenanceIntervalDays: String(interval) }));
            }}>
              <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select asset type" /></SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Brand <span className="text-xs text-muted-foreground">(e.g. LG, Samsung, Panasonic)</span></Label>
            <Input value={form.brand} placeholder="Enter brand name"
              onChange={(e) => setForm((p: any) => ({ ...p, brand: e.target.value }))} />
            {form.brand && form.category && (
              <p className="text-xs text-muted-foreground">Item will be saved as: <strong>{form.brand} {form.category}</strong></p>
            )}
          </div>
          {mode === "create" && (
            <div className="space-y-2">
              <Label>Quantity (units in service)</Label>
              <Input type="number" min="0" value={form.currentStock}
                onChange={(e) => setForm((p: any) => ({ ...p, currentStock: e.target.value }))} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchaseDate}
                onChange={(e) => setForm((p: any) => ({ ...p, purchaseDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Last Serviced Date</Label>
              <Input type="date" value={form.lastServicedDate}
                onChange={(e) => setForm((p: any) => ({ ...p, lastServicedDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Maintenance Interval <span className="text-xs text-muted-foreground">(auto-filled)</span></Label>
              <Input type="number" min="1" value={form.maintenanceIntervalDays}
                onChange={(e) => setForm((p: any) => ({ ...p, maintenanceIntervalDays: e.target.value }))}
                placeholder="days" />
            </div>
            <div className="space-y-2">
              <Label>Asset Status</Label>
              <Select value={form.assetStatus} onValueChange={(v) => setForm((p: any) => ({ ...p, assetStatus: v }))}>
                <SelectTrigger className="w-full text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>{ASSET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
