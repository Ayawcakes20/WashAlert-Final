import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

const INVENTORY_CATALOG = [
  { name: "Surf Detergent", category: "Detergent", unit: "packs" },
  { name: "Ariel Detergent", category: "Detergent", unit: "packs" },
  { name: "Charm Fabric Conditioner", category: "Fabric Conditioner", unit: "packs" },
  { name: "Downy Fabric Conditioner", category: "Fabric Conditioner", unit: "packs" },
] as const;

const INVENTORY_CATEGORIES = ["Detergent", "Fabric Conditioner"] as const;
const INVENTORY_UNITS = ["packs", "liters", "kg", "bottles", "pieces"] as const;

const DEFAULT_TABLE_PAGE_SIZE = 10;
const TABLE_PAGE_SIZES = [10, 25, 50] as const;
const ATTENTION_DEFAULT_LIMIT = 5;

interface InventoryItem {
  id: number;
  product: string;
  type: "Detergent" | "Fabric Conditioner";
  branch: string;
  currentStock: number;
  reorderLevel: number;
  unit: string;
  category: string;
  forecastedUsage: number;
  daysUntilEmpty: number | null;
  projectedAfter7Days: number;
  status: "Healthy" | "Low Stock" | "Critical";
  historicalDailyUsage: number;
  confirmedDemand7D: number;
}

function calcDaysRemaining(currentStock: number, avgDailyUsage: number): number | null {
  if (avgDailyUsage < 0.001) return null;
  return Math.floor(currentStock / avgDailyUsage);
}

function getStatus(currentStock: number, reorderLevel: number, stockAfter7Days: number): "Healthy" | "Low Stock" | "Critical" {
  if (currentStock <= reorderLevel || stockAfter7Days < 0) return "Critical";
  if (currentStock <= reorderLevel * 1.5) return "Low Stock";
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
  if (item.status === "Low Stock") return "Plan restock";
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

const statusStyle: Record<string, string> = {
  Healthy: "bg-emerald-100 text-emerald-700",
  "Low Stock": "bg-amber-100 text-amber-700",
  Critical: "bg-red-100 text-red-700",
};

function Paginator({
  page,
  total,
  pageSize,
  pageSizes,
  onPageSizeChange,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  pageSizes: readonly number[];
  onPageSizeChange: (size: number) => void;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/20 bg-muted/10 text-sm text-muted-foreground">
      <span className="text-sm">
        Page {page} of {pages} ({total} item{total !== 1 ? "s" : ""})
      </span>
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Rows:</label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="px-2 py-1 rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function PredictiveInventoryPage() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const userBranch = getCanonicalBranchName(user?.branch || "");

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [pendingConsumption, setPendingConsumption] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("All");
  const [branches, setBranches] = useState<string[]>([]);
  const [dynamicBranches, setDynamicBranches] = useState<string[]>([]);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    branch: "",
    itemName: "",
    category: "",
    unit: "",
    currentStock: "0",
    reorderLevel: "0",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    branch: "",
    itemName: "",
    category: "",
    unit: "",
    reorderLevel: "0",
  });

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    quantityDelta: "0",
    direction: "OUT" as "IN" | "OUT",
    reason: "",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadInventory = async () => {
    try {
      setError("");
      const [items, _alerts, forecastResp, pending] = await Promise.all([
        inventoryApi.list(),
        inventoryApi.alerts(),
        inventoryApi.forecast(7),
        inventoryApi.pendingConsumption().catch(() => ({})),
      ]);
      setPendingConsumption(pending || {});

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
    const run = async () => {
      setLoading(true);
      await loadInventory();
      setLoading(false);
    };
    void run();
    branchesApi
      .list()
      .then((list) => {
        setDynamicBranches(
          Array.from(new Set(list.map((b) => getCanonicalBranchName(b)))).sort(),
        );
      })
      .catch(() => setDynamicBranches([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredInventory = useMemo(() => {
    if (isStaff) return inventory;
    if (selectedTab === "All") return inventory;
    return inventory.filter((i) => i.branch === selectedTab);
  }, [inventory, selectedTab, isStaff]);

  const summary = useMemo(() => {
    const critical = filteredInventory.filter((i) => i.status === "Critical").length;
    const low = filteredInventory.filter((i) => i.status === "Low Stock").length;
    const healthy = filteredInventory.filter((i) => i.status === "Healthy").length;
    const urgent = filteredInventory
      .filter((i) => i.status !== "Healthy")
      .sort((a, b) => {
        if (a.daysUntilEmpty === null) return 1;
        if (b.daysUntilEmpty === null) return -1;
        return a.daysUntilEmpty - b.daysUntilEmpty;
      })[0] ?? null;
    return { critical, low, healthy, urgent };
  }, [filteredInventory]);

  const needsAttention = useMemo(() => {
    return filteredInventory
      .filter((i) => i.status === "Critical" || i.status === "Low Stock")
      .sort((a, b) => {
        const scoreA = a.status === "Critical" ? 0 : 1;
        const scoreB = b.status === "Critical" ? 0 : 1;
        if (scoreA !== scoreB) return scoreA - scoreB;
        if (a.daysUntilEmpty === null) return 1;
        if (b.daysUntilEmpty === null) return -1;
        return a.daysUntilEmpty - b.daysUntilEmpty;
      });
  }, [filteredInventory]);

  const visibleAttention = showAllAttention
    ? needsAttention
    : needsAttention.slice(0, ATTENTION_DEFAULT_LIMIT);

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

    return Array.from(grouped.entries())
      .map(([branch, items]) => {
        const critical = items.filter((i) => i.status === "Critical").length;
        const low = items.filter((i) => i.status === "Low Stock").length;
        const healthy = items.filter((i) => i.status === "Healthy").length;
        const urgent = items
          .filter((i) => i.status !== "Healthy")
          .sort((a, b) => {
            if (a.daysUntilEmpty === null) return 1;
            if (b.daysUntilEmpty === null) return -1;
            return a.daysUntilEmpty - b.daysUntilEmpty;
          })[0] ?? null;
        return {
          branch,
          critical,
          low,
          healthy,
          urgentItem: urgent?.product ?? "No urgent item",
          action: urgent ? getRecommendedAction(urgent) : "Healthy",
        };
      })
      .sort((a, b) => a.branch.localeCompare(b.branch));
  }, [inventory]);

  const selectedExpandedItem = useMemo(
    () => filteredInventory.find((item) => item.id === expandedRowId) ?? null,
    [expandedRowId, filteredInventory],
  );

  const selectedItemChart = useMemo(() => {
    if (!selectedExpandedItem || selectedExpandedItem.forecastedUsage < 0.001) {
      return [] as Array<{ day: string; stock: number }>;
    }
    return Array.from({ length: 30 }, (_, idx) => ({
      day: `Day ${idx + 1}`,
      stock: Math.max(
        0,
        Math.round(
          (selectedExpandedItem.currentStock -
            selectedExpandedItem.forecastedUsage * (idx + 1)) * 10,
        ) / 10,
      ),
    }));
  }, [selectedExpandedItem]);

  const handleTabChange = (branch: string) => {
    setSelectedTab(branch);
    setTablePage(1);
    setExpandedRowId(null);
  };

  useEffect(() => {
    setTablePage(1);
  }, [selectedTab, tablePageSize]);

  const openCreate = () => {
    setCreateForm({
      branch: isAdmin ? "" : userBranch,
      itemName: "",
      category: "",
      unit: "",
      currentStock: "0",
      reorderLevel: "0",
    });
    setCreateOpen(true);
  };

  const openEdit = (row: InventoryItem) => {
    setSelectedItem(row);
    setEditForm({
      branch: row.branch,
      itemName: row.product,
      category: row.category,
      unit: row.unit,
      reorderLevel: String(row.reorderLevel),
    });
    setEditOpen(true);
  };

  const openAdjust = (row: InventoryItem) => {
    setSelectedItem(row);
    setAdjustForm({ quantityDelta: "0", direction: "IN", reason: "Restock" });
    setAdjustOpen(true);
  };

  const openDelete = (row: InventoryItem) => {
    setSelectedItem(row);
    setDeleteOpen(true);
  };

  const submitCreate = async () => {
    if (!createForm.branch.trim() || !createForm.itemName.trim() || !createForm.category.trim() || !createForm.unit.trim()) {
      toast.error("Branch, item name, category, and unit are required.");
      return;
    }
    setCreateSubmitting(true);
    try {
      await inventoryApi.create({
        branch: createForm.branch.trim(),
        itemName: createForm.itemName.trim(),
        category: createForm.category.trim(),
        unit: createForm.unit.trim(),
        currentStock: Number(createForm.currentStock || 0),
        reorderLevel: Number(createForm.reorderLevel || 0),
      });
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
      toast.error("Branch, item name, category, and unit are required.");
      return;
    }
    setEditSubmitting(true);
    try {
      await inventoryApi.update(selectedItem.id, {
        branch: editForm.branch.trim(),
        itemName: editForm.itemName.trim(),
        category: editForm.category.trim(),
        unit: editForm.unit.trim(),
        reorderLevel: Number(editForm.reorderLevel || 0),
      });
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
    if (!adjustForm.reason.trim()) {
      toast.error("Adjustment reason is required.");
      return;
    }
    setAdjustSubmitting(true);
    try {
      await inventoryApi.adjust(selectedItem.id, {
        quantityDelta: Number(adjustForm.quantityDelta || 0),
        direction: adjustForm.direction,
        reason: adjustForm.reason.trim(),
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Predictive Inventory
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            {isStaff
              ? `Viewing inventory for ${userBranch || "your branch"}`
              : "Actionable restock dashboard for all branches."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 px-4 rounded-xl"
            onClick={() => {
              setLoading(true);
              loadInventory().finally(() => setLoading(false));
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {(isAdmin || isStaff) && (
            <Button className="h-10 px-5 rounded-xl gradient-navy" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Create Item
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold text-foreground">
            How forecast is calculated
          </span>
        </div>
        <ul className="space-y-1 text-sm text-foreground/90 leading-relaxed">
          <li>- Historical usage from completed orders</li>
          <li>- Confirmed upcoming bookings demand</li>
          <li>- Current stock and reorder level</li>
          <li>- Result: days left and restock priority</li>
        </ul>
      </div>

      <div className="rounded-xl border border-border/30 bg-white p-4">
        <p className="text-base text-foreground">
          Use this page to see which supplies need restocking first. The forecast uses current stock, completed order history, and confirmed upcoming bookings. Click View Details to see the calculation for each item.
        </p>
      </div>

      {error && <p className="text-base text-destructive">{error}</p>}

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
              {
                label: "Critical Items",
                value: summary.critical,
                icon: AlertTriangle,
                color: "bg-red-100 text-red-700",
              },
              {
                label: "Low Stock Items",
                value: summary.low,
                icon: CalendarClock,
                color: "bg-amber-100 text-amber-700",
              },
              {
                label: "Healthy Items",
                value: summary.healthy,
                icon: TrendingUp,
                color: "bg-emerald-100 text-emerald-700",
              },
              {
                label: "Next Restock Priority",
                value: summary.urgent
                  ? `${summary.urgent.product} (${summary.urgent.branch})`
                  : "None",
                icon: Package,
                color: "bg-primary/10 text-primary",
              },
            ].map((s) => (
              <div key={s.label} className="glass-card rounded-2xl p-6">
                <div className={`p-2.5 rounded-xl ${s.color} w-fit mb-3`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-foreground break-words">
                  {s.value}
                </p>
                <p className="text-base text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
      </div>

      {isAdmin && branches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {["All", ...branches].map((branch) => (
            <button
              key={branch}
              onClick={() => handleTabChange(branch)}
              className={`px-4 py-2 rounded-lg text-base font-medium transition-colors ${
                selectedTab === branch
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground border border-border hover:bg-muted"
              }`}
            >
              {branch}
            </button>
          ))}
        </div>
      )}

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
            <p className="text-base text-muted-foreground">
              All supplies are healthy based on current stock and expected use.
            </p>
          ) : (
            <div className="space-y-3">
              {visibleAttention.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/30 p-4 bg-muted/10">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-foreground">{item.product}</p>
                      <p className="text-sm text-muted-foreground">{item.branch}</p>
                      <p className="text-sm text-foreground">
                        Current stock: {formatQuantity(item.currentStock, item.unit)} | Expected use 7D:{" "}
                        {formatExpectedUse7D(item)} | Days left:{" "}
                        {item.daysUntilEmpty !== null ? `${item.daysUntilEmpty} day(s)` : "Not enough data yet"}
                      </p>
                      <p className="text-sm text-foreground">
                        Recommended action: {getRecommendedAction(item)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusStyle[item.status]}`}>
                        {item.status}
                      </span>
                      <Button size="sm" onClick={() => openAdjust(item)}>
                        Add Stock
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedRowId((v) => (v === item.id ? null : item.id))}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border/30">
          <h2 className="text-xl font-semibold text-foreground">Inventory Forecast Table</h2>
          <p className="text-base text-muted-foreground mt-1">
            Focus view for branch-level restock decisions.
          </p>
        </div>

        <div className="px-6 py-3 border-b border-border/20 bg-muted/10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="font-semibold text-muted-foreground">Status legend:</span>
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <span className="h-3 w-3 rounded-full bg-red-500" /> Critical = at or below reorder level
          </span>
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <span className="h-3 w-3 rounded-full bg-amber-500" /> Low Stock = reaches reorder level soon
          </span>
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <span className="h-3 w-3 rounded-full bg-emerald-500" /> Healthy = enough stock for expected use
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                {[
                  { label: "Item", hint: "Inventory item name." },
                  { label: "Branch", hint: "Branch where this stock is tracked." },
                  { label: "Current Stock", hint: "Quantity currently available in this branch." },
                  { label: "Expected Use 7D", hint: "Estimated amount that may be used in the next 7 days based on historical usage and confirmed bookings." },
                  { label: "Reorder Level", hint: "Minimum stock level before restocking is recommended." },
                  { label: "Days Left", hint: "Estimated days before this item reaches its reorder level." },
                  { label: "Status", hint: "Critical, Low Stock, or Healthy based on stock level and expected use." },
                  { label: "Action", hint: "Add stock or open details for this item." },
                ].map((col) => (
                  <th
                    key={col.label}
                    title={col.hint}
                    className="text-left p-4 font-semibold text-[15px] text-foreground whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/20">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="p-4">
                          <Skeleton className="h-5 w-full rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                : pagedTable.map((inv) => {
                    const isExpanded = expandedRowId === inv.id;
                    const expectedUse = formatExpectedUse7D(inv);
                    const daysLeft =
                      inv.daysUntilEmpty !== null
                        ? `${inv.daysUntilEmpty} day(s)`
                        : "Not enough data yet";
                    return (
                      <>
                        <tr key={inv.id} className="border-b border-border/20 hover:bg-muted/20 align-top">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {inv.type === "Detergent" ? (
                                <Droplets className="h-4 w-4 text-primary" />
                              ) : (
                                <Sparkles className="h-4 w-4 text-secondary" />
                              )}
                              <span className="text-base font-semibold text-foreground">{inv.product}</span>
                            </div>
                          </td>
                          <td className="p-4 text-base text-foreground">{inv.branch}</td>
                          <td className="p-4 text-base text-foreground">
                            {formatQuantity(inv.currentStock, inv.unit)}
                          </td>
                          <td className="p-4 text-base text-foreground">{expectedUse}</td>
                          <td className="p-4 text-base text-foreground">
                            {formatQuantity(inv.reorderLevel, inv.unit)}
                          </td>
                          <td className="p-4 text-base text-foreground">{daysLeft}</td>
                          <td className="p-4">
                            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusStyle[inv.status]}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" onClick={() => openAdjust(inv)}>
                                Add Stock
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setExpandedRowId((v) => (v === inv.id ? null : inv.id))}
                              >
                                {isExpanded ? "Hide Details" : "View Details"}
                                <ChevronDown
                                  className={`h-4 w-4 ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-border/20 bg-muted/10">
                            <td colSpan={8} className="p-5">
                              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                                <div className="xl:col-span-1 rounded-xl border border-border/30 bg-white p-4 space-y-2">
                                  <h3 className="text-lg font-semibold text-foreground">Forecast Details</h3>
                                  <p className="text-base text-foreground leading-relaxed">
                                    Recommendation: <strong>{buildNarrative(inv)}</strong>
                                  </p>
                                  <p className="text-sm text-muted-foreground leading-relaxed" title="Shows whether the forecast is based on completed orders, upcoming bookings, or both.">
                                    {buildForecastBasis(inv)}
                                  </p>
                                  <p className="text-sm text-foreground">
                                    Current stock: <strong>{formatQuantity(inv.currentStock, inv.unit)}</strong>
                                  </p>
                                  <p className="text-sm text-foreground">
                                    Reorder level: <strong>{formatQuantity(inv.reorderLevel, inv.unit)}</strong>
                                  </p>
                                  <p className="text-sm text-foreground">
                                    Historical usage: <strong>{formatQuantity(inv.historicalDailyUsage, inv.unit, "No recent usage")}/day</strong>
                                  </p>
                                  <p className="text-sm text-foreground">
                                    Confirmed orders 7D:{" "}
                                    <strong>{inv.confirmedDemand7D > 0 ? formatQuantity(inv.confirmedDemand7D, inv.unit) : "No upcoming orders"}</strong>
                                  </p>
                                  <p className="text-sm text-foreground" title="Supply quantity already expected from active or pending bookings.">
                                    Pending demand:{" "}
                                    <strong>{pendingConsumption[inv.product] ? formatQuantity(pendingConsumption[inv.product], inv.unit) : "No pending demand"}</strong>
                                  </p>
                                  <p className="text-sm text-foreground">
                                    Expected use 7D: <strong>{formatExpectedUse7D(inv)}</strong>
                                  </p>
                                  <p className="text-sm text-foreground">
                                    Days left: <strong>{inv.daysUntilEmpty ?? "Not enough data yet"}</strong>
                                  </p>
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    This forecast uses completed order history and confirmed upcoming bookings to estimate stock usage.
                                  </p>
                                  {(isAdmin || isStaff) && (
                                    <div className="flex items-center gap-2 pt-2">
                                      <Button size="sm" variant="outline" onClick={() => openEdit(inv)}>
                                        <Pencil className="h-4 w-4 mr-1" />Edit
                                      </Button>
                                      {isAdmin && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-destructive border-destructive/30"
                                          onClick={() => openDelete(inv)}
                                        >
                                          <Trash2 className="h-4 w-4 mr-1" />Delete
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="xl:col-span-2 rounded-xl border border-border/30 bg-white p-4">
                                  <h3 className="text-lg font-semibold text-foreground mb-2">
                                    30-Day Forecast for {inv.product}
                                  </h3>
                                  {selectedItemChart.length === 0 ? (
                                    <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                                      No recent usage yet for chart projection.
                                    </div>
                                  ) : (
                                    <ResponsiveContainer width="100%" height={260}>
                                      <LineChart data={selectedItemChart} margin={{ top: 10, right: 16, left: 12, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
                                        <XAxis dataKey="day" tick={{ fontSize: 13, fill: "hsl(215, 20%, 35%)" }} interval={4} />
                                        <YAxis tick={{ fontSize: 13, fill: "hsl(215, 20%, 35%)" }} width={60} />
                                        <Tooltip contentStyle={{ fontSize: 13, borderRadius: 10 }} />
                                        <Line type="monotone" dataKey="stock" stroke="hsl(218,58%,20%)" strokeWidth={3} dot={false} />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
              {!loading && filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-base text-muted-foreground">
                    No inventory items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredInventory.length > tablePageSize && (
          <Paginator
            page={tablePage}
            total={filteredInventory.length}
            pageSize={tablePageSize}
            pageSizes={TABLE_PAGE_SIZES}
            onPageSizeChange={setTablePageSize}
            onPage={setTablePage}
          />
        )}
      </div>

      {isAdmin && branchOverview.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-border/30">
            <h2 className="text-xl font-semibold text-foreground">Branch Restock Overview</h2>
            <p className="text-base text-muted-foreground mt-1">
              This compares branches by restocking urgency. Click View Branch to filter the forecast table.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  {[
                    "Branch",
                    "Critical Items",
                    "Low Stock Items",
                    "Healthy Items",
                    "Most Urgent Item",
                    "Recommended Action",
                    "View Branch",
                  ].map((h) => (
                    <th key={h} className="text-left p-4 font-semibold text-[15px] text-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchOverview.map((row) => (
                  <tr key={row.branch} className="border-b border-border/20">
                    <td className="p-4 text-base font-medium text-foreground">{row.branch}</td>
                    <td className="p-4 text-base text-foreground">{row.critical}</td>
                    <td className="p-4 text-base text-foreground">{row.low}</td>
                    <td className="p-4 text-base text-foreground">{row.healthy}</td>
                    <td className="p-4 text-base text-foreground break-words">{row.urgentItem}</td>
                    <td className="p-4 text-base text-foreground">{row.action}</td>
                    <td className="p-4">
                      <Button size="sm" variant="outline" onClick={() => handleTabChange(row.branch)}>
                        View Branch
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Inventory Item</DialogTitle>
            <DialogDescription>Add a new inventory item to track.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              {isAdmin ? (
                <Select
                  value={createForm.branch}
                  onValueChange={(val) => setCreateForm((p) => ({ ...p, branch: val }))}
                >
                  <SelectTrigger className="w-full text-foreground">
                    <SelectValue placeholder={dynamicBranches.length ? "Select a branch" : "No branches available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {dynamicBranches.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={createForm.branch} readOnly className="bg-muted text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Select
                value={createForm.itemName}
                onValueChange={(val) => {
                  const entry = INVENTORY_CATALOG.find((c) => c.name === val);
                  setCreateForm((p) => ({
                    ...p,
                    itemName: val,
                    category: entry?.category ?? p.category,
                    unit: entry?.unit ?? p.unit,
                  }));
                }}
              >
                <SelectTrigger className="w-full text-foreground">
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_CATALOG.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={createForm.category}
                  onValueChange={(val) => setCreateForm((p) => ({ ...p, category: val }))}
                >
                  <SelectTrigger className="w-full text-foreground">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={createForm.unit}
                  onValueChange={(val) => setCreateForm((p) => ({ ...p, unit: val }))}
                >
                  <SelectTrigger className="w-full text-foreground">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Current Stock</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.currentStock}
                  onChange={(e) => setCreateForm((p) => ({ ...p, currentStock: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reorder Level</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createForm.reorderLevel}
                  onChange={(e) => setCreateForm((p) => ({ ...p, reorderLevel: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={createSubmitting}>
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {createSubmitting ? "Creating..." : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>Update item details and reorder threshold.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              {isAdmin ? (
                <Select
                  value={editForm.branch}
                  onValueChange={(val) => setEditForm((p) => ({ ...p, branch: val }))}
                >
                  <SelectTrigger className="w-full text-foreground">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {dynamicBranches.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={editForm.branch} readOnly className="bg-muted text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Select
                value={editForm.itemName}
                onValueChange={(val) => {
                  const entry = INVENTORY_CATALOG.find((c) => c.name === val);
                  setEditForm((p) => ({
                    ...p,
                    itemName: val,
                    category: entry?.category ?? p.category,
                    unit: entry?.unit ?? p.unit,
                  }));
                }}
              >
                <SelectTrigger className="w-full text-foreground">
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_CATALOG.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(val) => setEditForm((p) => ({ ...p, category: val }))}
                >
                  <SelectTrigger className="w-full text-foreground">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={editForm.unit}
                  onValueChange={(val) => setEditForm((p) => ({ ...p, unit: val }))}
                >
                  <SelectTrigger className="w-full text-foreground">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reorder Level</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editForm.reorderLevel}
                onChange={(e) => setEditForm((p) => ({ ...p, reorderLevel: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSubmitting}>
              Cancel
            </Button>
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
            <DialogTitle>Update Stock - {selectedItem?.product}</DialogTitle>
            <DialogDescription>
              <span className="text-foreground font-medium">
                Current: {selectedItem?.currentStock} {selectedItem?.unit}
              </span>
              {" | "}Select <strong>IN</strong> to add received stock, or <strong>OUT</strong> to record usage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={adjustForm.quantityDelta}
                  onChange={(e) => setAdjustForm((p) => ({ ...p, quantityDelta: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <select
                  value={adjustForm.direction}
                  onChange={(e) =>
                    setAdjustForm((p) => ({
                      ...p,
                      direction: e.target.value as "IN" | "OUT",
                    }))
                  }
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="IN">IN (Restock)</option>
                  <option value="OUT">OUT (Usage)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                placeholder="e.g. Weekly restock, Manual usage"
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjustSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitAdjust()} disabled={adjustSubmitting}>
              {adjustSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Applying...
                </>
              ) : (
                "Apply Adjustment"
              )}
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
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(e) => {
                e.preventDefault();
                void submitDelete();
              }}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {deleteSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function mapInventoryRecord(
  record: InventoryRecord,
  forecastMap: Map<number, { usage: number; historical: number; confirmed7D: number }>,
): InventoryItem {
  const itemForecast = forecastMap.get(record.id);
  const dailyUsage = itemForecast?.usage ?? 0;
  const stockAfter7 = Number(record.currentStock || 0) - dailyUsage * 7;
  const status = getStatus(Number(record.currentStock || 0), Number(record.reorderLevel || 0), stockAfter7);

  return {
    id: record.id,
    product: record.itemName,
    type: record.category?.toLowerCase().includes("conditioner") ? "Fabric Conditioner" : "Detergent",
    branch: getCanonicalBranchName(record.branch),
    currentStock: Number(record.currentStock || 0),
    reorderLevel: Number(record.reorderLevel || 0),
    unit: record.unit || "packs",
    category: record.category || "General",
    forecastedUsage: dailyUsage,
    daysUntilEmpty: calcDaysRemaining(Number(record.currentStock || 0), dailyUsage),
    projectedAfter7Days: stockAfter7,
    status,
    historicalDailyUsage: itemForecast?.historical ?? 0,
    confirmedDemand7D: itemForecast?.confirmed7D ?? 0,
  };
}
