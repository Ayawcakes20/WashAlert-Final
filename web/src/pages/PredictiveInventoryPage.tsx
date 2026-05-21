import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Package, AlertTriangle, TrendingUp, Droplets, Sparkles,
  Plus, Pencil, Trash2, Loader2, MapPin, CalendarClock, RefreshCw,
  Info, ChevronDown, ChevronUp, BookOpen, ChevronLeft, ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, LabelList, ReferenceLine,
} from "recharts";
import { inventoryApi, branchesApi, type InventoryRecord } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getSessionUser } from "@/lib/session";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Constants ────────────────────────────────────────────────────────────────

const INVENTORY_CATALOG = [
  { name: "Surf Detergent",            category: "Detergent",          unit: "packs" },
  { name: "Ariel Detergent",           category: "Detergent",          unit: "packs" },
  { name: "Charm Fabric Conditioner",  category: "Fabric Conditioner", unit: "packs" },
  { name: "Downy Fabric Conditioner",  category: "Fabric Conditioner", unit: "packs" },
] as const;

const INVENTORY_CATEGORIES = ["Detergent", "Fabric Conditioner"] as const;
const INVENTORY_UNITS = ["packs", "liters", "kg", "bottles", "pieces"] as const;

const TABLE_PAGE_SIZE = 10;
const ALERTS_PAGE_SIZE = 5;
const NARRATIVE_PAGE_SIZE = 5;

const CHART_COLORS = [
  "hsl(218,58%,20%)",
  "hsl(168,55%,40%)",
  "hsl(25,80%,50%)",
  "hsl(280,60%,50%)",
  "hsl(0,72%,50%)",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: number;
  product: string;
  type: "Detergent" | "Fabric Conditioner";
  branch: string;
  currentStock: number;
  maxStock: number;
  reorderLevel: number;
  unit: string;
  category: string;
  forecastedUsage: number;
  daysUntilEmpty: number | null;
  projectedAfter7Days: number;
  status: "Healthy" | "Low Stock" | "Critical";
}

interface NarrativeCard {
  item: InventoryItem;
  tier: "critical" | "monitor" | "healthy";
  text: string;
  badge: string;
  subtitle: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDaysRemaining(currentStock: number, avgDailyUsage: number): number | null {
  if (avgDailyUsage < 0.001) return null;
  return Math.floor(currentStock / avgDailyUsage);
}

function getStatus(currentStock: number, reorderLevel: number, stockAfter7Days: number): "Healthy" | "Low Stock" | "Critical" {
  if (currentStock <= reorderLevel || stockAfter7Days < 0) return "Critical";
  if (currentStock <= reorderLevel * 1.5) return "Low Stock";
  return "Healthy";
}

function generateNarrative(item: InventoryItem): NarrativeCard {
  const { currentStock, unit, forecastedUsage: avgDailyUsage, reorderLevel, daysUntilEmpty } = item;
  const stockAfter7 = currentStock - avgDailyUsage * 7;

  if (currentStock <= reorderLevel || stockAfter7 < 0) {
    return {
      item,
      tier: "critical",
      text: `Current stock is ${currentStock} ${unit}. Your reorder level is ${reorderLevel} ${unit}. Stock has already reached or will cross the reorder level within 7 days. Recommended immediate restock: reorder at least ${reorderLevel} units now.`,
      badge: currentStock <= reorderLevel ? "Already at reorder level" : `Runs out in ~${Math.max(0, Math.floor(currentStock / (avgDailyUsage || 1)))} day(s)`,
      subtitle: "Reorder immediately",
    };
  }

  if (daysUntilEmpty === null || avgDailyUsage < 0.001) {
    return {
      item,
      tier: "healthy",
      text: `Current stock is ${currentStock} ${unit}. No recent usage data is available for this item at this branch. No restock calculation can be made — monitor manually.`,
      badge: "No usage data",
      subtitle: "No action needed",
    };
  }

  if (daysUntilEmpty <= 30) {
    return {
      item,
      tier: "monitor",
      text: `Current stock is ${currentStock} ${unit}. Average daily usage is ${avgDailyUsage.toFixed(1)} ${unit}/day based on historical order data. At this rate, stock will last approximately ${daysUntilEmpty} more days before reaching the reorder level of ${reorderLevel} ${unit}. Plan a restock within the next 1–2 weeks.`,
      badge: `~${daysUntilEmpty} days before reorder level`,
      subtitle: "Plan restock soon",
    };
  }

  return {
    item,
    tier: "healthy",
    text: `Current stock is ${currentStock} ${unit}. Average daily usage is ${avgDailyUsage.toFixed(1)} ${unit}/day. Stock will last approximately ${daysUntilEmpty} days — well above the reorder level of ${reorderLevel} ${unit}. No restocking action required.`,
    badge: `${daysUntilEmpty} days — sufficient stock`,
    subtitle: "No action needed",
  };
}

const statusStyle: Record<string, string> = {
  Healthy: "bg-emerald-500/15 text-emerald-600",
  "Low Stock": "bg-amber-500/15 text-amber-600",
  Critical: "bg-destructive/10 text-destructive",
};

const anim = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

// ─── Pagination ───────────────────────────────────────────────────────────────

function Paginator({
  page, total, pageSize, onPage,
}: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/20 bg-muted/10 text-xs text-muted-foreground">
      <span>Page {page} of {pages} ({total} item{total !== 1 ? "s" : ""})</span>
      <div className="flex gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PredictiveInventoryPage() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const userBranch = user?.branch || "";

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [forecast, setForecast] = useState<Array<{ itemId: number; itemName: string; branch: string; narrative?: string; estimatedDaysUntilStockout?: number }>>([]);
  const [forecastData, setForecastData] = useState<Array<{ branch: string; detergent: number; conditioner: number }>>([]);
  const [pendingConsumption, setPendingConsumption] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [guideOpen, setGuideOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("inv_guide_open") !== "false"; } catch { return true; }
  });
  const [selectedTab, setSelectedTab] = useState("All");
  const [branches, setBranches] = useState<string[]>([]);
  const [dynamicBranches, setDynamicBranches] = useState<string[]>([]);

  // Pagination
  const [tablePage, setTablePage] = useState(1);
  const [alertsPage, setAlertsPage] = useState(1);
  const [narrativePage, setNarrativePage] = useState(1);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({ branch: "", itemName: "", category: "", unit: "", currentStock: "0", reorderLevel: "0" });

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({ branch: "", itemName: "", category: "", unit: "", reorderLevel: "0" });

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ quantityDelta: "0", direction: "OUT" as "IN" | "OUT", reason: "" });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadInventory = async () => {
    try {
      setError("");
      const [items, alerts, forecastResp, pending] = await Promise.all([
        inventoryApi.list(),
        inventoryApi.alerts(),
        inventoryApi.forecast(7),
        inventoryApi.pendingConsumption().catch(() => ({})),
      ]);
      setPendingConsumption(pending || {});

      const lowStockIds = new Set((alerts || []).map((a) => a.id));
      const forecastMap = new Map<number, { usage: number; daysLeft: number | null; narrative?: string }>();
      (forecastResp || []).forEach((f) => {
        const usage = Number(f.estimatedDailyUsage || 0);
        const rawDays = Number(f.estimatedDaysUntilStockout || 0);
        forecastMap.set(f.itemId, {
          usage,
          daysLeft: calcDaysRemaining(Number(f.currentStock || 0), usage),
          narrative: f.narrative,
        });
      });
      setForecast(forecastResp || []);

      const mappedInventory = (items || []).map((i) => mapInventoryRecord(i, lowStockIds, forecastMap));

      const uniqueBranches = Array.from(new Set(mappedInventory.map((i) => i.branch))).sort();
      setBranches(uniqueBranches);

      const grouped = new Map<string, { detergent: number; conditioner: number }>();
      mappedInventory.forEach((row) => {
        if (!grouped.has(row.branch)) grouped.set(row.branch, { detergent: 0, conditioner: 0 });
        const cur = grouped.get(row.branch)!;
        if (row.type === "Detergent") cur.detergent += row.forecastedUsage;
        if (row.type === "Fabric Conditioner") cur.conditioner += row.forecastedUsage;
      });

      setInventory(mappedInventory);
      setForecastData(
        Array.from(grouped.entries()).map(([branch, v]) => ({
          branch,
          detergent: Number(v.detergent.toFixed(2)),
          conditioner: Number(v.conditioner.toFixed(2)),
        }))
      );
    } catch (err: any) {
      setError(err?.message || "Unable to load inventory data.");
      setInventory([]);
      setForecastData([]);
    }
  };

  useEffect(() => {
    const run = async () => { setLoading(true); await loadInventory(); setLoading(false); };
    void run();
    branchesApi.list().then(setDynamicBranches).catch(() => setDynamicBranches([]));
  }, []);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const criticalCount = useMemo(() => inventory.filter((i) => i.status === "Critical").length, [inventory]);
  const lowStockCount = useMemo(() => inventory.filter((i) => i.status === "Low Stock").length, [inventory]);

  const nextRestockItem = useMemo(() => {
    const items = inventory.filter((i) => i.status !== "Healthy" && i.daysUntilEmpty !== null && i.daysUntilEmpty > 0);
    if (!items.length) return null;
    return items.reduce((min, i) => (i.daysUntilEmpty! < min.daysUntilEmpty! ? i : min));
  }, [inventory]);

  const branchesWithAlerts = useMemo(
    () => new Set(inventory.filter((i) => i.status !== "Healthy").map((i) => i.branch)).size,
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    if (isStaff) return inventory.filter((i) => i.branch === userBranch);
    if (selectedTab === "All") return inventory;
    return inventory.filter((i) => i.branch === selectedTab);
  }, [inventory, selectedTab, isStaff, userBranch]);

  // Reset to page 1 when filter changes
  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
    setTablePage(1);
    setAlertsPage(1);
    setNarrativePage(1);
  };

  // Paginated table rows
  const pagedTable = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return filteredInventory.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredInventory, tablePage]);

  // Critical-only alerts
  const criticalItems = useMemo(() => filteredInventory.filter((i) => i.status === "Critical"), [filteredInventory]);
  const pagedAlerts = useMemo(() => {
    const start = (alertsPage - 1) * ALERTS_PAGE_SIZE;
    return criticalItems.slice(start, start + ALERTS_PAGE_SIZE);
  }, [criticalItems, alertsPage]);

  // Narrative cards (tiered)
  const narrativeCards = useMemo<NarrativeCard[]>(() => {
    const all = filteredInventory.map(generateNarrative);
    const tier1 = all.filter((c) => c.tier === "critical");
    const tier2 = all.filter((c) => c.tier === "monitor");
    const tier3 = all.filter((c) => c.tier === "healthy");
    return [...tier1, ...tier2, ...tier3];
  }, [filteredInventory]);

  const pagedNarrative = useMemo(() => {
    const start = (narrativePage - 1) * NARRATIVE_PAGE_SIZE;
    return narrativeCards.slice(start, start + NARRATIVE_PAGE_SIZE);
  }, [narrativeCards, narrativePage]);

  // Per-item 30-day chart
  const { perItemData, chartLines } = useMemo(() => {
    const candidates = filteredInventory
      .filter((i) => i.forecastedUsage > 0.001)
      .sort((a, b) => {
        if (a.daysUntilEmpty === null) return 1;
        if (b.daysUntilEmpty === null) return -1;
        return a.daysUntilEmpty - b.daysUntilEmpty;
      })
      .slice(0, 5);

    const lines = candidates.map((inv, idx) => ({
      key: `item_${inv.id}`,
      label: `${inv.product} (${inv.branch})`,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      reorderLevel: inv.reorderLevel,
    }));

    const data = Array.from({ length: 30 }, (_, d) => {
      const pt: Record<string, number | string> = { day: `Day ${d + 1}` };
      candidates.forEach((inv) => {
        pt[`item_${inv.id}`] = Math.max(0, Math.round((inv.currentStock - inv.forecastedUsage * (d + 1)) * 10) / 10);
      });
      return pt;
    });

    return { perItemData: data, chartLines: lines };
  }, [filteredInventory]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setCreateForm({ branch: isAdmin ? "" : userBranch, itemName: "", category: "", unit: "", currentStock: "0", reorderLevel: "0" });
    setCreateOpen(true);
  };
  const openEdit = (row: InventoryItem) => {
    setSelectedItem(row);
    setEditForm({ branch: row.branch, itemName: row.product, category: row.category, unit: row.unit, reorderLevel: String(row.reorderLevel) });
    setEditOpen(true);
  };
  const openAdjust = (row: InventoryItem) => {
    setSelectedItem(row);
    setAdjustForm({ quantityDelta: "0", direction: "OUT", reason: "" });
    setAdjustOpen(true);
  };
  const openDelete = (row: InventoryItem) => { setSelectedItem(row); setDeleteOpen(true); };

  const submitCreate = async () => {
    if (!createForm.branch.trim() || !createForm.itemName.trim() || !createForm.category.trim() || !createForm.unit.trim()) {
      toast.error("Branch, item name, category, and unit are required."); return;
    }
    setCreateSubmitting(true);
    try {
      await inventoryApi.create({ branch: createForm.branch.trim(), itemName: createForm.itemName.trim(), category: createForm.category.trim(), unit: createForm.unit.trim(), currentStock: Number(createForm.currentStock || 0), reorderLevel: Number(createForm.reorderLevel || 0) });
      toast.success("Inventory item created.");
      setCreateOpen(false);
      setCreateForm({ branch: "", itemName: "", category: "", unit: "", currentStock: "0", reorderLevel: "0" });
      await loadInventory();
    } catch (err: any) { toast.error(err?.message || "Unable to create inventory item."); }
    finally { setCreateSubmitting(false); }
  };

  const submitEdit = async () => {
    if (!selectedItem) return;
    if (!editForm.branch.trim() || !editForm.itemName.trim() || !editForm.category.trim() || !editForm.unit.trim()) {
      toast.error("Branch, item name, category, and unit are required."); return;
    }
    setEditSubmitting(true);
    try {
      await inventoryApi.update(selectedItem.id, { branch: editForm.branch.trim(), itemName: editForm.itemName.trim(), category: editForm.category.trim(), unit: editForm.unit.trim(), reorderLevel: Number(editForm.reorderLevel || 0) });
      toast.success("Inventory item updated.");
      setEditOpen(false);
      await loadInventory();
    } catch (err: any) { toast.error(err?.message || "Unable to update inventory item."); }
    finally { setEditSubmitting(false); }
  };

  const submitAdjust = async () => {
    if (!selectedItem) return;
    if (!adjustForm.reason.trim()) { toast.error("Adjustment reason is required."); return; }
    setAdjustSubmitting(true);
    try {
      await inventoryApi.adjust(selectedItem.id, { quantityDelta: Number(adjustForm.quantityDelta || 0), direction: adjustForm.direction, reason: adjustForm.reason.trim() });
      toast.success("Stock updated successfully.");
      setAdjustOpen(false);
      await loadInventory();
    } catch (err: any) { toast.error(err?.message || "Unable to adjust stock."); }
    finally { setAdjustSubmitting(false); }
  };

  const submitDelete = async () => {
    if (!selectedItem) return;
    setDeleteSubmitting(true);
    try {
      await inventoryApi.remove(selectedItem.id);
      toast.success("Inventory item deleted.");
      setDeleteOpen(false);
      await loadInventory();
    } catch (err: any) { toast.error(err?.message || "Unable to delete inventory item."); }
    finally { setDeleteSubmitting(false); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">

      {/* Header */}
      <motion.div variants={anim} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Predictive Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isStaff
              ? `Viewing inventory for ${userBranch || "your branch"}`
              : "Monitor stock levels, forecast consumption, and manage inventory across branches"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 px-4 rounded-xl" onClick={() => { setLoading(true); loadInventory().finally(() => setLoading(false)); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button className="h-10 px-5 rounded-xl gradient-navy" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create Item
            </Button>
          )}
        </div>
      </motion.div>

      {/* How to Read This Page */}
      <motion.div variants={anim} className="rounded-2xl border border-border/40 overflow-hidden">
        <button
          onClick={() => {
            const next = !guideOpen;
            setGuideOpen(next);
            try { localStorage.setItem("inv_guide_open", String(next)); } catch {}
          }}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">How to Read This Page</span>
            <span className="text-xs text-muted-foreground">(click to {guideOpen ? "hide" : "show"})</span>
          </div>
          {guideOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {guideOpen && (
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-5 bg-muted/20 border-t border-border/30">
            {[
              { icon: "📋", title: "7-Day Forecast Table", desc: "Shows each item's current stock and how much will be used in the next 7 days. Items highlighted in red will run out soon and need restocking." },
              { icon: "⚠️", title: "Stock Alerts", desc: "Lists only Critical items that need immediate attention. Stock below the reorder level means the item must be restocked now." },
              { icon: "📈", title: "Forecast Charts", desc: "The line chart shows projected stock per item over 30 days. When a line crosses its dashed reorder threshold, that item needs restocking." },
            ].map((g) => (
              <div key={g.title} className="flex gap-3 items-start">
                <span className="text-xl leading-none mt-0.5 flex-shrink-0">{g.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{g.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Alert banner */}
      {(criticalCount > 0 || lowStockCount > 0) && !loading && (
        <motion.div variants={anim} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">{criticalCount + lowStockCount} item(s)</span> need restocking across{" "}
            <span className="font-semibold">{branchesWithAlerts} branch(es)</span>
          </p>
        </motion.div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Stats — skeleton while loading */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))
          : [
              { label: "Total Items Tracked", value: inventory.length, icon: Package, color: "bg-primary/10 text-primary" },
              { label: "Healthy Stock", value: inventory.filter((i) => i.status === "Healthy").length, icon: TrendingUp, color: "bg-emerald-500/15 text-emerald-600" },
              { label: "Branches With Alerts", value: branchesWithAlerts, icon: MapPin, color: "bg-destructive/10 text-destructive" },
              {
                label: "Next Restock Due",
                value: nextRestockItem ? `~${Math.ceil(nextRestockItem.daysUntilEmpty!)}d` : "OK",
                icon: CalendarClock,
                color: nextRestockItem ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600",
              },
            ].map((s) => (
              <motion.div key={s.label} variants={anim} className="glass-card rounded-2xl p-5">
                <div className={`p-2.5 rounded-xl ${s.color} w-fit mb-3`}><s.icon className="h-5 w-5" /></div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
      </div>

      {/* Branch filter tabs (admin only) */}
      {isAdmin && branches.length > 0 && (
        <motion.div variants={anim} className="flex flex-wrap gap-2">
          {["All", ...branches].map((b) => (
            <button
              key={b}
              onClick={() => handleTabChange(b)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedTab === b ? "bg-primary text-primary-foreground" : "bg-background text-foreground border border-border hover:bg-muted"
              }`}
            >
              {b}
            </button>
          ))}
        </motion.div>
      )}

      {/* 7-Day Forecast Table */}
      <motion.div variants={anim} className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <h2 className="text-lg font-semibold text-foreground">7-Day Inventory Forecast</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Projected usage and stock levels based on historical movement data</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                {[
                  { label: "Item" },
                  { label: "Category" },
                  { label: "Current Stock", tip: "Colored bar shows stock fullness relative to reorder level." },
                  { label: "Pending Orders", tip: "Reserved for active orders not yet processed." },
                  { label: "Unit" },
                  { label: "Est. Usage (7 Days)", tip: "Forecasted consumption over the next 7 days." },
                  { label: "Stock After 7 Days", tip: "Red ⚠ means item will run out within 7 days." },
                  { label: "Reorder Level", tip: "Minimum stock before restock is recommended." },
                  { label: "Status" },
                  ...(isAdmin ? [{ label: "Actions" }] : []),
                ].map((h) => (
                  <th key={h.label} className="text-left p-4 font-medium text-muted-foreground whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {h.label}
                      {"tip" in h && h.tip && (
                        <span className="group relative inline-block">
                          <Info className="h-3 w-3 text-muted-foreground/40 hover:text-primary cursor-help transition-colors" />
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-52 text-xs font-normal text-foreground bg-popover border border-border shadow-xl rounded-xl px-3 py-2 leading-relaxed whitespace-normal">
                            {h.tip}
                          </span>
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/20">
                      {Array.from({ length: isAdmin ? 10 : 9 }).map((_, j) => (
                        <td key={j} className="p-4"><Skeleton className="h-4 w-full rounded" /></td>
                      ))}
                    </tr>
                  ))
                : pagedTable.map((inv) => {
                    const after7 = inv.currentStock - inv.forecastedUsage * 7;
                    const isNeg = after7 < 0;
                    return (
                      <tr key={inv.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {inv.type === "Detergent" ? <Droplets className="h-4 w-4 text-primary flex-shrink-0" /> : <Sparkles className="h-4 w-4 text-secondary flex-shrink-0" />}
                            <span className="font-medium text-foreground">{inv.product}</span>
                          </div>
                          <span className="text-xs text-muted-foreground ml-6">{inv.branch}</span>
                        </td>
                        <td className="p-4 text-muted-foreground">{inv.category}</td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5 min-w-[110px]">
                            <span className="font-semibold text-foreground text-sm">{inv.currentStock} <span className="text-xs font-normal text-muted-foreground">{inv.unit}</span></span>
                            <div className="h-1.5 rounded-full bg-muted w-full overflow-hidden" title={`${inv.currentStock} — reorder at ${inv.reorderLevel}`}>
                              <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${inv.status === "Critical" ? "bg-destructive" : inv.status === "Low Stock" ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(100, inv.reorderLevel > 0 ? (inv.currentStock / (inv.reorderLevel * 2)) * 100 : 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {(pendingConsumption[inv.product] ?? 0) > 0
                            ? <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">{pendingConsumption[inv.product]} expected</span>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="p-4 text-muted-foreground">{inv.unit}</td>
                        <td className="p-4 text-muted-foreground">
                          {inv.forecastedUsage < 0.001 ? <span className="text-xs text-muted-foreground italic">No data</span> : (inv.forecastedUsage * 7).toFixed(1)}
                        </td>
                        <td className={`p-4 font-medium ${isNeg ? "text-destructive" : "text-foreground"}`}>
                          <span className="inline-flex items-center gap-1">
                            {isNeg && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                            {inv.forecastedUsage < 0.001 ? <span className="text-xs text-muted-foreground italic">No data</span> : after7.toFixed(1)}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">{inv.reorderLevel}</td>
                        <td className="p-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle[inv.status]}`}>{inv.status}</span>
                        </td>
                        {isAdmin && (
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openAdjust(inv)} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">Update</button>
                              <span className="text-border">·</span>
                              <button onClick={() => openEdit(inv)} className="text-xs text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                              <button onClick={() => openDelete(inv)} className="text-xs text-destructive hover:text-destructive/80"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              {!loading && filteredInventory.length === 0 && (
                <tr><td colSpan={isAdmin ? 10 : 9} className="p-8 text-center text-sm text-muted-foreground">No inventory items found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Status key legend */}
        <div className="px-5 py-3 border-t border-border/20 flex flex-wrap items-center gap-x-6 gap-y-2 bg-muted/10">
          <span className="text-xs font-semibold text-muted-foreground">Status key:</span>
          {[
            { color: "bg-emerald-500", label: "Healthy", desc: "above reorder level" },
            { color: "bg-amber-500", label: "Low Stock", desc: "approaching reorder level" },
            { color: "bg-destructive", label: "Critical", desc: "below reorder level" },
          ].map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-foreground">
              <span className={`h-2.5 w-2.5 rounded-full ${s.color} flex-shrink-0`} />
              <strong>{s.label}</strong> — {s.desc}
            </span>
          ))}
          <span className="text-xs text-muted-foreground">A <span className="text-destructive font-bold">red ⚠</span> "Stock After 7 Days" means the item will run out within a week.</span>
        </div>
        {/* Pagination */}
        {!loading && filteredInventory.length > TABLE_PAGE_SIZE && (
          <Paginator page={tablePage} total={filteredInventory.length} pageSize={TABLE_PAGE_SIZE} onPage={setTablePage} />
        )}
      </motion.div>

      {/* Stock Alerts — Critical only */}
      {!loading && criticalItems.length > 0 && (
        <motion.div variants={anim} className="glass-card rounded-2xl p-6 border-l-4 border-destructive">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Stock Alerts
            </h2>
            <span className="text-xs font-semibold bg-destructive/10 text-destructive px-3 py-1 rounded-full">
              {criticalItems.length} item(s) need attention
            </span>
          </div>
          <div className="space-y-3">
            {pagedAlerts.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5">
                <div className="flex items-center gap-3">
                  {inv.type === "Detergent" ? <Droplets className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-secondary" />}
                  <div>
                    <span className="text-sm font-medium text-foreground">{inv.product}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {inv.branch}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted w-32">
                        <div className="h-1.5 rounded-full bg-destructive" style={{ width: `${Math.min(100, (inv.currentStock / (inv.maxStock || 1)) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{inv.currentStock} / {inv.reorderLevel} {inv.unit}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${statusStyle[inv.status]}`}>{inv.status}</span>
                  <p className="text-[10px] text-muted-foreground">
                    {inv.daysUntilEmpty !== null ? `~${inv.daysUntilEmpty.toFixed(1)} day(s) left` : "N/A"}
                  </p>
                  {isAdmin && (
                    <button onClick={() => openAdjust(inv)} className="text-[10px] font-semibold text-primary hover:underline">Restock</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {criticalItems.length > ALERTS_PAGE_SIZE && (
            <div className="mt-3">
              <Paginator page={alertsPage} total={criticalItems.length} pageSize={ALERTS_PAGE_SIZE} onPage={setAlertsPage} />
            </div>
          )}
        </motion.div>
      )}

      {/* Forecast Narrative — tiered cards */}
      {!loading && narrativeCards.length > 0 && (
        <motion.div variants={anim} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Info className="h-4 w-4" /> Inventory Recommendations
            </h3>
          </div>

          {/* Tier headings */}
          {(["critical", "monitor", "healthy"] as const).map((tier) => {
            const tierCards = narrativeCards.filter((c) => c.tier === tier);
            if (tierCards.length === 0) return null;
            const cfg = {
              critical: { label: "Immediate Action Required", accent: "border-l-destructive bg-destructive/5", dot: "bg-destructive", text: "text-destructive" },
              monitor:  { label: "Plan Restock Soon",         accent: "border-l-amber-500 bg-amber-500/5",     dot: "bg-amber-500",    text: "text-amber-600" },
              healthy:  { label: "Sufficient Stock",          accent: "border-l-emerald-500 bg-emerald-500/5", dot: "bg-emerald-500",  text: "text-emerald-600" },
            }[tier];
            // Only paginate the full list; tier headings render inline
            return null; // will render via pagedNarrative below
          })}

          {pagedNarrative.map((card, idx) => {
            const cfg = {
              critical: { accent: "border-l-4 border-l-destructive bg-destructive/5",   dotColor: "bg-destructive",   textColor: "text-destructive" },
              monitor:  { accent: "border-l-4 border-l-amber-500 bg-amber-500/5",        dotColor: "bg-amber-500",     textColor: "text-amber-600" },
              healthy:  { accent: "border-l-4 border-l-emerald-500 bg-emerald-500/5",   dotColor: "bg-emerald-500",   textColor: "text-emerald-600" },
            }[card.tier];
            return (
              <div key={idx} className={`rounded-xl border border-border/20 p-4 ${cfg.accent}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${cfg.dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">{card.item.product} — {card.item.branch}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.dotColor} text-white`}>{card.badge}</span>
                    </div>
                    <p className={`text-xs font-semibold mb-1 ${cfg.textColor}`}>{card.subtitle}</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{card.text}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {narrativeCards.length > NARRATIVE_PAGE_SIZE && (
            <Paginator page={narrativePage} total={narrativeCards.length} pageSize={NARRATIVE_PAGE_SIZE} onPage={setNarrativePage} />
          )}
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 30-day per-item line chart */}
        <motion.div variants={anim} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Consumption Forecast (30 Days)</h2>
          {/* How to read this chart */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 mb-4 text-xs text-blue-800 leading-relaxed">
            Each line shows how much stock is predicted to remain each day. The <strong>dashed lines</strong> are reorder thresholds — when a colored line crosses its dashed line, that item needs restocking. Based on: average daily usage × number of days projected.
            {selectedTab === "All" && <span className="block mt-1 font-medium">Showing top 5 most critical items across all branches.</span>}
          </div>
          {loading ? (
            <Skeleton className="h-[280px] w-full rounded-xl" />
          ) : chartLines.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No usage data available for the selected filter.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={perItemData} margin={{ top: 10, right: 20, left: 15, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(215, 16%, 47%)" }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} label={{ value: "Quantity remaining", angle: -90, position: "insideLeft", offset: -5, fontSize: 10, fill: "hsl(215, 16%, 47%)" }} width={65} />
                <Tooltip
                  formatter={(v: number, name: string) => {
                    const line = chartLines.find((l) => l.key === name);
                    return [`${v} ${filteredInventory.find((i) => `item_${i.id}` === name)?.unit ?? "units"}`, line?.label ?? name];
                  }}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Legend
                  verticalAlign="top"
                  align="left"
                  wrapperStyle={{ fontSize: 10, paddingBottom: 8 }}
                  formatter={(key: string) => chartLines.find((l) => l.key === key)?.label ?? key}
                />
                {chartLines.map((line) => (
                  <ReferenceLine key={`ref_${line.key}`} y={line.reorderLevel} stroke={line.color} strokeDasharray="5 4" strokeWidth={1} label={{ value: `Reorder`, position: "insideTopLeft", fontSize: 9, fill: line.color }} />
                ))}
                {chartLines.map((line) => (
                  <Line key={line.key} type="monotone" dataKey={line.key} name={line.key} stroke={line.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Daily consumption per branch bar chart */}
        {(isAdmin || isStaff) && (
          <motion.div variants={anim} className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">Daily Consumption by Branch</h2>
            <p className="text-xs text-muted-foreground mb-0.5">Estimated daily usage of detergent and fabric conditioner per branch.</p>
            <p className="text-xs text-muted-foreground mb-4"><span className="font-medium text-foreground">Longer bar = more daily usage.</span> Numbers show the exact amount.</p>
            {loading ? (
              <Skeleton className="h-[280px] w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={forecastData} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} label={{ value: "Est. Daily Usage (units)", position: "insideBottom", offset: -14, fontSize: 10, fill: "hsl(215, 16%, 47%)" }} />
                  <YAxis dataKey="branch" type="category" tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} width={110} />
                  <Tooltip formatter={(v: number, name: string) => [`${v} units/day`, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                  <Bar dataKey="detergent" name="Detergent" fill="hsl(218,58%,20%)" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="detergent" position="right" style={{ fontSize: 10, fill: "hsl(215, 16%, 47%)", fontWeight: 600 }} formatter={(v: any) => (v > 0 ? `${v}` : "")} />
                  </Bar>
                  <Bar dataKey="conditioner" name="Fabric Conditioner" fill="hsl(168,55%,68%)" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="conditioner" position="right" style={{ fontSize: 10, fill: "hsl(215, 16%, 47%)", fontWeight: 600 }} formatter={(v: any) => (v > 0 ? `${v}` : "")} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Dialogs (admin only) ──────────────────────────────────────────────── */}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Inventory Item</DialogTitle><DialogDescription>Add a new inventory item to track.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              {isAdmin ? (
                <Select value={createForm.branch} onValueChange={(val) => setCreateForm((p) => ({ ...p, branch: val }))}>
                  <SelectTrigger className="w-full text-foreground"><SelectValue placeholder={dynamicBranches.length ? "Select a branch" : "No branches available"} /></SelectTrigger>
                  <SelectContent>{dynamicBranches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={createForm.branch} readOnly className="bg-muted text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Select value={createForm.itemName} onValueChange={(val) => { const e = INVENTORY_CATALOG.find((c) => c.name === val); setCreateForm((p) => ({ ...p, itemName: val, category: e?.category ?? p.category, unit: e?.unit ?? p.unit })); }}>
                <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select an item" /></SelectTrigger>
                <SelectContent>{INVENTORY_CATALOG.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={createForm.category} onValueChange={(val) => setCreateForm((p) => ({ ...p, category: val }))}>
                  <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{INVENTORY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={createForm.unit} onValueChange={(val) => setCreateForm((p) => ({ ...p, unit: val }))}>
                  <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>{INVENTORY_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Current Stock</Label><Input type="number" min="0" step="0.01" value={createForm.currentStock} onChange={(e) => setCreateForm((p) => ({ ...p, currentStock: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" min="0" step="0.01" value={createForm.reorderLevel} onChange={(e) => setCreateForm((p) => ({ ...p, reorderLevel: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>Cancel</Button>
            <Button onClick={() => void submitCreate()} disabled={createSubmitting}>{createSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}{createSubmitting ? "Creating..." : "Create Item"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Inventory Item</DialogTitle><DialogDescription>Update item details and reorder threshold.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              {isAdmin ? (
                <Select value={editForm.branch} onValueChange={(val) => setEditForm((p) => ({ ...p, branch: val }))}>
                  <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select a branch" /></SelectTrigger>
                  <SelectContent>{dynamicBranches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={editForm.branch} readOnly className="bg-muted text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Select value={editForm.itemName} onValueChange={(val) => { const e = INVENTORY_CATALOG.find((c) => c.name === val); setEditForm((p) => ({ ...p, itemName: val, category: e?.category ?? p.category, unit: e?.unit ?? p.unit })); }}>
                <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select an item" /></SelectTrigger>
                <SelectContent>{INVENTORY_CATALOG.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={editForm.category} onValueChange={(val) => setEditForm((p) => ({ ...p, category: val }))}>
                  <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{INVENTORY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={editForm.unit} onValueChange={(val) => setEditForm((p) => ({ ...p, unit: val }))}>
                  <SelectTrigger className="w-full text-foreground"><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>{INVENTORY_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" min="0" step="0.01" value={editForm.reorderLevel} onChange={(e) => setEditForm((p) => ({ ...p, reorderLevel: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSubmitting}>Cancel</Button>
            <Button onClick={() => void submitEdit()} disabled={editSubmitting}>{editSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Pencil className="h-4 w-4 mr-1" />}{editSubmitting ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock</DialogTitle><DialogDescription>Apply stock in/out for {selectedItem?.product}.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" min="0.01" step="0.01" value={adjustForm.quantityDelta} onChange={(e) => setAdjustForm((p) => ({ ...p, quantityDelta: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <select value={adjustForm.direction} onChange={(e) => setAdjustForm((p) => ({ ...p, direction: e.target.value as "IN" | "OUT" }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="IN">IN (Restock)</option>
                  <option value="OUT">OUT (Usage)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>Reason</Label><Input placeholder="e.g. Weekly restock, Manual usage" value={adjustForm.reason} onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjustSubmitting}>Cancel</Button>
            <Button onClick={() => void submitAdjust()} disabled={adjustSubmitting}>{adjustSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Applying...</> : "Apply Adjustment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inventory item?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove {selectedItem?.product || "this item"} and its stock movement history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={(e) => { e.preventDefault(); void submitDelete(); }} disabled={deleteSubmitting}>
              {deleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}{deleteSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </motion.div>
  );
}

// ─── Record → InventoryItem ───────────────────────────────────────────────────

function mapInventoryRecord(
  i: InventoryRecord,
  lowStockIds: Set<number>,
  forecastMap: Map<number, { usage: number; daysLeft: number | null; narrative?: string }>,
): InventoryItem {
  const itemForecast = forecastMap.get(i.id);
  const dailyUsage = itemForecast?.usage ?? 0;
  const stockAfter7 = Number(i.currentStock || 0) - dailyUsage * 7;
  const status = getStatus(Number(i.currentStock || 0), Number(i.reorderLevel || 0), stockAfter7);

  return {
    id: i.id,
    product: i.itemName,
    type: i.category?.toLowerCase().includes("conditioner") ? "Fabric Conditioner" : "Detergent",
    branch: i.branch,
    currentStock: Number(i.currentStock || 0),
    maxStock: Number(i.reorderLevel || 0) * 2 || 100,
    reorderLevel: Number(i.reorderLevel || 0),
    unit: i.unit || "packs",
    category: i.category || "General",
    forecastedUsage: dailyUsage,
    daysUntilEmpty: calcDaysRemaining(Number(i.currentStock || 0), dailyUsage),
    projectedAfter7Days: stockAfter7,
    status,
  };
}
