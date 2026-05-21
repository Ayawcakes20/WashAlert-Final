import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Boxes, Plus, Trash2, Loader2, MapPin, Tag, Wrench,
  CheckCircle2, AlertCircle, XCircle, RefreshCw, ClipboardList,
  Search,
} from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getSessionUser } from "@/lib/session";

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetCondition = "Working" | "For Repair" | "Broken";

interface BranchAsset {
  id: string;
  name: string;
  category: string;
  condition: AssetCondition;
  quantity: number;
  branch: string;
  notes: string;
  addedAt: string; // ISO date string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ASSET_CATEGORIES = [
  "Appliance",
  "Furniture",
  "Equipment",
  "Electronics",
  "Other",
] as const;



const CONDITIONS: AssetCondition[] = ["Working", "For Repair", "Broken"];

const conditionStyle: Record<AssetCondition, { badge: string; icon: typeof CheckCircle2 }> = {
  Working:    { badge: "bg-emerald-500/15 text-emerald-600",   icon: CheckCircle2 },
  "For Repair": { badge: "bg-amber-500/15 text-amber-600",     icon: AlertCircle },
  Broken:     { badge: "bg-destructive/10 text-destructive",   icon: XCircle },
};

const categoryColors: Record<string, string> = {
  Appliance:   "bg-blue-500/10 text-blue-600",
  Furniture:   "bg-violet-500/10 text-violet-600",
  Equipment:   "bg-teal-500/10 text-teal-600",
  Electronics: "bg-orange-500/10 text-orange-600",
  Other:       "bg-muted text-muted-foreground",
};

const STORAGE_KEY = "washalert_branch_assets";

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadAssets(): BranchAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BranchAsset[]) : [];
  } catch {
    return [];
  }
}

function saveAssets(assets: BranchAsset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

// ─── Component ────────────────────────────────────────────────────────────────

export default function BranchAssetsPage() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMIN";
  const userBranch = user?.branch || "";

  const [assets, setAssets] = useState<BranchAsset[]>(loadAssets);
  const [selectedTab, setSelectedTab] = useState("All");
  const [search, setSearch] = useState("");

  // ── Add dialog ──
  const [addOpen, setAddOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", category: "", condition: "Working" as AssetCondition,
    quantity: "1", branch: isAdmin ? "" : userBranch, notes: "",
  });


  // ── Remove dialog ──
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<BranchAsset | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const branches = useMemo(() => {
    const all = isAdmin
      ? Array.from(new Set(assets.map((a) => a.branch))).sort()
      : [userBranch];
    return all.filter(Boolean);
  }, [assets, isAdmin, userBranch]);

  const filteredAssets = useMemo(() => {
    let list = assets;

    // Branch scope
    if (!isAdmin) {
      list = list.filter((a) => a.branch === userBranch);
    } else if (selectedTab !== "All") {
      list = list.filter((a) => a.branch === selectedTab);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.condition.toLowerCase().includes(q) ||
          a.notes.toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }, [assets, isAdmin, userBranch, selectedTab, search]);

  const stats = useMemo(() => ({
    total: filteredAssets.reduce((sum, a) => sum + a.quantity, 0),
    working: filteredAssets.filter((a) => a.condition === "Working").reduce((s, a) => s + a.quantity, 0),
    forRepair: filteredAssets.filter((a) => a.condition === "For Repair").reduce((s, a) => s + a.quantity, 0),
    broken: filteredAssets.filter((a) => a.condition === "Broken").reduce((s, a) => s + a.quantity, 0),
  }), [filteredAssets]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const openAdd = () => {
    setAddForm({
      name: "", category: "", condition: "Working",
      quantity: "1", branch: isAdmin ? "" : userBranch, notes: "",
    });
    setAddOpen(true);
  };

  const submitAdd = async () => {
    if (!addForm.name.trim()) { toast.error("Asset name is required."); return; }
    if (!addForm.category.trim()) { toast.error("Category is required."); return; }
    if (!addForm.branch.trim()) { toast.error("Branch is required."); return; }
    const qty = Number(addForm.quantity);
    if (!qty || qty < 1) { toast.error("Quantity must be at least 1."); return; }

    setAddSubmitting(true);
    await new Promise((r) => setTimeout(r, 300)); // small UX delay

    const newAsset: BranchAsset = {
      id: generateId(),
      name: addForm.name.trim(),
      category: addForm.category.trim(),
      condition: addForm.condition,
      quantity: qty,
      branch: addForm.branch.trim(),
      notes: addForm.notes.trim(),
      addedAt: new Date().toISOString(),
    };

    const updated = [...assets, newAsset];
    saveAssets(updated);
    setAssets(updated);
    toast.success(`"${newAsset.name}" added to ${newAsset.branch}.`);
    setAddOpen(false);
    setAddSubmitting(false);
  };

  const openRemove = (asset: BranchAsset) => {
    setRemoveTarget(asset);
    setRemoveOpen(true);
  };

  const submitRemove = async () => {
    if (!removeTarget) return;
    setRemoveSubmitting(true);
    await new Promise((r) => setTimeout(r, 300));

    const updated = assets.filter((a) => a.id !== removeTarget.id);
    saveAssets(updated);
    setAssets(updated);
    toast.success(`"${removeTarget.name}" removed.`);
    setRemoveOpen(false);
    setRemoveSubmitting(false);
  };

  const handleRefresh = () => {
    setAssets(loadAssets());
    toast.success("Inventory refreshed.");
  };



  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div initial="hidden" animate="show" variants={container} className="space-y-8">

      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track physical equipment and furniture per branch — electric fans, aircons, chairs, and more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 px-4 rounded-xl" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button className="h-10 px-5 rounded-xl gradient-navy" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Items",   value: stats.total,     icon: Boxes,          color: "bg-primary/10 text-primary" },
          { label: "Working",       value: stats.working,   icon: CheckCircle2,   color: "bg-emerald-500/15 text-emerald-600" },
          { label: "For Repair",    value: stats.forRepair, icon: AlertCircle,    color: "bg-amber-500/15 text-amber-600" },
          { label: "Broken",        value: stats.broken,    icon: XCircle,        color: "bg-destructive/10 text-destructive" },
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

      {/* Branch filter tabs (admin only) + Search */}
      <motion.div variants={item} className="flex flex-col sm:flex-row gap-3 sm:items-center">
        {isAdmin && branches.length > 0 && (
          <div className="flex flex-wrap gap-2">
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
          </div>
        )}
        <div className="relative sm:ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="assets-search"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl"
          />
        </div>
      </motion.div>

      {/* Assets table */}
      <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/30 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Inventory Register
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              All physical assets tracked for{" "}
              {isAdmin
                ? selectedTab === "All"
                  ? "all branches"
                  : selectedTab
                : userBranch || "your branch"}
            </p>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium">
            {filteredAssets.length} item{filteredAssets.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                {["Asset Name", "Category", "Condition", "Qty", "Branch", "Notes", "Added", "Action"].map((h) => (
                  <th key={h} className="text-left p-4 font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => {
                const cond = conditionStyle[asset.condition];
                const CondIcon = cond.icon;
                return (
                  <tr key={asset.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-medium text-foreground">{asset.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColors[asset.category] ?? categoryColors["Other"]}`}>
                        {asset.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cond.badge}`}>
                        <CondIcon className="h-3 w-3" />
                        {asset.condition}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-foreground">{asset.quantity}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {asset.branch}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground max-w-[180px]">
                      <span className="truncate block" title={asset.notes}>
                        {asset.notes || <span className="text-border">—</span>}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(asset.addedAt).toLocaleDateString("en-PH", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => openRemove(asset)}
                        title="Remove asset"
                        className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Boxes className="h-10 w-10 opacity-20" />
                      <p className="text-sm font-medium">No items found</p>
                      <p className="text-xs">
                        {search ? "Try a different search term." : "Click \"Add Item\" to register the first item."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Quick legend */}
      {filteredAssets.length > 0 && (
        <motion.div variants={item} className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium">Condition:</span>
          {CONDITIONS.map((c) => {
            const s = conditionStyle[c];
            const Icon = s.icon;
            return (
              <span key={c} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${s.badge}`}>
                <Icon className="h-3 w-3" /> {c}
              </span>
            );
          })}
        </motion.div>
      )}

      {/* ── Add Asset Dialog ────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" /> Add Inventory Item
            </DialogTitle>
            <DialogDescription>
              Register a new item for the branch inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">

            {/* Branch */}
            {isAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="add-branch">Branch</Label>
                <Input
                  id="add-branch"
                  placeholder="e.g. Main Branch, Branch 2"
                  value={addForm.branch}
                  onChange={(e) => setAddForm((p) => ({ ...p, branch: e.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input value={userBranch} readOnly className="bg-muted text-muted-foreground" />
              </div>
            )}

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="add-category">Category</Label>
              <Select
                value={addForm.category}
                onValueChange={(val) =>
                  setAddForm((p) => ({ ...p, category: val, name: "" }))
                }
              >
                <SelectTrigger id="add-category" className="w-full text-foreground">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Name */}
            <div className="space-y-2">
              <Label htmlFor="add-name">Item Name</Label>
              <Input
                id="add-name"
                placeholder="e.g. Electric Fan, Aircon, Chair, Table..."
                value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            {/* Condition + Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-condition">Condition</Label>
                <Select
                  value={addForm.condition}
                  onValueChange={(val) => setAddForm((p) => ({ ...p, condition: val as AssetCondition }))}
                >
                  <SelectTrigger id="add-condition" className="w-full text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-quantity">Quantity</Label>
                <Input
                  id="add-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={addForm.quantity}
                  onChange={(e) => setAddForm((p) => ({ ...p, quantity: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="add-notes">Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="add-notes"
                placeholder="e.g. Located in washing area, serial no. ABC123"
                value={addForm.notes}
                onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSubmitting}>Cancel</Button>
            <Button onClick={() => void submitAdd()} disabled={addSubmitting} className="gradient-navy">
              {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {addSubmitting ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove Confirm Dialog ───────────────────────────────────────────── */}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Remove Item?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold text-foreground">
                {removeTarget?.quantity}× {removeTarget?.name}
              </span>{" "}
              from{" "}
              <span className="font-semibold text-foreground">{removeTarget?.branch}</span>.
              {removeTarget?.condition === "Broken" && (
                <span className="block mt-2 text-destructive text-xs font-medium">
                  ⚠ This asset was marked as Broken.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(e) => { e.preventDefault(); void submitRemove(); }}
              disabled={removeSubmitting}
            >
              {removeSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {removeSubmitting ? "Removing..." : "Yes, Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
