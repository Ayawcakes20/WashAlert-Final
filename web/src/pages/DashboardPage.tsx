import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Users,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { dashboardApi, type JobOrderResponse } from "@/lib/api";

const statusColor: Record<string, string> = {
  Pending: "bg-accent/20 text-accent-foreground",
  Washing: "bg-primary/10 text-primary",
  Drying: "bg-secondary/30 text-secondary-foreground",
  Ready: "bg-mint/20 text-mint-foreground",
  "For Delivery": "bg-destructive/10 text-destructive",
};

const statusLabel: Record<string, string> = {
  PENDING: "Pending",
  WASHING: "Washing",
  DRYING: "Drying",
  READY: "Ready",
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const RECENT_ORDERS_PAGE_SIZE = 5;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentOrdersPage, setRecentOrdersPage] = useState(1);
  const [alerts, setAlerts] = useState<Array<{ message: string; type: "warning" | "info" | "success" }>>([]);

  const totalRecentOrderPages = Math.max(1, Math.ceil(recentOrders.length / RECENT_ORDERS_PAGE_SIZE));
  const paginatedRecentOrders = useMemo(() => {
    const start = (recentOrdersPage - 1) * RECENT_ORDERS_PAGE_SIZE;
    return recentOrders.slice(start, start + RECENT_ORDERS_PAGE_SIZE);
  }, [recentOrders, recentOrdersPage]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await dashboardApi.summary();
        const activeOrders = data.orders.pending + data.orders.washing + data.orders.drying + data.orders.ready;

        setStats([
          { label: "Active Orders", value: String(activeOrders), change: "Live", icon: ShoppingCart, color: "bg-primary/10 text-primary" },
          { label: "Ready Orders", value: String(data.orders.ready), change: "Live", icon: Users, color: "bg-secondary/30 text-secondary-foreground" },
        ]);

        setRecentOrders(
          (data.recentOrders || []).map((order: JobOrderResponse) => {
            const timestamp = new Date(order.updatedAt || order.createdAt);
            const dateLabel = timestamp.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const timeLabel = timestamp.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
            return {
              id: order.trackingNumber,
              customer: order.customerName,
              service: order.serviceType === "PICKUP_DELIVERY" ? "Pickup & Delivery" : "Drop Off",
              branch: order.branch,
              status: statusLabel[order.status] || order.status,
              dateTime: `${dateLabel} • ${timeLabel}`,
            };
          })
        );
        setRecentOrdersPage(1);

        setAlerts([
          { message: `${data.orders.pending} pending orders need processing.`, type: "warning" },
          { message: `${data.orders.ready} orders are ready for pickup/delivery.`, type: "success" },
        ]);
      } catch {
        setStats([
          { label: "Active Orders", value: "-", change: "Unavailable", icon: ShoppingCart, color: "bg-primary/10 text-primary" },
          { label: "Ready Orders", value: "-", change: "Unavailable", icon: Users, color: "bg-secondary/30 text-secondary-foreground" },
        ]);
        setRecentOrders([]);
        setRecentOrdersPage(1);
        setAlerts([{ message: "Unable to load dashboard summary from backend.", type: "warning" }]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-8"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time overview of all Triplets LaundryHubs & SpeedyWash branches</p>
      </motion.div>

      {loading ? <p className="text-sm text-muted-foreground">Loading dashboard data...</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <motion.div key={s.label} variants={item} className="glass-card rounded-2xl p-5 hover:shadow-[var(--shadow-elevated)] transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-mint">
                {s.change} <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} className="lg:col-span-2 glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border/50">
                  <th className="text-left pb-3 font-medium">Order ID</th>
                  <th className="text-left pb-3 font-medium">Customer</th>
                  <th className="text-left pb-3 font-medium hidden md:table-cell">Service</th>
                  <th className="text-left pb-3 font-medium hidden lg:table-cell">Branch</th>
                  <th className="text-left pb-3 font-medium">Status</th>
                  <th className="text-right pb-3 font-medium">Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-mono text-xs font-semibold text-primary">{o.id}</td>
                    <td className="py-3 font-medium text-foreground">{o.customer}</td>
                    <td className="py-3 text-muted-foreground hidden md:table-cell">{o.service}</td>
                    <td className="py-3 text-muted-foreground hidden lg:table-cell">{o.branch}</td>
                    <td className="py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${statusColor[o.status] || "bg-muted text-muted-foreground"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-muted-foreground text-xs">{o.dateTime}</td>
                  </tr>
                ))}
                {!recentOrders.length ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      No recent orders available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {recentOrders.length > RECENT_ORDERS_PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRecentOrdersPage((prev) => Math.max(1, prev - 1))}
                disabled={recentOrdersPage === 1}
                className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {recentOrdersPage} of {totalRecentOrderPages}
              </span>
              <button
                type="button"
                onClick={() => setRecentOrdersPage((prev) => Math.min(totalRecentOrderPages, prev + 1))}
                disabled={recentOrdersPage >= totalRecentOrderPages}
                className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-50"
              >
                Next
              </button>
            </div>
          ) : null}
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Live Alerts</h2>
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
                <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${a.type === "warning" ? "text-accent" : a.type === "success" ? "text-mint" : "text-primary"}`} />
                <p className="text-xs text-foreground leading-relaxed">{a.message}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
