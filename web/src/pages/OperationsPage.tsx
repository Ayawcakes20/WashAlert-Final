import { useState } from "react";
import { motion } from "framer-motion";
import { GripVertical, User, Clock, Weight } from "lucide-react";

type OrderStatus = "Pending" | "Washing" | "Drying" | "Ready" | "For Delivery";

interface Order {
  id: string;
  customer: string;
  service: string;
  weight: string;
  branch: string;
  time: string;
  status: OrderStatus;
}

const initialOrders: Order[] = [
  { id: "WA-20251", customer: "Juan Dela Cruz", service: "Wash & Fold", weight: "5kg", branch: "Makati", time: "10:32 AM", status: "Pending" },
  { id: "WA-20252", customer: "Maria Santos", service: "Dry Clean", weight: "3kg", branch: "UP Diliman", time: "10:15 AM", status: "Pending" },
  { id: "WA-20253", customer: "Pedro Reyes", service: "Wash & Fold", weight: "8kg", branch: "Pasig", time: "9:48 AM", status: "Washing" },
  { id: "WA-20254", customer: "Ana Garcia", service: "Wash & Iron", weight: "4kg", branch: "JP Rizal", time: "9:30 AM", status: "Washing" },
  { id: "WA-20255", customer: "Carlo Mendoza", service: "Wash & Fold", weight: "6kg", branch: "Chestnut", time: "9:12 AM", status: "Drying" },
  { id: "WA-20256", customer: "Rosa Lim", service: "Wash & Fold", weight: "7kg", branch: "T.O.N", time: "8:55 AM", status: "Ready" },
  { id: "WA-20257", customer: "Miguel Torres", service: "Wash & Iron", weight: "3kg", branch: "Samat", time: "8:40 AM", status: "Ready" },
  { id: "WA-20258", customer: "Sofia Ramos", service: "Wash & Fold", weight: "5kg", branch: "St. Niño", time: "8:20 AM", status: "For Delivery" },
];

const columns: { status: OrderStatus; color: string; bgColor: string }[] = [
  { status: "Pending", color: "border-accent", bgColor: "bg-accent/10" },
  { status: "Washing", color: "border-primary", bgColor: "bg-primary/10" },
  { status: "Drying", color: "border-secondary", bgColor: "bg-secondary/20" },
  { status: "Ready", color: "border-mint", bgColor: "bg-mint/10" },
  { status: "For Delivery", color: "border-destructive", bgColor: "bg-destructive/10" },
];

export default function OperationsPage() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);

  const handleDragStart = (orderId: string) => setDraggedOrder(orderId);

  const handleDrop = (targetStatus: OrderStatus) => {
    if (!draggedOrder) return;
    setOrders((prev) =>
      prev.map((o) => (o.id === draggedOrder ? { ...o, status: targetStatus } : o))
    );
    setDraggedOrder(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Operations Board</h1>
        <p className="text-sm text-muted-foreground mt-1">Drag orders between stages to update their status</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status);
          return (
            <div
              key={col.status}
              className={`shrink-0 w-72 rounded-2xl ${col.bgColor} border-t-4 ${col.color} p-4 min-h-[500px]`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.status)}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">{col.status}</h3>
                <span className="text-xs font-semibold bg-card px-2 py-0.5 rounded-full text-muted-foreground">
                  {colOrders.length}
                </span>
              </div>
              <div className="space-y-3">
                {colOrders.map((o) => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={() => handleDragStart(o.id)}
                    className="glass-card rounded-xl p-4 cursor-grab active:cursor-grabbing hover:shadow-[var(--shadow-elevated)] transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                      <span className="text-xs font-mono font-bold text-primary">{o.id}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {o.customer}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Weight className="h-3 w-3" />{o.weight} {o.service}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{o.branch}</span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />{o.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
