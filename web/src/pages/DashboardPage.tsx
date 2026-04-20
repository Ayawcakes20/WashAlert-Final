import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Users,
  TrendingUp,
  Truck,
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Array<{ message: string; type: "warning" | "info" | "success" }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await dashboardApi.summary();
        const activeOrders = data.orders.pending + data.orders.washing + data.orders.drying + data.orders.ready;

        setStats([
          { label: "Active Orders", value: String(activeOrders), change: "Live", icon: ShoppingCart, color: "bg-primary/10 text-primary" },
          { label: "Ready Orders", value: String(data.orders.ready), change: "Live", icon: Users, color: "bg-secondary/30 text-secondary-foreground" },
          { label: "Machines In Use", value: String(data.machines.inUse), change: "Live", icon: TrendingUp, color: "bg-accent/20 text-accent" },
          { label: "Maintenance", value: String(data.machines.maintenance), change: "Live", icon: Truck, color: "bg-destructive/10 text-destructive" },
        ]);

        setRecentOrders(
          (data.recentOrders || []).map((order: JobOrderResponse) => ({
            id: order.trackingNumber,
            customer: order.customerName,
            service: order.serviceType === "PICKUP_DELIVERY" ? "Pickup & Delivery" : "Drop Off",
            branch: order.branch,
            status: statusLabel[order.status] || order.status,
            time: new Date(order.updatedAt || order.createdAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            }),
          }))
        );

        setAlerts([
          { message: `${data.orders.pending} pending orders need processing.`, type: "warning" },
          { message: `${data.machines.inUse} machines are currently running.`, type: "info" },
          { message: `${data.orders.ready} orders are ready for pickup/delivery.`, type: "success" },
        ]);
      } catch {
        setStats([
          { label: "Active Orders", value: "-", change: "Unavailable", icon: ShoppingCart, color: "bg-primary/10 text-primary" },
          { label: "Ready Orders", value: "-", change: "Unavailable", icon: Users, color: "bg-secondary/30 text-secondary-foreground" },
          { label: "Machines In Use", value: "-", change: "Unavailable", icon: TrendingUp, color: "bg-accent/20 text-accent" },
          { label: "Maintenance", value: "-", change: "Unavailable", icon: Truck, color: "bg-destructive/10 text-destructive" },
        ]);
        setRecentOrders([]);
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
                  <th className="text-right pb-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
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
                    <td className="py-3 text-right text-muted-foreground text-xs">{o.time}</td>
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
