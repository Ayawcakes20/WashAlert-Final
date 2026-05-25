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
} from "recharts";
import { inventoryApi, branchesApi, type InventoryRecord } from "@/lib/api";
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

function getStatus(currentStock: number, reorderLevel: number, stockAfter7Days: number): "Healthy" | "Low" | "Critical" {
  if (currentStock <= reorderLevel || stockAfter7Days < 0) return "Critical";
  if (currentStock <= reorderLevel * 1.5) return "Low";
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
  const stockAfter7 = Number(record.currentStock || 0) - dailyUsage * 7;
  const catLower = (record.category ?? "").toLowerCase();
  const type: InventoryItem["type"] = catLower.includes("conditioner") ? "Fabric Conditioner"
    : catLower.includes("detergent") ? "Detergent" : isAsset ? "Asset" : "Other";
  const status = isAsset ? "Healthy" : getStatus(Number(record.currentStock || 0), Number(record.reorderLevel || 0), stockAfter7);
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
    daysUntilEmpty: isAsset ? null : calcDaysRemaining(Number(record.currentStock || 0), dailyUsage),
    projectedAfter7Days: stockAfter7,
    status,
    historicalDailyUsage: itemForecast?.historical ?? 0,
    confirmedDemand7D: itemForecast?.confirmed7D ?? 0,
    isAsset,
    assetType: record.assetType,
    purchaseDate: record.purchaseDate,
    lastServicedDate: record.lastServicedDate,
    maintenanceIntervalDays: record.maintenanceIntervalDays,
    assetStatus: record.assetStatus || (isAsset ? "Active" : undefined),
    daysUntilService,
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
  const [pendingConsumption, setPendingConsumption] = useState<Record<string, number>>({});
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
  const [activeVizTab, setActiveVizTab] = useState<"donut" | "yesterday" | "history7d" | "heatmap" | "maintenance">("donut");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [donutSegmentFilter, setDonutSegmentFilter] = useState<"all" | "Critical" | "Low" | "Healthy">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    branch: "", itemName: "", category: "", unit: "", currentStock: "0", reorderLevel: "0",
    assetType: "Consumable", purchaseDate: "", lastServicedDate: "", maintenanceIntervalDays: "", assetStatus: "Active",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    branch: "", itemName: "", category: "", unit: "", reorderLevel: "0",
    assetType: "Consumable", purchaseDate: "", lastServicedDate: "", maintenanceIntervalDays: "", assetStatus: "Active",
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
      const [items, _alerts, forecastResp, pending, stats] = await Promise.all([
        inventoryApi.list(),
        inventoryApi.alerts(),
        inventoryApi.forecast(7),
        inventoryApi.pendingConsumption().catch(() => ({})),
        inventoryApi.dailyStats(60).catch(() => [] as DailyStatsRecord[]),
      ]);
      setPendingConsumption(pending || {});
      setDailyStats((stats as DailyStatsRecord[]) || []);
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

  // Yesterday vs Today from dailyStats
  const yesterdayTodayData = useMemo(() => {
    const today = toYMD(new Date());
    const yesterday = toYMD(offsetDate(new Date(), -1));
    return CONSUMABLE_NAMES.map((name) => {
      const record = dailyStats.find((r) => r.itemName === name);
      const yest = record?.days.find((d) => d.date === yesterday)?.consumed ?? 0;
      const tod = record?.days.find((d) => d.date === today)?.consumed ?? 0;
      const shortName = name.replace(" Detergent", "").replace(" Fabric Conditioner", "");
      return { item: shortName, yesterday: yest, today: tod };
    });
  }, [dailyStats]);

  const hasYesterdayTodayData = useMemo(
    () => yesterdayTodayData.some((r) => r.yesterday > 0 || r.today > 0),
    [yesterdayTodayData],
  );

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
        const record = dailyStats.find((r) => r.itemName === name);
        const shortName = name.replace(" Detergent", "").replace(" Fabric Conditioner", "");
        row[shortName] = record?.days.find((d) => d.date === date)?.consumed ?? 0;
      });
      return row;
    });
  }, [dailyStats]);

  const history7dKeys = CONSUMABLE_NAMES.map((n) => n.replace(" Detergent", "").replace(" Fabric Conditioner", ""));

  const hasHistory7dData = useMemo(
    () => history7dData.some((row) => history7dKeys.some((k) => (row[k] as number) > 0)),
    [history7dData],
  );

  // Peak Heatmap — avg by day-of-week from last 60 days
  const heatmapData = useMemo(() => {
    // display columns: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
    const jsDowForCol = [1, 2, 3, 4, 5, 6, 0];
    return CONSUMABLE_NAMES.map((name) => {
      const record = dailyStats.find((r) => r.itemName === name);
      const buckets: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      record?.days.forEach(({ date, consumed }) => {
        const dow = new Date(date + "T00:00:00").getDay();
        buckets[dow].push(consumed);
      });
      const avgs = jsDowForCol.map((dow) => {
        const arr = buckets[dow];
        return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
      });
      const shortName = name.replace(" Detergent", "").replace(" Fabric Conditioner", "");
      return { name: shortName, avgs };
    });
  }, [dailyStats]);

  const hasHeatmapData = useMemo(
    () => heatmapData.some((r) => r.avgs.some((v) => v > 0)),
    [heatmapData],
  );

  const heatmapMax = useMemo(() => Math.max(...heatmapData.flatMap((r) => r.avgs), 0.001), [heatmapData]);

  const heatmapInsight = useMemo(() => {
    if (!hasHeatmapData) return null;
    let bestItem = "";
    let bestDay = "";
    let bestVal = -1;
    heatmapData.forEach((row) => {
      row.avgs.forEach((v, ci) => {
        if (v > bestVal) { bestVal = v; bestItem = row.name; bestDay = HEATMAP_DAYS_LABELS[ci]; }
      });
    });
    return `Highest usage: ${bestDay} (${bestItem} — ${bestVal.toFixed(1)} packs avg)`;
  }, [heatmapData, hasHeatmapData]);

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
      purchaseDate: "", lastServicedDate: "", maintenanceIntervalDays: "", assetStatus: "Active",
    });
    setCreateOpen(true);
  };

  const openEdit = (row: InventoryItem) => {
    setSelectedItem(row);
    setEditForm({
      branch: row.branch, itemName: row.product, category: row.category, unit: row.unit, reorderLevel: String(row.reorderLevel),
      assetType: row.assetType || "Consumable", purchaseDate: row.purchaseDate || "", lastServicedDate: row.lastServicedDate || "",
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
    if (!createForm.branch.trim() || !createForm.itemName.trim() || !createForm.category.trim() || !createForm.unit.trim()) {
      toast.error("Branch, item name, category, and unit are required."); return;
    }
    setCreateSubmitting(true);
    try {
      await inventoryApi.create({
        branch: createForm.branch.trim(), itemName: createForm.itemName.trim(),
        category: createForm.category.trim(), unit: createForm.unit.trim(),
        currentStock: Number(createForm.currentStock || 0), reorderLevel: Number(createForm.reorderLevel || 0),
        assetType: createForm.assetType || null,
        purchaseDate: createForm.purchaseDate || null,
        lastServicedDate: createForm.lastServicedDate || null,
        maintenanceIntervalDays: createForm.maintenanceIntervalDays ? Number(createForm.maintenanceIntervalDays) : null,
        assetStatus: createForm.assetType === "Asset" ? (createForm.assetStatus || "Active") : null,
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
                    Recommended reorder: <span className={item.status === "Critical" ? "text-red-700" : "text-amber-700"}>{item.recommended} {item.unit}</span>
                    <span className="text-xs text-muted-foreground font-normal ml-1">(30-day buffer)</span>
                  </p>
                ) : (
                  <p className="text-sm text-emerald-700 font-medium">Stock sufficient for 30 days — no reorder needed</p>
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
          <span className="inline-flex items-center gap-1.5 text-foreground"><span className="h-3 w-3 rounded-full bg-red-500" /> Critical = at or below reorder level</span>
          <span className="inline-flex items-center gap-1.5 text-foreground"><span className="h-3 w-3 rounded-full bg-amber-500" /> Low = approaching reorder level</span>
          <span className="inline-flex items-center gap-1.5 text-foreground"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Healthy = enough stock</span>
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
            <h2 className="text-xl font-semibold text-foreground">Analytics & Visualizations</h2>
          </div>
          <div className="flex flex-wrap gap-2 px-5 pt-4">
            {([
              { key: "donut", label: "Stock Health" },
              { key: "yesterday", label: "Yesterday vs Today" },
              { key: "history7d", label: "7-Day History" },
              { key: "heatmap", label: "Peak Heatmap" },
              { key: "maintenance", label: "Maintenance" },
            ] as const).map((tab) => (
              <button key={tab.key} onClick={() => setActiveVizTab(tab.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeVizTab === tab.key ? "bg-primary text-primary-foreground" : "bg-background border border-border text-foreground hover:bg-muted"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="p-5">

            {/* Tab 1: Stock Health Donut */}
            {activeVizTab === "donut" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Stock Health Distribution</h3>
                  <p className="text-sm text-muted-foreground mb-1">Consumable items by health status. Click a segment to filter the table.</p>
                  <p className="text-sm text-muted-foreground mb-4">Total consumable items: <strong>{allConsumables.length}</strong></p>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value"
                        onClick={(entry) => {
                          const name = entry.name as "Critical" | "Low" | "Healthy";
                          setDonutSegmentFilter((prev) => (prev === name ? "all" : name));
                        }}
                        style={{ cursor: "pointer" }}>
                        {donutData.map((entry, index) => (
                          <Cell key={entry.name} fill={DONUT_COLORS[index]}
                            opacity={donutSegmentFilter === "all" || donutSegmentFilter === entry.name ? 1 : 0.35} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value} items`, name]} contentStyle={{ fontSize: 13, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-4 mt-2 text-sm">
                    {donutData.map((d, i) => (
                      <button key={d.name}
                        onClick={() => setDonutSegmentFilter((prev) => (prev === d.name ? "all" : d.name as "Critical" | "Low" | "Healthy"))}
                        className={`inline-flex items-center gap-1.5 transition-opacity ${donutSegmentFilter !== "all" && donutSegmentFilter !== d.name ? "opacity-40" : ""}`}>
                        <span className="h-3 w-3 rounded-full" style={{ background: DONUT_COLORS[i] }} />{d.name}: <strong>{d.value}</strong>
                      </button>
                    ))}
                  </div>
                  {donutSegmentFilter !== "all" && (
                    <div className="mt-3 text-center">
                      <button onClick={() => setDonutSegmentFilter("all")} className="text-xs text-primary hover:underline">
                        Clear segment filter
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Reorder Level Summary</h3>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {consumableItems.map((item) => {
                      const pct = Math.max(0, Math.min(100, item.reorderLevel > 0 ? (item.currentStock / (item.reorderLevel * 3)) * 100 : 100));
                      const color = item.status === "Critical" ? "#EF4444" : item.status === "Low" ? "#F59E0B" : "#10B981";
                      return (
                        <div key={item.id} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-foreground truncate max-w-[200px]">{item.product}</span>
                            <span className="text-muted-foreground">{item.currentStock} / {item.reorderLevel * 3} {item.unit}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full" />
                          </div>
                        </div>
                      );
                    })}
                    {consumableItems.length === 0 && (
                      <p className="text-sm text-muted-foreground">No consumable items match current filters.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Yesterday vs Today */}
            {activeVizTab === "yesterday" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Yesterday vs Today</h3>
                <p className="text-sm text-muted-foreground mb-4">Units consumed per consumable item — yesterday and today.</p>
                {!hasYesterdayTodayData ? (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground text-center px-8">
                    No consumption recorded yet — data appears after completed orders.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={yesterdayTodayData} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,25%,90%)" />
                        <XAxis dataKey="item" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 12 }} label={{ value: "Units consumed", angle: -90, position: "insideLeft", offset: 8, fontSize: 12 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar dataKey="yesterday" name="Yesterday" fill={BAR_COLORS[0]} />
                        <Bar dataKey="today" name="Today" fill={BAR_COLORS[2]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: BAR_COLORS[0] }} />Yesterday</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: BAR_COLORS[2] }} />Today</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab 3: 7-Day History */}
            {activeVizTab === "history7d" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">7-Day Consumption History</h3>
                <p className="text-sm text-muted-foreground mb-4">Stacked daily consumption per item for the last 7 days.</p>
                {!hasHistory7dData ? (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground text-center px-8">
                    No consumption recorded yet — data appears after completed orders.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={history7dData} margin={{ top: 8, right: 16, left: 8, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,25%,90%)" />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 12 }} label={{ value: "Units consumed", angle: -90, position: "insideLeft", offset: 8, fontSize: 12 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        {history7dKeys.map((key, i) => (
                          <Bar key={key} dataKey={key} stackId="a" fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm">
                      {history7dKeys.map((key, i) => (
                        <span key={key} className="inline-flex items-center gap-1.5">
                          <span className="h-3 w-3 rounded-sm" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />{key}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab 4: Peak Heatmap */}
            {activeVizTab === "heatmap" && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Peak Day Heatmap</h3>
                <p className="text-sm text-muted-foreground mb-4">Average consumption per day of week (last 60 days). Darker = higher average.</p>
                {!hasHeatmapData ? (
                  <div className="flex items-center justify-center h-48 text-sm text-muted-foreground text-center px-8">
                    No consumption data available yet — heatmap populates after order history is recorded.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="pr-4 text-left text-xs font-medium text-muted-foreground pb-2">Item</th>
                            {HEATMAP_DAYS_LABELS.map((d) => (
                              <th key={d} className="px-1 pb-2 text-center text-xs font-medium text-foreground w-12">{d}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {heatmapData.map((row) => (
                            <tr key={row.name}>
                              <td className="pr-4 py-1 text-xs text-foreground whitespace-nowrap font-medium">{row.name}</td>
                              {row.avgs.map((val, ci) => {
                                const intensity = heatmapMax > 0 ? val / heatmapMax : 0;
                                const lightness = Math.round(95 - intensity * 75);
                                const bg = intensity < 0.05 ? "#FFFFFF" : `hsl(218,58%,${lightness}%)`;
                                const textColor = lightness < 55 ? "#FFFFFF" : "#1e293b";
                                return (
                                  <td key={ci} className="px-1 py-1">
                                    <div title={`${HEATMAP_DAYS_LABELS[ci]}: ${val.toFixed(1)} packs avg`}
                                      style={{ background: bg, color: textColor, width: 44, height: 36, borderRadius: 6 }}
                                      className="flex items-center justify-center text-xs font-medium cursor-default">
                                      {val > 0 ? val.toFixed(1) : "—"}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {heatmapInsight && (
                      <p className="mt-4 text-sm text-foreground"><strong>Insight:</strong> {heatmapInsight}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tab 5: Maintenance */}
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
  const catalog = isAsset ? ASSET_CATALOG : CONSUMABLE_CATALOG;

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label>Item Type</Label>
        <Select value={form.assetType} onValueChange={(v) => setForm((p: any) => ({ ...p, assetType: v, itemName: "", category: "", unit: "" }))}>
          <SelectTrigger className="w-full text-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Consumable">Consumable (Detergent, Fabric Conditioner, etc.)</SelectItem>
            <SelectItem value="Asset">Asset (Washing Machine, Dryer, etc.)</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
      <div className="space-y-2">
        <Label>Item Name</Label>
        <Select value={form.itemName} onValueChange={(v) => {
          const entry = (catalog as readonly { name: string; category: string; unit: string }[]).find((c) => c.name === v);
          setForm((p: any) => ({ ...p, itemName: v, category: entry?.category ?? p.category, unit: entry?.unit ?? p.unit }));
        }}>
          <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select an item" /></SelectTrigger>
          <SelectContent>{(catalog as readonly { name: string }[]).map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm((p: any) => ({ ...p, category: v }))}>
            <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>{INVENTORY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Unit</Label>
          <Select value={form.unit} onValueChange={(v) => setForm((p: any) => ({ ...p, unit: v }))}>
            <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent>{INVENTORY_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {mode === "create" && (
        <div className="space-y-2">
          <Label>Current Stock</Label>
          <Input type="number" min="0" step="0.01" value={form.currentStock} onChange={(e) => setForm((p: any) => ({ ...p, currentStock: e.target.value }))} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Reorder Level {isAsset && <span className="text-xs text-muted-foreground">(set 0 for assets)</span>}</Label>
        <Input type="number" min="0" step="0.01" value={form.reorderLevel} onChange={(e) => setForm((p: any) => ({ ...p, reorderLevel: e.target.value }))} />
      </div>
      {isAsset && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchaseDate} onChange={(e) => setForm((p: any) => ({ ...p, purchaseDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Last Serviced Date</Label>
              <Input type="date" value={form.lastServicedDate} onChange={(e) => setForm((p: any) => ({ ...p, lastServicedDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Maintenance Interval (days)</Label>
              <Input type="number" min="1" value={form.maintenanceIntervalDays} onChange={(e) => setForm((p: any) => ({ ...p, maintenanceIntervalDays: e.target.value }))} placeholder="e.g. 180" />
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
