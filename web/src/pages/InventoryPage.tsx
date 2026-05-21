import { useState } from "react";
import { Package, Boxes } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PredictiveInventoryPage from "./PredictiveInventoryPage";
import BranchAssetsPage from "./BranchAssetsPage";
import { getSessionUser } from "@/lib/session";

type Tab = "predictive" | "assets";

const ALL_TABS: { id: Tab; label: string; icon: typeof Package; description: string }[] = [
  {
    id: "predictive",
    label: "Predictive Inventory",
    icon: Package,
    description: "Consumables · Detergent & Fabric Conditioner · AI Forecasting",
  },
  {
    id: "assets",
    label: "Branch Assets",
    icon: Boxes,
    description: "Equipment & Furniture · Fans, Aircons, Chairs, and more",
  },
];

export default function InventoryPage() {
  const user = getSessionUser();
  const isAdmin = user?.role === "ADMIN";

  // Staff only sees Predictive Inventory — never Branch Assets
  const tabs = isAdmin ? ALL_TABS : ALL_TABS.filter((t) => t.id !== "assets");

  const [activeTab, setActiveTab] = useState<Tab>("predictive");

  // If staff somehow has 'assets' active (e.g. stale state), reset to predictive
  const safeActiveTab: Tab = isAdmin ? activeTab : "predictive";

  return (
    <div className="space-y-6">
      {/* Tab header */}
      <div className="glass-card rounded-2xl p-1.5 flex gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = safeActiveTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <div
                className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                  isActive ? "bg-white/15" : "bg-muted group-hover:bg-muted/80"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold leading-tight ${isActive ? "text-primary-foreground" : ""}`}>
                  {tab.label}
                </p>
                <p
                  className={`text-[11px] leading-tight mt-0.5 truncate ${
                    isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {tab.description}
                </p>
              </div>
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 rounded-xl ring-2 ring-primary/30 pointer-events-none"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={safeActiveTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {safeActiveTab === "predictive" ? <PredictiveInventoryPage /> : <BranchAssetsPage />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
