import { motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import {
  Boxes, Plus, Trash2, Loader2, MapPin,
  CheckCircle2, AlertCircle, XCircle, RefreshCw, ClipboardList,
  Search, Pencil, Eye, ChevronLeft, ChevronRight, Calendar, Wrench,
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
import { inventoryApi, type InventoryRecord } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetCondition = "Working" | "For Repair" | "Broken";

interface BranchAsset {
  id: string;
  productId: string;
  name: string;
  category: string;
  condition: AssetCondition;
  quantity: number;
  branch: string;
  notes: string;
  addedAt: string;
  unit?: string;
  purchaseDate?: string;
  lastInspected?: string;
  brand?: string;
  purchasePrice?: number;
}

interface FormState {
  productId: string;
  name: string;
  category: string;
  condition: AssetCondition;
  quantity: string;
  branch: string;
  notes: string;
  unit: string;
  purchaseDate: string;
  lastInspected: string;
  brand: string;
  purchasePrice: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ASSET_CATEGORIES = [
  "Appliance",
  "Furniture",
  "Equipment",
  "Electronics",
  "Other",
] as const;

const CATEGORY_ITEMS_MAP: Record<string, string[]> = {
  Appliance: [
    "Washing Machine",
    "Dryer",
    "Air Conditioner",
    "Refrigerator",
    "Electric Fan",
    "Television",
    "Water Dispenser",
    "Microwave",
  ],
  Furniture: [
    "Folding Table",
    "Plastic Chair",
    "Metal Rack",
    "Sofa / Couch",
    "Laundry Basket Cart",
    "Office Chair",
    "Stool",
    "Cabinet",
  ],
  Equipment: [
    "Water Pump",
    "Water Tank",
    "Steam Iron",
    "Dry Vacuum Cleaner",
    "Weighing Scale",
    "CCTV Camera System",
    "POS Terminal",
    "Pressure Washer",
    "Generator",
  ],
  Electronics: [
    "Tablet (POS)",
    "Smart Phone",
    "WiFi Router",
    "Smart TV",
    "Barcode Scanner",
    "Thermal Printer",
    "Bluetooth Speaker",
  ],
  Other: [
    "Fire Extinguisher",
    "First Aid Kit",
    "Cleaning Cart",
    "Step Ladder",
  ],
};

const CATEGORY_BRANDS_MAP: Record<string, string[]> = {
  Appliance: [
    "Samsung",
    "LG",
    "Panasonic",
    "Sharp",
    "Toshiba",
    "Fujidenzo",
    "Carrier",
    "Midea",
    "Condura",
    "Standard",
    "LG Giant C",
    "Whirlpool",
    "Maytag",
    "Speed Queen",
  ],
  Furniture: [
    "Uratex",
    "Orocan",
    "San-Yang",
    "IKEA",
    "Mandaue Foam",
    "Generic",
  ],
  Equipment: [
    "Matrix",
    "Karcher",
    "Standard",
    "Hikvision",
    "Xiaomi",
    "Imarflex",
    "Asahi",
    "Yamaha",
    "Seco",
  ],
  Electronics: [
    "Apple",
    "Samsung",
    "Xiaomi",
    "TP-Link",
    "Epson",
    "Sunmi",
    "Realme",
  ],
  Other: [
    "First Alert",
    "Falcon",
    "Generic",
  ],
};

const KNOWN_BRANCHES = [
  "Makati Branch",
  "Chestnut Branch",
  "Republic Branch",
  "Holy Spirit Branch",
  "Sta. Catalina Branch",
  "Brookside Branch",
  "JP Rizal Branch",
  "Luzon Branch",
  "St. Anthony Branch",
  "UP Diliman / San Vicente Branch"
];

const CONDITIONS: AssetCondition[] = ["Working", "For Repair", "Broken"];

const TABLE_PAGE_SIZE = 10;

const conditionStyle: Record<AssetCondition, { badge: string; icon: typeof CheckCircle2 }> = {
  Working:      { badge: "bg-emerald-500/15 text-emerald-600",  icon: CheckCircle2 },
  "For Repair": { badge: "bg-amber-500/15 text-amber-600",      icon: AlertCircle },
  Broken:       { badge: "bg-destructive/10 text-destructive",  icon: XCircle },
};

const categoryColors: Record<string, string> = {
  Appliance:   "bg-blue-500/10 text-blue-600",
  Furniture:   "bg-violet-500/10 text-violet-600",
  Equipment:   "bg-teal-500/10 text-teal-600",
  Electronics: "bg-orange-500/10 text-orange-600",
  Other:       "bg-muted text-muted-foreground",
};

const STORAGE_KEY = "washalert_branch_assets";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BRANCH_NORM_MAP: Record<string, string> = {
  "jp rizal": "JP Rizal Branch",
  "jp rizal branch": "JP Rizal Branch",
  "speedywash - jp rizal": "JP Rizal Branch",
  "triplets - makati": "Makati Branch",
  "triplets laundryhubs - makati": "Makati Branch",
  "makati": "Makati Branch",
  "makati branch": "Makati Branch",
  "speedywash - chestnut": "Chestnut Branch",
  "chestnut branch": "Chestnut Branch",
  "speedywash - republic": "Republic Branch",
  "republic branch": "Republic Branch",
  "speedywash - t.o.n": "Holy Spirit Branch",
  "holy spirit branch": "Holy Spirit Branch",
  "speedywash - s. catalina": "Sta. Catalina Branch",
  "sta. catalina branch": "Sta. Catalina Branch",
  "speedywash - pasig": "Brookside Branch",
  "brookside branch": "Brookside Branch",
  "speedywash - up diliman": "UP Diliman / San Vicente Branch",
  "up diliman / san vicente branch": "UP Diliman / San Vicente Branch",
  "luzon branch": "Luzon Branch",
  "st. anthony branch": "St. Anthony Branch"
};

function loadAssets(): BranchAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BranchAsset[];
    let migrated = false;
    const mapped = parsed.map(asset => {
      const bLower = asset.branch ? asset.branch.trim().toLowerCase() : "";
      const canonical = BRANCH_NORM_MAP[bLower];
      if (canonical && asset.branch !== canonical) {
        migrated = true;
        return { ...asset, branch: canonical };
      }
      return asset;
    });
    if (migrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
    }
    return mapped;
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

function getAssetAbbreviation(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return "AST";

  // Specific overrides
  if (trimmed === "aircon" || trimmed === "air conditioner") return "AC";
  if (trimmed === "television" || trimmed === "tv") return "TV";

  // Split by spaces, hyphens, or underscores
  const words = trimmed.split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return "AST";

  if (words.length > 1) {
    return words.map(w => w[0].toUpperCase()).join("");
  } else {
    const word = words[0];
    if (word.length >= 2) {
      return word.slice(0, 2).toUpperCase();
    }
    return word.toUpperCase() + "X";
  }
}

function generateNextProductId(assets: BranchAsset[], name: string): string {
  const prefix = getAssetAbbreviation(name);
  let maxNum = 1000;
  
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  for (const asset of assets) {
    if (asset.productId) {
      const match = asset.productId.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
  }
  return `${prefix}-${maxNum + 1}`;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Paginator ───────────────────────────────────────────────────────────────

function Paginator({
  page, totalPages, onPrev, onNext,
}: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border/30">
      <Button
        variant="outline" size="sm"
        onClick={onPrev} disabled={page <= 1}
        className="h-8 px-3 rounded-lg text-xs flex items-center gap-1"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Previous
      </Button>
      <span className="text-xs text-muted-foreground px-1">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline" size="sm"
        onClick={onNext} disabled={page >= totalPages}
        className="h-8 px-3 rounded-lg text-xs flex items-center gap-1"
      >
        Next <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Animation variants ───────────────────────────────────────────────────────

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const anim = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

// ─── Blank form helpers ───────────────────────────────────────────────────────

const blankAdd = (isAdmin: boolean, userBranch: string, defaultProductId: string): FormState => ({
  productId: defaultProductId,
  name: "", category: "", condition: "Working" as AssetCondition,
  quantity: "1", branch: isAdmin ? "" : userBranch,
  notes: "", unit: "units", purchaseDate: "", lastInspected: "",
  brand: "", purchasePrice: "",
});

const assetToEditForm = (a: BranchAsset): FormState => ({
  productId: a.productId || "",
  name: a.name, category: a.category, condition: a.condition,
  quantity: String(a.quantity), branch: a.branch,
  notes: a.notes, unit: a.unit ?? "units",
  purchaseDate: a.purchaseDate ?? "", lastInspected: "",
  brand: a.brand || "",
  purchasePrice: a.purchasePrice !== undefined && a.purchasePrice !== null ? String(a.purchasePrice) : "",
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function BranchAssetsPage() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "STAFF";
  const rawUserBranch = user?.branch || "";
  const userBranch = BRANCH_NORM_MAP[rawUserBranch.trim().toLowerCase()] || rawUserBranch;

  const [assets, setAssets] = useState<BranchAsset[]>(loadAssets);
  const [selectedTab, setSelectedTab] = useState("All");
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<AssetCondition | "All">("All");
  const [tablePage, setTablePage] = useState(1);

  // ── Equipment Register (API-based, with maintenance tracking) ──
  const [equipmentItems, setEquipmentItems] = useState<InventoryRecord[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [markServicedId, setMarkServicedId] = useState<number | null>(null);
  const [markServicedLoading, setMarkServicedLoading] = useState(false);

  // ── Add dialog ──
  const [addOpen, setAddOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(() => blankAdd(isAdmin, userBranch, ""));

  // ── Edit dialog ──
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BranchAsset | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState<FormState>(() => blankAdd(isAdmin, userBranch));

  // ── View Details dialog ──
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<BranchAsset | null>(null);

  // ── Remove dialog ──
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<BranchAsset | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const branches = useMemo(() => {
    const all = isAdmin
      ? Array.from(new Set([...KNOWN_BRANCHES, ...assets.map((a) => a.branch)])).sort()
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

    // Condition filter
    if (conditionFilter !== "All") {
      list = list.filter((a) => a.condition === conditionFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.productId && a.productId.toLowerCase().includes(q)) ||
          a.category.toLowerCase().includes(q) ||
          a.condition.toLowerCase().includes(q) ||
          a.notes.toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }, [assets, isAdmin, userBranch, selectedTab, conditionFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / TABLE_PAGE_SIZE));
  const pagedAssets = filteredAssets.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);

  const stats = useMemo(() => ({
    total:    filteredAssets.reduce((sum, a) => sum + a.quantity, 0),
    working:  filteredAssets.filter((a) => a.condition === "Working").reduce((s, a) => s + a.quantity, 0),
    forRepair: filteredAssets.filter((a) => a.condition === "For Repair").reduce((s, a) => s + a.quantity, 0),
    broken:   filteredAssets.filter((a) => a.condition === "Broken").reduce((s, a) => s + a.quantity, 0),
  }), [filteredAssets]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const resetPage = () => setTablePage(1);

  const handleTabChange = (tab: string) => { setSelectedTab(tab); resetPage(); };
  const handleConditionChange = (val: string) => { setConditionFilter(val as AssetCondition | "All"); resetPage(); };
  const handleSearch = (val: string) => { setSearch(val); resetPage(); };

  // Add
  const openAdd = () => {
    const nextId = generateNextProductId(assets, "");
    setAddForm(blankAdd(isAdmin, userBranch, nextId));
    setAddOpen(true);
  };

  // ── Equipment Register helpers ───────────────────────────────────────────

  const loadEquipment = async () => {
    try {
      setEquipmentLoading(true);
      const items = await inventoryApi.list();
      // Only show asset-type items (equipment)
      const assetOnly = (items || []).filter((i) => i.assetType === "Asset");
      // Filter to user's branch for staff
      const filtered = isStaff
        ? assetOnly.filter((i) => (i.branch || "").toLowerCase().includes((userBranch || "").toLowerCase().split(" ")[0]))
        : assetOnly;
      setEquipmentItems(filtered);
    } catch {
      setEquipmentItems([]);
    } finally {
      setEquipmentLoading(false);
    }
  };

  useEffect(() => { void loadEquipment(); }, []);

  const handleMarkServiced = async (id: number) => {
    setMarkServicedId(id);
    setMarkServicedLoading(true);
    try {
      await inventoryApi.markServiced(id);
      toast.success("Asset marked as serviced.");
      await loadEquipment();
    } catch (err: any) {
      toast.error(err?.message || "Unable to mark as serviced.");
    } finally {
      setMarkServicedLoading(false);
      setMarkServicedId(null);
    }
  };

  const submitAdd = async () => {
    if (!addForm.productId.trim()) { toast.error("Product ID is required."); return; }
    if (!addForm.name.trim())     { toast.error("Asset name is required."); return; }
    if (!addForm.category.trim()) { toast.error("Category is required."); return; }
    if (!addForm.branch.trim())   { toast.error("Branch is required."); return; }
    if (!addForm.purchaseDate.trim()) { toast.error("Purchase Date is required."); return; }
    if (!addForm.brand.trim())    { toast.error("Brand name is required."); return; }
    if (!addForm.purchasePrice.trim()) { toast.error("Purchase Price is required."); return; }
    
    const priceNum = Number(addForm.purchasePrice);
    if (isNaN(priceNum) || priceNum < 0) { toast.error("Purchase Price must be a valid positive number."); return; }

    const qty = Number(addForm.quantity);
    if (!qty || qty < 1)          { toast.error("Quantity must be at least 1."); return; }

    const normalizedProdId = addForm.productId.trim().toLowerCase();
    const isTaken = assets.some(a => a.productId && a.productId.trim().toLowerCase() === normalizedProdId);
    if (isTaken) {
      toast.error(`Product ID "${addForm.productId.trim()}" is already in use.`);
      return;
    }

    setAddSubmitting(true);
    await new Promise((r) => setTimeout(r, 300));

    const newAsset: BranchAsset = {
      id: generateId(),
      productId: addForm.productId.trim(),
      name: addForm.name.trim(),
      category: addForm.category.trim(),
      condition: addForm.condition,
      quantity: qty,
      branch: addForm.branch.trim(),
      notes: addForm.notes.trim(),
      addedAt: new Date().toISOString(),
      unit: addForm.unit.trim() || "units",
      purchaseDate: addForm.purchaseDate || undefined,
      lastInspected: undefined,
      brand: addForm.brand.trim() || undefined,
      purchasePrice: priceNum,
    };

    const updated = [...assets, newAsset];
    saveAssets(updated);
    setAssets(updated);
    toast.success(`"${newAsset.name}" added to ${newAsset.branch}.`);
    setAddOpen(false);
    setAddSubmitting(false);
  };

  // Edit
  const openEdit = (asset: BranchAsset) => {
    setEditTarget(asset);
    setEditForm(assetToEditForm(asset));
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    if (!editForm.productId.trim()) { toast.error("Product ID is required."); return; }
    if (!editForm.name.trim())     { toast.error("Asset name is required."); return; }
    if (!editForm.category.trim()) { toast.error("Category is required."); return; }
    if (!editForm.branch.trim())   { toast.error("Branch is required."); return; }
    if (!editForm.purchaseDate.trim()) { toast.error("Purchase Date is required."); return; }
    if (!editForm.brand.trim())    { toast.error("Brand name is required."); return; }
    if (!editForm.purchasePrice.trim()) { toast.error("Purchase Price is required."); return; }

    const priceNum = Number(editForm.purchasePrice);
    if (isNaN(priceNum) || priceNum < 0) { toast.error("Purchase Price must be a valid positive number."); return; }

    const qty = Number(editForm.quantity);
    if (!qty || qty < 1)           { toast.error("Quantity must be at least 1."); return; }

    const normalizedProdId = editForm.productId.trim().toLowerCase();
    const isTaken = assets.some(a => a.id !== editTarget.id && a.productId && a.productId.trim().toLowerCase() === normalizedProdId);
    if (isTaken) {
      toast.error(`Product ID "${editForm.productId.trim()}" is already in use.`);
      return;
    }

    setEditSubmitting(true);
    await new Promise((r) => setTimeout(r, 300));

    const updated = assets.map((a) =>
      a.id === editTarget.id
        ? {
            ...a,
            productId: editForm.productId.trim(),
            name: editForm.name.trim(),
            category: editForm.category.trim(),
            condition: editForm.condition,
            quantity: qty,
            branch: editForm.branch.trim(),
            notes: editForm.notes.trim(),
            unit: editForm.unit.trim() || "units",
            purchaseDate: editForm.purchaseDate || undefined,
            lastInspected: editForm.lastInspected || undefined,
          }
        : a,
    );
    saveAssets(updated);
    setAssets(updated);
    toast.success(`"${editForm.name.trim()}" updated.`);
    setEditOpen(false);
    setEditSubmitting(false);
  };

  // View details
  const openDetails = (asset: BranchAsset) => {
    setDetailsTarget(asset);
    setDetailsOpen(true);
  };

  // Remove
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
      <motion.div variants={anim} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
          { label: "Total Items",  value: stats.total,     icon: Boxes,         color: "bg-primary/10 text-primary" },
          { label: "Working",      value: stats.working,   icon: CheckCircle2,  color: "bg-emerald-500/15 text-emerald-600" },
          { label: "For Repair",   value: stats.forRepair, icon: AlertCircle,   color: "bg-amber-500/15 text-amber-600" },
          { label: "Broken",       value: stats.broken,    icon: XCircle,       color: "bg-destructive/10 text-destructive" },
        ].map((s) => (
          <motion.div key={s.label} variants={anim} className="glass-card rounded-2xl p-5">
            <div className={`p-2.5 rounded-xl ${s.color} w-fit mb-3`}>
              <s.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Staff info banner */}
      {isStaff && (
        <motion.div variants={anim} className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 text-sm text-foreground">
          <span className="text-base leading-none mt-0.5 flex-shrink-0">📍</span>
          <p>
            You are managing assets for <strong>{userBranch || "your branch"}</strong>.
            You can add, edit, and delete assets for your branch.
            Changes to other branches require admin access.
          </p>
        </motion.div>
      )}

      {/* Branch filter tabs (admin only) + Search + Condition filter */}
      <motion.div variants={anim} className="flex flex-col gap-3">
        {isAdmin && branches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {["All", ...branches].map((b) => (
              <button
                key={b}
                onClick={() => handleTabChange(b)}
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
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {/* Condition filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Condition:</span>
            <Select value={conditionFilter} onValueChange={handleConditionChange}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-sm text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Search */}
          <div className="relative sm:ml-auto w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              id="assets-search"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl"
            />
          </div>
        </div>
      </motion.div>

      {/* Assets table */}
      <motion.div variants={anim} className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/30 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Inventory Register
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              All physical assets tracked for{" "}
              {isAdmin
                ? selectedTab === "All" ? "all branches" : selectedTab
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
                {["Product ID", "Asset Name", "Category", "Condition", "Qty", "Branch", "Notes", "Added", "Actions"].map((h) => (
                  <th key={h} className="text-left p-4 font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedAssets.map((asset) => {
                const cond = conditionStyle[asset.condition];
                const CondIcon = cond.icon;
                return (
                  <tr key={asset.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors group">
                    <td className="p-4">
                      <span className="font-mono text-xs text-foreground bg-muted px-2.5 py-1 rounded-md">
                        {asset.productId || "—"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-primary flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{asset.name}</span>
                          {asset.brand && (
                            <span className="text-[10px] text-muted-foreground">Brand: {asset.brand}</span>
                          )}
                        </div>
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
                    <td className="p-4 font-bold text-foreground">
                      {asset.quantity} <span className="text-xs font-normal text-muted-foreground">{asset.unit ?? "units"}</span>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {asset.branch}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground max-w-[160px]">
                      <span className="truncate block" title={asset.notes}>
                        {asset.notes || <span className="text-border">—</span>}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(asset.addedAt)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetails(asset)}
                          title="View details"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(asset)}
                          title="Edit asset"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openRemove(asset)}
                          title="Remove asset"
                          className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
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

        <Paginator
          page={tablePage}
          totalPages={totalPages}
          onPrev={() => setTablePage((p) => Math.max(1, p - 1))}
          onNext={() => setTablePage((p) => Math.min(totalPages, p + 1))}
        />
      </motion.div>

      {/* Quick legend */}
      {filteredAssets.length > 0 && (
        <motion.div variants={anim} className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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

      {/* ── Branch Equipment Register (API-based, with maintenance tracking) ── */}
      <motion.div variants={anim} className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border/30 flex items-center gap-3">
          <Wrench className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Branch Equipment Register</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Physical equipment tracked by maintenance schedule — washing machines, dryers, aircon, fans. No stock level applies.</p>
          </div>
        </div>

        {equipmentLoading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading equipment...
          </div>
        ) : equipmentItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Wrench className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p>No equipment records found.</p>
            <p className="text-xs mt-1">Equipment is tracked by admin. Contact admin to add washing machines, dryers, aircon, etc.</p>
          </div>
        ) : (
          <>
            {/* Asset summary banner */}
            {(() => {
              const overdue = equipmentItems.filter((a) => {
                if (!a.lastServicedDate || !a.maintenanceIntervalDays) return false;
                const next = new Date(new Date(a.lastServicedDate).getTime() + a.maintenanceIntervalDays * 86400000);
                return next < new Date();
              }).length;
              const onTrack = equipmentItems.length - overdue;
              return (
                <div className="px-5 py-3 bg-muted/10 border-b border-border/20 flex flex-wrap gap-5 text-sm">
                  {overdue > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
                      <strong className="text-red-700">{overdue}</strong>
                      <span className="text-muted-foreground">overdue for service</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <strong className="text-emerald-700">{onTrack}</strong>
                    <span className="text-muted-foreground">on track</span>
                  </span>
                  <span className="text-muted-foreground ml-auto">{equipmentItems.length} total equipment unit{equipmentItems.length !== 1 ? "s" : ""}</span>
                </div>
              );
            })()}

            {/* Desktop table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    {["Equipment", "Condition", "Service Status", "Last Serviced", "Next Service Due", "Maintenance Cycle", "Actions"].map((h) => (
                      <th key={h} className="text-left p-4 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {equipmentItems.map((asset) => {
                    const days = (() => {
                      if (!asset.lastServicedDate || !asset.maintenanceIntervalDays) return null;
                      const next = new Date(new Date(asset.lastServicedDate).getTime() + asset.maintenanceIntervalDays * 86400000);
                      return Math.floor((next.getTime() - Date.now()) / 86400000);
                    })();
                    const svcStatus = days === null
                      ? { label: "No Schedule", cls: "bg-slate-100 text-slate-500" }
                      : days < 0
                      ? { label: `Overdue ${Math.abs(days)}d`, cls: "bg-red-100 text-red-700" }
                      : days <= 7
                      ? { label: `Due in ${days}d`, cls: "bg-red-100 text-red-700" }
                      : days <= 14
                      ? { label: `Due in ${days}d`, cls: "bg-amber-100 text-amber-700" }
                      : { label: `In ${days}d`, cls: "bg-emerald-100 text-emerald-700" };
                    const nextSvc = asset.lastServicedDate && asset.maintenanceIntervalDays
                      ? new Date(new Date(asset.lastServicedDate).getTime() + asset.maintenanceIntervalDays * 86400000)
                      : null;
                    let cyclePct = 0; let cycleColor = "#10B981";
                    if (asset.lastServicedDate && asset.maintenanceIntervalDays) {
                      const daysSince = Math.floor((Date.now() - new Date(asset.lastServicedDate).getTime()) / 86400000);
                      cyclePct = Math.min(100, Math.round((daysSince / asset.maintenanceIntervalDays) * 100));
                      cycleColor = cyclePct >= 100 ? "#EF4444" : cyclePct >= 80 ? "#F59E0B" : "#10B981";
                    }
                    return (
                      <tr key={asset.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors align-middle">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-primary shrink-0" />
                            <div>
                              <p className="font-semibold text-foreground">{asset.itemName}</p>
                              <p className="text-xs text-muted-foreground">{asset.branch} · {asset.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            asset.assetStatus === "Under Maintenance" ? "bg-amber-100 text-amber-700"
                            : asset.assetStatus === "Decommissioned" ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                          }`}>{asset.assetStatus || "Active"}</span>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${svcStatus.cls}`}>{svcStatus.label}</span>
                        </td>
                        <td className="p-4 text-sm text-foreground">
                          {asset.lastServicedDate
                            ? new Date(asset.lastServicedDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
                            : <span className="text-muted-foreground text-xs">Not recorded</span>}
                        </td>
                        <td className="p-4 text-sm text-foreground">
                          {nextSvc
                            ? nextSvc.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="p-4">
                          {asset.maintenanceIntervalDays ? (
                            <div className="space-y-1 min-w-[120px]">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div style={{ width: `${cyclePct}%`, background: cycleColor }} className="h-full rounded-full transition-all" />
                              </div>
                              <p className="text-xs text-muted-foreground">{cyclePct}% of {asset.maintenanceIntervalDays}-day cycle</p>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              disabled={markServicedLoading && markServicedId === asset.id}
                              onClick={() => void handleMarkServiced(asset.id)}
                            >
                              {markServicedLoading && markServicedId === asset.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : "Mark Serviced"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-border/20">
              {equipmentItems.map((asset) => {
                const days = (() => {
                  if (!asset.lastServicedDate || !asset.maintenanceIntervalDays) return null;
                  const next = new Date(new Date(asset.lastServicedDate).getTime() + asset.maintenanceIntervalDays * 86400000);
                  return Math.floor((next.getTime() - Date.now()) / 86400000);
                })();
                const svcStatus = days === null ? { label: "No Schedule", cls: "bg-slate-100 text-slate-500" }
                  : days < 0 ? { label: `Overdue ${Math.abs(days)}d`, cls: "bg-red-100 text-red-700" }
                  : days <= 14 ? { label: `Due in ${days}d`, cls: "bg-amber-100 text-amber-700" }
                  : { label: `In ${days}d`, cls: "bg-emerald-100 text-emerald-700" };
                let cyclePct = 0; let cycleColor = "#10B981";
                if (asset.lastServicedDate && asset.maintenanceIntervalDays) {
                  const ds = Math.floor((Date.now() - new Date(asset.lastServicedDate).getTime()) / 86400000);
                  cyclePct = Math.min(100, Math.round((ds / asset.maintenanceIntervalDays) * 100));
                  cycleColor = cyclePct >= 100 ? "#EF4444" : cyclePct >= 80 ? "#F59E0B" : "#10B981";
                }
                return (
                  <div key={asset.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{asset.itemName}</p>
                        <p className="text-xs text-muted-foreground">{asset.branch} · {asset.category}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${svcStatus.cls}`}>{svcStatus.label}</span>
                    </div>
                    {asset.maintenanceIntervalDays && (
                      <div className="space-y-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div style={{ width: `${cyclePct}%`, background: cycleColor }} className="h-full rounded-full" />
                        </div>
                        <p className="text-xs text-muted-foreground">{cyclePct}% of {asset.maintenanceIntervalDays}-day service cycle</p>
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      disabled={markServicedLoading && markServicedId === asset.id}
                      onClick={() => void handleMarkServiced(asset.id)}
                    >
                      {markServicedLoading && markServicedId === asset.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : "Mark Serviced"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </motion.div>

      {/* ── Add Asset Dialog ────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" /> Add Inventory Item
            </DialogTitle>
            <DialogDescription>
              Register a new item for the branch inventory.
            </DialogDescription>
          </DialogHeader>
          <AssetFormFields
            form={addForm}
            setForm={setAddForm}
            adminBranch={isAdmin}
            branches={branches}
            userBranch={userBranch}
            assets={assets}
            mode="add"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSubmitting}>Cancel</Button>
            <Button onClick={() => void submitAdd()} disabled={addSubmitting} className="gradient-navy">
              {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {addSubmitting ? "Adding..." : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Asset Dialog ───────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Inventory Item
            </DialogTitle>
            <DialogDescription>
              Update the details for{" "}
              <span className="font-semibold text-foreground">{editTarget?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <AssetFormFields
            form={editForm}
            setForm={setEditForm}
            adminBranch={isAdmin}
            branches={branches}
            userBranch={userBranch}
            assets={assets}
            mode="edit"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSubmitting}>Cancel</Button>
            <Button onClick={() => void submitEdit()} disabled={editSubmitting} className="gradient-navy">
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {editSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Details Dialog ─────────────────────────────────────────────── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Asset Details
            </DialogTitle>
          </DialogHeader>
          {detailsTarget && (() => {
            const cond = conditionStyle[detailsTarget.condition];
            const CondIcon = cond.icon;
            return (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Product ID</span>
                  <span className="font-mono text-xs text-foreground bg-muted px-2 py-0.5 rounded">{detailsTarget.productId || "—"}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-semibold text-foreground text-right max-w-[60%]">{detailsTarget.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Category</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColors[detailsTarget.category] ?? categoryColors["Other"]}`}>
                    {detailsTarget.category}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Condition</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cond.badge}`}>
                    <CondIcon className="h-3 w-3" /> {detailsTarget.condition}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity</span>
                  <span className="font-bold">{detailsTarget.quantity} {detailsTarget.unit ?? "units"}</span>
                </div>
                {detailsTarget.brand && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Brand</span>
                    <span className="text-foreground font-semibold">{detailsTarget.brand}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branch</span>
                  <span className="text-foreground">{detailsTarget.branch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchase Date</span>
                  <span className="text-foreground">{fmtDate(detailsTarget.purchaseDate)}</span>
                </div>
                {detailsTarget.purchasePrice !== undefined && detailsTarget.purchasePrice !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Purchase Price</span>
                    <span className="text-foreground font-semibold">₱{Number(detailsTarget.purchasePrice).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date Added</span>
                  <span className="text-foreground">{fmtDate(detailsTarget.addedAt)}</span>
                </div>
                {detailsTarget.notes && (
                  <div className="pt-2 border-t border-border/30">
                    <p className="text-muted-foreground text-xs mb-1">Notes</p>
                    <p className="text-foreground text-sm">{detailsTarget.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
            {detailsTarget && (
              <Button
                className="gradient-navy"
                onClick={() => { setDetailsOpen(false); openEdit(detailsTarget); }}
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
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

// ─── Asset Form Fields Component ─────────────────────────────────────────────

interface AssetFormFieldsProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  adminBranch: boolean;
  branches: string[];
  userBranch: string;
  assets: BranchAsset[];
  mode: "add" | "edit";
}

function AssetFormFields({
  form, setForm, adminBranch, branches, userBranch, assets, mode,
}: AssetFormFieldsProps) {
  const categoryItems = form.category ? (CATEGORY_ITEMS_MAP[form.category] || []) : [];
  const categoryBrands = form.category ? (CATEGORY_BRANDS_MAP[form.category] || []) : [];

  const [showCustomItem, setShowCustomItem] = useState(false);
  const [showCustomBrand, setShowCustomBrand] = useState(false);

  useEffect(() => {
    if (!form.category) {
      setShowCustomItem(false);
      setShowCustomBrand(false);
      return;
    }
    const items = CATEGORY_ITEMS_MAP[form.category] || [];
    const brands = CATEGORY_BRANDS_MAP[form.category] || [];
    
    if (form.name && !items.includes(form.name)) {
      setShowCustomItem(true);
    } else if (!form.name) {
      setShowCustomItem(false);
    }
    
    if (form.brand && !brands.includes(form.brand)) {
      setShowCustomBrand(true);
    } else if (!form.brand) {
      setShowCustomBrand(false);
    }
  }, [form.category, form.productId, mode]);

  const selectedItemValue = showCustomItem
    ? "__custom__"
    : (categoryItems.includes(form.name) ? form.name : "");

  const selectedBrandValue = showCustomBrand
    ? "__custom__"
    : (categoryBrands.includes(form.brand) ? form.brand : "");

  return (
    <div className="space-y-4">
      {/* Branch */}
      {adminBranch ? (
        <div className="space-y-2">
          <Label>Branch</Label>
          <Select value={form.branch} onValueChange={(val) => setForm((p) => ({ ...p, branch: val }))}>
            <SelectTrigger className="w-full text-foreground">
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Branch</Label>
          <Input value={userBranch} readOnly className="bg-muted text-muted-foreground" />
        </div>
      )}

      {/* Category */}
      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={form.category}
          onValueChange={(val) => {
            setForm((p) => ({
              ...p,
              category: val,
              name: "",
              brand: "",
              productId: mode === "add" ? generateNextProductId(assets, "") : p.productId,
            }));
            setShowCustomItem(false);
            setShowCustomBrand(false);
          }}
        >
          <SelectTrigger className="w-full text-foreground">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {ASSET_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product ID */}
      <div className="space-y-2">
        <Label>Product ID / Serial Number</Label>
        <Input
          value={form.productId}
          readOnly
          className="bg-muted text-muted-foreground cursor-not-allowed font-mono font-medium"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">Auto-generated by the system.</p>
      </div>

      {/* Item Name + Brand */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Item Name <span className="text-destructive">*</span></Label>
          <Select
            value={selectedItemValue}
            disabled={!form.category}
            onValueChange={(val) => {
              if (val === "__custom__") {
                setShowCustomItem(true);
                setForm((p) => {
                  const nextId = mode === "add" ? generateNextProductId(assets, "") : p.productId;
                  return { ...p, name: "", productId: nextId };
                });
              } else {
                setShowCustomItem(false);
                setForm((p) => {
                  const nextId = mode === "add" ? generateNextProductId(assets, val) : p.productId;
                  return { ...p, name: val, productId: nextId };
                });
              }
            }}
          >
            <SelectTrigger className="w-full text-foreground">
              <SelectValue placeholder={form.category ? "Select an item" : "Select category first"} />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
              {form.category && (
                <SelectItem value="__custom__">Other (Specify Custom Name)</SelectItem>
              )}
            </SelectContent>
          </Select>

          {showCustomItem && (
            <Input
              className="mt-2"
              placeholder="Enter custom item name..."
              value={form.name}
              onChange={(e) => {
                const newName = e.target.value;
                setForm((p) => {
                  const nextId = mode === "add" ? generateNextProductId(assets, newName) : p.productId;
                  return { ...p, name: newName, productId: nextId };
                });
              }}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Brand Name <span className="text-destructive">*</span></Label>
          <Select
            value={selectedBrandValue}
            disabled={!form.category}
            onValueChange={(val) => {
              if (val === "__custom__") {
                setShowCustomBrand(true);
                setForm((p) => ({ ...p, brand: "" }));
              } else {
                setShowCustomBrand(false);
                setForm((p) => ({ ...p, brand: val }));
              }
            }}
          >
            <SelectTrigger className="w-full text-foreground">
              <SelectValue placeholder={form.category ? "Select a brand" : "Select category first"} />
            </SelectTrigger>
            <SelectContent>
              {categoryBrands.map((brand) => (
                <SelectItem key={brand} value={brand}>{brand}</SelectItem>
              ))}
              {form.category && (
                <SelectItem value="__custom__">Other (Specify Custom Brand)</SelectItem>
              )}
            </SelectContent>
          </Select>

          {showCustomBrand && (
            <Input
              className="mt-2"
              placeholder="Enter custom brand name..."
              value={form.brand}
              onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
            />
          )}
        </div>
      </div>

      {/* Condition + Quantity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Condition</Label>
          <Select
            value={form.condition}
            onValueChange={(val) => setForm((p) => ({ ...p, condition: val as AssetCondition }))}
          >
            <SelectTrigger className="w-full text-foreground">
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
          <Label>Quantity</Label>
          <Input
            type="number" min="1" step="1"
            value={form.quantity}
            disabled={true}
            className="bg-muted text-muted-foreground cursor-not-allowed font-medium"
            onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Quantity is fixed to 1 for unique product tracking.</p>
        </div>
      </div>


      {/* Purchase Date + Purchase Price */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Purchase Date <span className="text-destructive">*</span></Label>
          <Input
            type="date"
            value={form.purchaseDate}
            onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Purchase Price (₱) <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 15000"
            value={form.purchasePrice}
            onChange={(e) => setForm((p) => ({ ...p, purchasePrice: e.target.value }))}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input
          placeholder="e.g. Located in washing area, serial no. ABC123"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
      </div>
    </div>
  );
}
