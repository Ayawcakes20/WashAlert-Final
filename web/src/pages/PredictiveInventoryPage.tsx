import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Package, AlertTriangle, TrendingDown, TrendingUp, Droplets, Sparkles,
  Plus, Pencil, Trash2, Loader2, MapPin, CalendarClock, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart
} from "recharts";
import { inventoryApi, type InventoryRecord } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getSessionUser } from "@/lib/session";
import { branches as availableBranches } from "@/data/branches";

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
  daysUntilEmpty: number;
  projectedAfter7Days: number;
  status: "Healthy" | "Low Stock" | "Critical";
}

const statusStyle: Record<string, string> = {
  Healthy: "bg-emerald-500/15 text-emerald-600",
  "Low Stock": "bg-amber-500/15 text-amber-600",
  Critical: "bg-destructive/10 text-destructive",
  Sufficient: "bg-emerald-500/15 text-emerald-600",
  "Out of Stock": "bg-destructive/20 text-destructive",
};

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function PredictiveInventoryPage() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMIN";

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [forecastData, setForecastData] = useState<Array<{ branch: string; detergent: number; conditioner: number }>>([]);
  const [consumptionForecast, setConsumptionForecast] = useState<Array<{ day: string; stock: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("All");
  const [branches, setBranches] = useState<string[]>([]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    branch: "", itemName: "", category: "", unit: "", currentStock: "0", reorderLevel: "0",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    branch: "", itemName: "", category: "", unit: "", reorderLevel: "0",
  });

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    quantityDelta: "0", direction: "OUT" as "IN" | "OUT", reason: "",
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadInventory = async () => {
    try {
      setError("");
      const [items, alerts, forecast] = await Promise.all([
        inventoryApi.list(),
        inventoryApi.alerts(),
        inventoryApi.forecast(7),
      ]);

      const lowStockIds = new Set((alerts || []).map((a) => a.id));
      const forecastMap = new Map<number, { usage: number; daysLeft: number }>();
      (forecast || []).forEach((f) => {
        forecastMap.set(f.itemId, {
          usage: Number(f.estimatedDailyUsage || 0),
          daysLeft: Number(f.estimatedDaysUntilStockout || 0),
        });
      });

      const mappedInventory = (items || []).map((i) => mapInventoryRecord(i, lowStockIds, forecastMap));

      // Branch list
      const uniqueBranches = Array.from(new Set(mappedInventory.map((i) => i.branch))).sort();
      setBranches(uniqueBranches);

      // Branch grouped forecast (for bar chart)
      const grouped = new Map<string, { detergent: number; conditioner: number }>();
      mappedInventory.forEach((row) => {
        if (!grouped.has(row.branch)) grouped.set(row.branch, { detergent: 0, conditioner: 0 });
        const cur = grouped.get(row.branch)!;
        if (row.type === "Detergent") cur.detergent += row.forecastedUsage;
        if (row.type === "Fabric Conditioner") cur.conditioner += row.forecastedUsage;
      });

      setInventory(mappedInventory);
      setForecastData(
        Array.from(grouped.entries()).map(([branch, values]) => ({
          branch,
          detergent: Number(values.detergent.toFixed(2)),
          conditioner: Number(values.conditioner.toFixed(2)),
        }))
      );

      // 30-day projected consumption line chart
      const totalDailyUsage = mappedInventory.reduce((sum, i) => sum + i.forecastedUsage, 0);
      const totalStock = mappedInventory.reduce((sum, i) => sum + i.currentStock, 0);
      const forecastLine = Array.from({ length: 30 }, (_, i) => ({
        day: `Day ${i + 1}`,
        stock: Math.max(0, Math.round((totalStock - totalDailyUsage * (i + 1)) * 10) / 10),
      }));
      setConsumptionForecast(forecastLine);
    } catch (err: any) {
      setError(err?.message || "Unable to load inventory data.");
      setInventory([]);
      setForecastData([]);
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await loadInventory();
      setLoading(false);
    };
    void run();
  }, []);

  const criticalCount = useMemo(() => inventory.filter((i) => i.status === "Critical").length, [inventory]);
  const lowStockCount = useMemo(() => inventory.filter((i) => i.status === "Low Stock").length, [inventory]);

  const nextRestockItem = useMemo(() => {
    const items = inventory.filter((i) => i.status !== "Healthy" && i.daysUntilEmpty > 0);
    if (!items.length) return null;
    return items.reduce((min, i) => (i.daysUntilEmpty < min.daysUntilEmpty ? i : min));
  }, [inventory]);

  const branchesWithAlerts = useMemo(() => {
    return new Set(inventory.filter((i) => i.status !== "Healthy").map((i) => i.branch)).size;
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (selectedTab === "All" || !isAdmin) return inventory;
    return inventory.filter((i) => i.branch === selectedTab);
  }, [inventory, selectedTab, isAdmin]);

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
        branch: createForm.branch.trim(), itemName: createForm.itemName.trim(),
        category: createForm.category.trim(), unit: createForm.unit.trim(),
        currentStock: Number(createForm.currentStock || 0),
        reorderLevel: Number(createForm.reorderLevel || 0),
      });
      toast.success("Inventory item created.");
      setCreateOpen(false);
      setCreateForm({ branch: "", itemName: "", category: "", unit: "", currentStock: "0", reorderLevel: "0" });
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
        branch: editForm.branch.trim(), itemName: editForm.itemName.trim(),
        category: editForm.category.trim(), unit: editForm.unit.trim(),
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
    if (!adjustForm.reason.trim()) { toast.error("Adjustment reason is required."); return; }
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
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Predictive Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor stock levels, forecast consumption, and manage inventory across branches</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 px-4 rounded-xl" onClick={() => { setLoading(true); loadInventory().finally(() => setLoading(false)); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="h-10 px-5 rounded-xl gradient-navy" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create Item
          </Button>
        </div>
      </motion.div>

      {/* Alert banner */}
      {(criticalCount > 0 || lowStockCount > 0) && !loading && (
        <motion.div variants={item} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">{criticalCount + lowStockCount} item(s)</span> need restocking across{" "}
            <span className="font-semibold">{branchesWithAlerts} branch(es)</span>
          </p>
        </motion.div>
      )}

      {loading ? <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading inventory...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Items Tracked", value: inventory.length, icon: Package, color: "bg-primary/10 text-primary" },
          { label: "Healthy Stock", value: inventory.filter((i) => i.status === "Healthy").length, icon: TrendingUp, color: "bg-emerald-500/15 text-emerald-600" },
          { label: "Branches With Alerts", value: branchesWithAlerts, icon: MapPin, color: "bg-destructive/10 text-destructive" },
          {
            label: "Next Restock Due",
            value: nextRestockItem ? `~${Math.ceil(nextRestockItem.daysUntilEmpty)}d` : "OK",
            icon: CalendarClock,
            color: nextRestockItem ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600",
          },
        ].map((s) => (
          <motion.div key={s.label} variants={item} className="glass-card rounded-2xl p-5">
            <div className={`p-2.5 rounded-xl ${s.color} w-fit mb-3`}>
              <s.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Branch filter tabs (admin only) */}
      {isAdmin && branches.length > 0 && (
        <motion.div variants={item} className="flex flex-wrap gap-2">
          {["All", ...branches].map((b) => (
            <button
              key={b}
              onClick={() => setSelectedTab(b)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedTab === b
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-foreground border border-border hover:bg-muted"
              }`}
            >
              {b}
            </button>
          ))}
        </motion.div>
      )}

      {/* 7-day forecast table */}
      <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <h2 className="text-lg font-semibold text-foreground">7-Day Inventory Forecast</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Projected usage and stock levels based on historical movement data</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                {["Item", "Category", "Current Stock", "Unit", "Proj. Use 7d", "After 7d", "Reorder Level", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left p-4 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((inv) => {
                const after7 = inv.currentStock - inv.forecastedUsage * 7;
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
                    <td className="p-4 font-medium text-foreground">{inv.currentStock}</td>
                    <td className="p-4 text-muted-foreground">{inv.unit}</td>
                    <td className="p-4 text-muted-foreground">{(inv.forecastedUsage * 7).toFixed(1)}</td>
                    <td className={`p-4 font-medium ${after7 < 0 ? "text-destructive" : "text-foreground"}`}>{after7.toFixed(1)}</td>
                    <td className="p-4 text-muted-foreground">{inv.reorderLevel}</td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle[inv.status]}`}>{inv.status}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openAdjust(inv)} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">Update</button>
                        <span className="text-border">·</span>
                        <button onClick={() => openEdit(inv)} className="text-xs font-medium text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => openDelete(inv)} className="text-xs font-medium text-destructive hover:text-destructive/80"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredInventory.length && !loading && (
                <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">No inventory items found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 30-day consumption forecast line chart */}
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Consumption Forecast (30 Days)</h2>
          <p className="text-xs text-muted-foreground mb-4">Projected total stock across all items based on average daily usage</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={consumptionForecast}>
              <defs>
                <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(218, 58%, 20%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(218, 58%, 20%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(215, 16%, 47%)" }} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} />
              <Tooltip formatter={(v: number) => [`${v} units`, "Projected Stock"]} />
              <Area type="monotone" dataKey="stock" stroke="hsl(218, 58%, 20%)" strokeWidth={2} fill="url(#stockGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Daily consumption per branch bar chart */}
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">Daily Consumption Forecast (per branch)</h2>
          <p className="text-xs text-muted-foreground mb-4">Estimated daily usage of detergent and fabric conditioner per branch</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={forecastData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} />
              <YAxis dataKey="branch" type="category" tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} width={100} />
              <Tooltip />
              <Bar dataKey="detergent" name="Detergent (kg/L)" fill="hsl(218, 58%, 20%)" radius={[0, 6, 6, 0]} />
              <Bar dataKey="conditioner" name="Conditioner (L)" fill="hsl(168, 55%, 68%)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Stock level progress view */}
      {filteredInventory.filter((i) => i.status !== "Healthy").length > 0 && (
        <motion.div variants={item} className="glass-card rounded-2xl p-6 border-l-4 border-destructive">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Stock Alerts
          </h2>
          <div className="space-y-3">
            {filteredInventory.filter((i) => i.status !== "Healthy").map((inv) => (
              <div key={inv.id} className={`flex items-center justify-between p-3 rounded-xl ${inv.status === "Critical" ? "bg-destructive/5" : "bg-amber-500/5"}`}>
                <div className="flex items-center gap-3">
                  {inv.type === "Detergent" ? <Droplets className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-secondary" />}
                  <div>
                    <span className="text-sm font-medium text-foreground">{inv.product}</span>
                    <span className="text-xs text-muted-foreground ml-2">- {inv.branch}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted w-32">
                        <div
                          className={`h-1.5 rounded-full transition-all ${inv.status === "Critical" ? "bg-destructive" : "bg-amber-500"}`}
                          style={{ width: `${Math.min(100, (inv.currentStock / (inv.maxStock || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{inv.currentStock}/{inv.maxStock} {inv.unit}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${statusStyle[inv.status]}`}>{inv.status}</span>
                  <p className="text-[10px] text-muted-foreground">~{inv.daysUntilEmpty > 0 ? inv.daysUntilEmpty.toFixed(1) : "N/A"} day(s) left</p>
                  <button onClick={() => openAdjust(inv)} className="text-[10px] font-semibold text-primary hover:underline">Restock</button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Inventory Item</DialogTitle>
            <DialogDescription>Add a new inventory item to track.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-branch">Branch</Label>
              <select 
                id="create-branch" 
                value={createForm.branch} 
                onChange={(e) => setCreateForm((p) => ({ ...p, branch: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a branch</option>
                {availableBranches.map(b => (
                  <option key={b.id} value={b.area}>{b.area}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="create-item">Item Name</Label><Input id="create-item" value={createForm.itemName} onChange={(e) => setCreateForm((p) => ({ ...p, itemName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="create-category">Category</Label><Input id="create-category" value={createForm.category} onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="create-unit">Unit</Label><Input id="create-unit" value={createForm.unit} onChange={(e) => setCreateForm((p) => ({ ...p, unit: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="create-current-stock">Current Stock</Label><Input id="create-current-stock" type="number" min="0" step="0.01" value={createForm.currentStock} onChange={(e) => setCreateForm((p) => ({ ...p, currentStock: e.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="create-reorder">Reorder Level</Label><Input id="create-reorder" type="number" min="0" step="0.01" value={createForm.reorderLevel} onChange={(e) => setCreateForm((p) => ({ ...p, reorderLevel: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>Cancel</Button>
            <Button onClick={() => void submitCreate()} disabled={createSubmitting}>
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {createSubmitting ? "Creating..." : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>Update item details and reorder threshold.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-branch">Branch</Label>
              <select 
                id="edit-branch" 
                value={editForm.branch} 
                onChange={(e) => setEditForm((p) => ({ ...p, branch: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a branch</option>
                {availableBranches.map(b => (
                  <option key={b.id} value={b.area}>{b.area}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2"><Label htmlFor="edit-item">Item Name</Label><Input id="edit-item" value={editForm.itemName} onChange={(e) => setEditForm((p) => ({ ...p, itemName: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="edit-category">Category</Label><Input id="edit-category" value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="edit-unit">Unit</Label><Input id="edit-unit" value={editForm.unit} onChange={(e) => setEditForm((p) => ({ ...p, unit: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="edit-reorder">Reorder Level</Label><Input id="edit-reorder" type="number" min="0" step="0.01" value={editForm.reorderLevel} onChange={(e) => setEditForm((p) => ({ ...p, reorderLevel: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSubmitting}>Cancel</Button>
            <Button onClick={() => void submitEdit()} disabled={editSubmitting}>
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {editSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>Apply stock in/out adjustment for {selectedItem?.product}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="adjust-qty">Quantity</Label>
                <Input id="adjust-qty" type="number" min="0.01" step="0.01" value={adjustForm.quantityDelta} onChange={(e) => setAdjustForm((p) => ({ ...p, quantityDelta: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-direction">Direction</Label>
                <select id="adjust-direction" value={adjustForm.direction} onChange={(e) => setAdjustForm((p) => ({ ...p, direction: e.target.value as "IN" | "OUT" }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="IN">IN (Restock)</option>
                  <option value="OUT">OUT (Usage)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Reason</Label>
              <Input id="adjust-reason" placeholder="e.g. Weekly restock, Manual usage" value={adjustForm.reason} onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjustSubmitting}>Cancel</Button>
            <Button onClick={() => void submitAdjust()} disabled={adjustSubmitting}>
              {adjustSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {adjustSubmitting ? "Applying..." : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inventory item?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove {selectedItem?.product || "this item"} and its stock movement history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(e) => { e.preventDefault(); void submitDelete(); }}
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

function mapInventoryRecord(
  i: InventoryRecord,
  lowStockIds: Set<number>,
  forecastMap: Map<number, { usage: number; daysLeft: number }>,
): InventoryItem {
  const itemForecast = forecastMap.get(i.id);
  const ratio = i.reorderLevel > 0 ? i.currentStock / i.reorderLevel : 2;
  const isLow = i.lowStock || lowStockIds.has(i.id);
  const status: "Healthy" | "Low Stock" | "Critical" =
    isLow && ratio < 0.6 ? "Critical" : isLow ? "Low Stock" : "Healthy";

  const dailyUsage = itemForecast?.usage || 0;

  return {
    id: i.id,
    product: i.itemName,
    type: i.category?.toLowerCase().includes("conditioner") ? "Fabric Conditioner" : "Detergent",
    branch: i.branch,
    currentStock: Number(i.currentStock || 0),
    maxStock: Number(i.reorderLevel || 0) * 2 || 100,
    reorderLevel: Number(i.reorderLevel || 0),
    unit: i.unit || "kg",
    category: i.category || "General",
    forecastedUsage: dailyUsage,
    daysUntilEmpty: itemForecast?.daysLeft || 0,
    projectedAfter7Days: Number(i.currentStock || 0) - dailyUsage * 7,
    status,
  };
}
