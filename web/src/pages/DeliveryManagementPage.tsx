import { motion } from "framer-motion";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Truck,
  MapPin,
  Clock,
  User,
  Package,
  Phone,
  CheckCircle2,
  AlertCircle,
  Navigation,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ordersApi, type JobOrderResponse } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/session";

const DELIVERY_STATUSES = [
  "ASSIGNED_FOR_DELIVERY",
  "EN_ROUTE_TO_BRANCH",
  "PICKED_UP_FROM_BRANCH",
  "OUT_FOR_DELIVERY",
  "COLLECTION_FAILED"
].join(",");

const statusLabels: Record<string, string> = {
  ASSIGNED_FOR_DELIVERY: "Assigned",
  EN_ROUTE_TO_BRANCH: "Heading to branch",
  PICKED_UP_FROM_BRANCH: "Picked up",
  OUT_FOR_DELIVERY: "Out for delivery",
  COLLECTION_FAILED: "Delivery failed",
};

const statusColors: Record<string, string> = {
  ASSIGNED_FOR_DELIVERY: "bg-slate-100 text-slate-700 border-slate-200",
  EN_ROUTE_TO_BRANCH: "bg-blue-50 text-blue-700 border-blue-100",
  PICKED_UP_FROM_BRANCH: "bg-indigo-50 text-indigo-700 border-indigo-100",
  OUT_FOR_DELIVERY: "bg-amber-50 text-amber-700 border-amber-100",
  COLLECTION_FAILED: "bg-rose-50 text-rose-700 border-rose-100",
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function DeliveryManagementPage() {
  const currentUser = getSessionUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const staffBranch = currentUser?.branch || "";

  const [orders, setOrders] = useState<JobOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  const loadOrders = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await ordersApi.listPaged({
        page: 0,
        size: 100,
        status: DELIVERY_STATUSES,
        branch: isAdmin ? undefined : staffBranch,
      });
      setOrders(response.content || []);
      setLastRefreshed(new Date());
    } catch (err: any) {
      if (!silent) toast.error("Failed to load delivery orders.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAdmin, staffBranch]);

  useEffect(() => {
    void loadOrders();
    autoRefreshRef.current = setInterval(() => void loadOrders(true), 15000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [loadOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrders(true);
    setRefreshing(false);
    toast.success("Delivery status updated.");
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Delivery Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tracking active deliveries for {isAdmin ? "all branches" : staffBranch}.
          </p>
          {lastRefreshed && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              Last synced: {lastRefreshed.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-4 rounded-xl border-slate-200"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Updating..." : "Refresh Status"}
        </Button>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="text-left p-5">Order</th>
                <th className="text-left p-5">Customer & Address</th>
                <th className="text-left p-5">Rider</th>
                <th className="text-left p-5">Status</th>
                <th className="text-left p-5">Distance</th>
                <th className="text-right p-5">Last Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-300 mx-auto" />
                    <p className="text-slate-400 font-bold mt-4">Fetching active deliveries...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                      <Truck className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-black">No active deliveries at the moment.</p>
                    <p className="text-slate-400 text-xs mt-1">Orders appear here once a rider is assigned.</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const distance = (order.driverLat && order.driverLng && order.deliveryLatitude && order.deliveryLongitude)
                    ? calculateDistance(order.driverLat, order.driverLng, order.deliveryLatitude, order.deliveryLongitude)
                    : null;

                  return (
                    <motion.tr key={order.id} variants={item} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="p-5">
                        <div className="font-black text-slate-900">{order.trackingNumber}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{order.branch}</div>
                      </td>
                      <td className="p-5">
                        <div className="font-black text-slate-800">{order.customerName}</div>
                        <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="text-[11px] font-bold truncate max-w-[200px]">{order.deliveryAddress || "-"}</span>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-black text-slate-500 uppercase">{order.assignedDriverName?.[0]}</span>
                          </div>
                          <div>
                            <div className="font-black text-slate-700 leading-none">{order.assignedDriverName}</div>
                            <div className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                               <Phone className="h-2.5 w-2.5" /> {order.customerPhone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-tight ${statusColors[order.status] || 'bg-slate-50'}`}>
                          <div className="h-1 w-1 rounded-full bg-current animate-pulse" />
                          {statusLabels[order.status] || order.status}
                        </div>
                      </td>
                      <td className="p-5">
                        {distance != null ? (
                          <div className="flex items-center gap-1.5">
                            <Navigation className="h-3 w-3 text-blue-500" />
                            <span className="font-black text-slate-900 tabular-nums">{distance.toFixed(1)} <span className="text-[10px] text-slate-400">km</span></span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold text-[10px] uppercase">No GPS signal</span>
                        )}
                      </td>
                      <td className="p-5 text-right">
                        <div className="text-[11px] font-black text-slate-500">
                          {new Date(order.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                          {new Date(order.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
