import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Package, AlertTriangle, TrendingDown, TrendingUp, Droplets, Sparkles, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { inventoryApi, type InventoryRecord } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  status: "Healthy" | "Low Stock" | "Critical";
}

const statusStyle: Record<string, string> = {
  Healthy: "bg-mint/15 text-mint-foreground",
  "Low Stock": "bg-accent/15 text-accent-foreground",
  Critical: "bg-destructive/10 text-destructive",
};

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function PredictiveInventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [forecastData, setForecastData] = useState<Array<{ branch: string; detergent: number; conditioner: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const [items, alerts, forecast] = await Promise.all([inventoryApi.list(), inventoryApi.alerts(), inventoryApi.forecast(7)]);

      const lowStockIds = new Set((alerts || []).map((a) => a.id));
      const forecastMap = new Map<number, { usage: number; daysLeft: number }>();
      (forecast || []).forEach((f) => {
        forecastMap.set(f.itemId, {
          usage: Number(f.estimatedDailyUsage || 0),
          daysLeft: Number(f.estimatedDaysUntilStockout || 0),
        });
      });

      const mappedInventory = (items || []).map((i) => mapInventoryRecord(i, lowStockIds, forecastMap));

      const grouped = new Map<string, { detergent: number; conditioner: number }>();
      mappedInventory.forEach((row) => {
        if (!grouped.has(row.branch)) {
          grouped.set(row.branch, { detergent: 0, conditioner: 0 });
        }
        const current = grouped.get(row.branch)!;
        if (row.type === "Detergent") current.detergent += row.forecastedUsage;
        if (row.type === "Fabric Conditioner") current.conditioner += row.forecastedUsage;
      });

      setInventory(mappedInventory);
      setForecastData(
        Array.from(grouped.entries()).map(([branch, values]) => ({
          branch,
          detergent: Number(values.detergent.toFixed(2)),
          conditioner: Number(values.conditioner.toFixed(2)),
        })),
      );
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
        branch: createForm.branch.trim(),
        itemName: createForm.itemName.trim(),
        category: createForm.category.trim(),
        unit: createForm.unit.trim(),
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
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Predictive Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor stock levels, forecast consumption, and manage inventory</p>
        </div>
        <Button className="h-10 px-5 rounded-xl gradient-navy" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Item
        </Button>
      </motion.div>

      {loading ? <p className="text-sm text-muted-foreground">Loading inventory...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Items Tracked", value: inventory.length, icon: Package, color: "bg-primary/10 text-primary" },
          { label: "Healthy Stock", value: inventory.filter((i) => i.status === "Healthy").length, icon: TrendingUp, color: "bg-mint/15 text-mint" },
          { label: "Low Stock Alerts", value: lowStockCount, icon: TrendingDown, color: "bg-accent/15 text-accent" },
          { label: "Critical Alerts", value: criticalCount, icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
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

      {(criticalCount > 0 || lowStockCount > 0) && (
        <motion.div variants={item} className="glass-card rounded-2xl p-6 border-l-4 border-destructive">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" /> Stock Alerts
          </h2>
          <div className="space-y-2">
            {inventory
              .filter((i) => i.status !== "Healthy")
              .map((i) => (
                <div key={i.id} className={`flex items-center justify-between p-3 rounded-xl ${i.status === "Critical" ? "bg-destructive/5" : "bg-accent/5"}`}>
                  <div className="flex items-center gap-3">
                    {i.type === "Detergent" ? <Droplets className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-secondary" />}
                    <div>
                      <span className="text-sm font-medium text-foreground">{i.product}</span>
                      <span className="text-xs text-muted-foreground ml-2">- {i.branch}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${statusStyle[i.status]}`}>{i.status}</span>
                    <p className="text-[10px] text-muted-foreground mt-1">~{i.daysUntilEmpty ? i.daysUntilEmpty.toFixed(1) : "N/A"} day(s) left</p>
                  </div>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Stock Levels</h2>
          <div className="space-y-3">
            {inventory.map((i) => (
              <div key={i.id} className="rounded-xl border border-border/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {i.type === "Detergent" ? <Droplets className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-secondary" />}
                    <span className="text-sm font-medium text-foreground">{i.product}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${statusStyle[i.status]}`}>{i.status}</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-2 rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full transition-all ${i.status === "Critical" ? "bg-destructive" : i.status === "Low Stock" ? "bg-accent" : "bg-mint"}`}
                      style={{ width: `${Math.min(100, (i.currentStock / (i.maxStock || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-24 text-right">
                    {i.currentStock}/{i.maxStock} {i.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{i.branch}</span>
                  <span>Usage: {i.forecastedUsage} {i.unit}/day</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => openAdjust(i)}>
                    Adjust Stock
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => openEdit(i)}>
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" onClick={() => openDelete(i)}>
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {!inventory.length ? <p className="text-sm text-muted-foreground">No inventory items found.</p> : null}
          </div>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Daily Consumption Forecast (per branch)</h2>
          <ResponsiveContainer width="100%" height={400}>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Inventory Item</DialogTitle>
            <DialogDescription>Add a new inventory item to track.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-branch">Branch</Label>
              <Input id="create-branch" value={createForm.branch} onChange={(e) => setCreateForm((p) => ({ ...p, branch: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-item">Item Name</Label>
              <Input id="create-item" value={createForm.itemName} onChange={(e) => setCreateForm((p) => ({ ...p, itemName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-category">Category</Label>
              <Input id="create-category" value={createForm.category} onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-unit">Unit</Label>
              <Input id="create-unit" value={createForm.unit} onChange={(e) => setCreateForm((p) => ({ ...p, unit: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="create-current-stock">Current Stock</Label>
                <Input id="create-current-stock" type="number" min="0" step="0.01" value={createForm.currentStock} onChange={(e) => setCreateForm((p) => ({ ...p, currentStock: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-reorder">Reorder Level</Label>
                <Input id="create-reorder" type="number" min="0" step="0.01" value={createForm.reorderLevel} onChange={(e) => setCreateForm((p) => ({ ...p, reorderLevel: e.target.value }))} />
              </div>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>Update item details and reorder threshold.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-branch">Branch</Label>
              <Input id="edit-branch" value={editForm.branch} onChange={(e) => setEditForm((p) => ({ ...p, branch: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-item">Item Name</Label>
              <Input id="edit-item" value={editForm.itemName} onChange={(e) => setEditForm((p) => ({ ...p, itemName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Input id="edit-category" value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-unit">Unit</Label>
              <Input id="edit-unit" value={editForm.unit} onChange={(e) => setEditForm((p) => ({ ...p, unit: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reorder">Reorder Level</Label>
              <Input id="edit-reorder" type="number" min="0" step="0.01" value={editForm.reorderLevel} onChange={(e) => setEditForm((p) => ({ ...p, reorderLevel: e.target.value }))} />
            </div>
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
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Reason</Label>
              <Input id="adjust-reason" value={adjustForm.reason} onChange={(e) => setAdjustForm((p) => ({ ...p, reason: e.target.value }))} />
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
  const status: "Healthy" | "Low Stock" | "Critical" = isLow && ratio < 0.6 ? "Critical" : isLow ? "Low Stock" : "Healthy";

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
    forecastedUsage: itemForecast?.usage || 0,
    daysUntilEmpty: itemForecast?.daysLeft || 0,
    status,
  };
}
