import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
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
  Plus,
  Pencil,
} from "lucide-react";
import { deliveriesApi, type DeliveryRecord } from "@/lib/api";
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

type DeliveryStatusLabel = "Pending Pickup" | "Picked Up" | "In Transit" | "Delivered" | "Failed";
type DeliveryStatusApi = DeliveryRecord["status"];

interface Delivery {
  id: number;
  orderId: string;
  customer: string;
  address: string;
  branch: string;
  rider: string;
  riderPhone: string;
  status: DeliveryStatusLabel;
  statusApi: DeliveryStatusApi;
  eta?: string;
  rawEta?: string | null;
  notes?: string | null;
}

const statusStyle: Record<DeliveryStatusLabel, { color: string; icon: typeof Truck }> = {
  "Pending Pickup": { color: "bg-accent/15 text-accent-foreground", icon: Package },
  "Picked Up": { color: "bg-primary/10 text-primary", icon: CheckCircle2 },
  "In Transit": { color: "bg-mint/15 text-mint-foreground", icon: Navigation },
  Delivered: { color: "bg-secondary/20 text-secondary-foreground", icon: CheckCircle2 },
  Failed: { color: "bg-destructive/10 text-destructive", icon: AlertCircle },
};

const statusMap: Record<DeliveryStatusApi, DeliveryStatusLabel> = {
  PENDING_PICKUP: "Pending Pickup",
  PICKED_UP: "Picked Up",
  IN_TRANSIT: "In Transit",
  DELIVERED: "Delivered",
  FAILED: "Failed",
};

const statusApiMap: Record<DeliveryStatusLabel, DeliveryStatusApi> = {
  "Pending Pickup": "PENDING_PICKUP",
  "Picked Up": "PICKED_UP",
  "In Transit": "IN_TRANSIT",
  Delivered: "DELIVERED",
  Failed: "FAILED",
};

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const mapDelivery = (d: DeliveryRecord): Delivery => ({
  id: d.id,
  orderId: d.trackingNumber,
  customer: d.customerName || "Customer",
  address: d.deliveryAddress || "-",
  branch: d.branch || "-",
  rider: d.driverName || "Unassigned",
  riderPhone: d.driverPhone || "-",
  status: statusMap[d.status] || "Pending Pickup",
  statusApi: d.status,
  eta: d.estimatedArrivalAt
    ? new Date(d.estimatedArrivalAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : undefined,
  rawEta: d.estimatedArrivalAt,
  notes: d.notes,
});

export default function DeliveryManagementPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusDrafts, setStatusDrafts] = useState<Record<number, DeliveryStatusApi>>({});
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    trackingNumber: "",
    driverName: "",
    driverPhone: "",
    estimatedArrivalAt: "",
    notes: "",
  });

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [assignForm, setAssignForm] = useState({
    driverName: "",
    driverPhone: "",
    estimatedArrivalAt: "",
    notes: "",
  });

  const loadDeliveries = async () => {
    try {
      setError("");
      const data = await deliveriesApi.list();
      const mapped = data.map(mapDelivery);
      setDeliveries(mapped);
      setStatusDrafts(
        mapped.reduce(
          (acc, d) => {
            acc[d.id] = d.statusApi;
            return acc;
          },
          {} as Record<number, DeliveryStatusApi>,
        ),
      );
    } catch (err: any) {
      setError(err?.message || "Unable to load deliveries.");
      setDeliveries([]);
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await loadDeliveries();
      setLoading(false);
    };
    void run();
  }, []);

  const riders = useMemo(() => {
    const unique = new Map<string, { name: string; phone: string; activeDeliveries: number; status: string }>();
    deliveries.forEach((d) => {
      if (!unique.has(d.rider)) {
        unique.set(d.rider, { name: d.rider, phone: d.riderPhone, activeDeliveries: 0, status: "Available" });
      }
      const rider = unique.get(d.rider)!;
      if (d.status === "In Transit" || d.status === "Picked Up") {
        rider.activeDeliveries += 1;
        rider.status = "On Route";
      }
    });
    return Array.from(unique.values());
  }, [deliveries]);

  const submitCreate = async () => {
    if (!createForm.trackingNumber.trim() || !createForm.driverName.trim() || !createForm.driverPhone.trim()) {
      toast.error("Tracking number, rider name, and rider phone are required.");
      return;
    }

    setCreateSubmitting(true);
    try {
      await deliveriesApi.create({
        trackingNumber: createForm.trackingNumber.trim().toUpperCase(),
        driverName: createForm.driverName.trim(),
        driverPhone: createForm.driverPhone.trim(),
        estimatedArrivalAt: createForm.estimatedArrivalAt || null,
        notes: createForm.notes.trim() || null,
      });
      toast.success("Delivery created and rider assigned.");
      setCreateOpen(false);
      setCreateForm({
        trackingNumber: "",
        driverName: "",
        driverPhone: "",
        estimatedArrivalAt: "",
        notes: "",
      });
      await loadDeliveries();
    } catch (err: any) {
      toast.error(err?.message || "Unable to create delivery.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const submitStatusUpdate = async (delivery: Delivery) => {
    const nextStatus = statusDrafts[delivery.id] || delivery.statusApi;
    if (nextStatus === delivery.statusApi) return;

    setStatusUpdatingId(delivery.id);
    try {
      await deliveriesApi.updateStatus(delivery.id, {
        status: nextStatus,
      });
      toast.success(`Delivery ${delivery.orderId} moved to ${statusMap[nextStatus]}.`);
      await loadDeliveries();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update delivery status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const openAssign = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setAssignForm({
      driverName: delivery.rider === "Unassigned" ? "" : delivery.rider,
      driverPhone: delivery.riderPhone === "-" ? "" : delivery.riderPhone,
      estimatedArrivalAt: delivery.rawEta || "",
      notes: delivery.notes || "",
    });
    setAssignOpen(true);
  };

  const submitAssign = async () => {
    if (!selectedDelivery) return;
    if (!assignForm.driverName.trim() || !assignForm.driverPhone.trim()) {
      toast.error("Rider name and rider phone are required.");
      return;
    }

    setAssignSubmitting(true);
    try {
      await deliveriesApi.assignRider(selectedDelivery.id, {
        driverName: assignForm.driverName.trim(),
        driverPhone: assignForm.driverPhone.trim(),
        estimatedArrivalAt: assignForm.estimatedArrivalAt || null,
        notes: assignForm.notes.trim() || null,
      });
      toast.success("Rider assignment updated.");
      setAssignOpen(false);
      await loadDeliveries();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update rider assignment.");
    } finally {
      setAssignSubmitting(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Delivery Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Driver assignment, live delivery status, and pickup/delivery schedules</p>
        </div>
        <Button className="h-10 px-5 rounded-xl gradient-navy" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Delivery
        </Button>
      </motion.div>

      {loading ? <p className="text-sm text-muted-foreground">Loading deliveries...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Deliveries", value: deliveries.length, color: "bg-primary/10 text-primary", icon: Truck },
          { label: "In Transit", value: deliveries.filter((d) => d.status === "In Transit").length, color: "bg-mint/15 text-mint", icon: Navigation },
          { label: "Pending Pickup", value: deliveries.filter((d) => d.status === "Pending Pickup").length, color: "bg-accent/15 text-accent", icon: Package },
          { label: "Active Riders", value: riders.filter((r) => r.status === "On Route").length, color: "bg-secondary/20 text-secondary-foreground", icon: User },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} className="lg:col-span-2 glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Delivery Schedule</h2>
          <div className="space-y-3">
            {deliveries.map((d) => {
              const cfg = statusStyle[d.status];
              const StatusIcon = cfg.icon;
              return (
                <div key={d.id} className="rounded-xl border border-border/30 p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-primary">{d.orderId}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${cfg.color}`}>
                        <StatusIcon className="h-3 w-3" /> {d.status}
                      </span>
                    </div>
                    {d.eta ? (
                      <span className="text-xs font-semibold text-mint flex items-center gap-1">
                        <Clock className="h-3 w-3" /> ETA: {d.eta}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground mt-3">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      <span className="font-medium text-foreground">{d.customer}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      <span>{d.address}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3 w-3" />
                      <span>
                        Rider: <span className="font-medium text-foreground">{d.rider}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      <span>{d.riderPhone}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                    <select
                      value={statusDrafts[d.id] || d.statusApi}
                      onChange={(e) =>
                        setStatusDrafts((prev) => ({ ...prev, [d.id]: e.target.value as DeliveryStatusApi }))
                      }
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Object.entries(statusMap).map(([api, label]) => (
                        <option key={api} value={api}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => void submitStatusUpdate(d)}
                      disabled={statusUpdatingId === d.id}
                    >
                      {statusUpdatingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Update Status
                    </Button>
                    <Button size="sm" variant="outline" className="h-9" onClick={() => openAssign(d)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Assign Rider
                    </Button>
                  </div>
                </div>
              );
            })}
            {!deliveries.length ? <p className="text-sm text-muted-foreground">No deliveries found.</p> : null}
          </div>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Active Riders</h2>
          <div className="space-y-4">
            {riders.map((r) => (
              <div key={r.name} className="rounded-xl border border-border/30 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full gradient-navy flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {r.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {r.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${r.status === "On Route" ? "bg-mint/15 text-mint-foreground" : "bg-muted text-muted-foreground"}`}>
                    {r.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.activeDeliveries} active</span>
                </div>
              </div>
            ))}
            {!riders.length ? <p className="text-sm text-muted-foreground">No rider data yet.</p> : null}
          </div>
        </motion.div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Delivery</DialogTitle>
            <DialogDescription>Create a delivery record and assign rider.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-tracking">Tracking Number</Label>
              <Input
                id="create-tracking"
                value={createForm.trackingNumber}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                placeholder="WA-10021"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-driver-name">Rider Name</Label>
              <Input
                id="create-driver-name"
                value={createForm.driverName}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, driverName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-driver-phone">Rider Phone</Label>
              <Input
                id="create-driver-phone"
                value={createForm.driverPhone}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, driverPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-eta">Estimated Arrival</Label>
              <Input
                id="create-eta"
                type="datetime-local"
                value={createForm.estimatedArrivalAt}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, estimatedArrivalAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-notes">Notes</Label>
              <Input
                id="create-notes"
                value={createForm.notes}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={createSubmitting}>
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {createSubmitting ? "Creating..." : "Create Delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Rider</DialogTitle>
            <DialogDescription>Update rider details for {selectedDelivery?.orderId}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assign-driver-name">Rider Name</Label>
              <Input
                id="assign-driver-name"
                value={assignForm.driverName}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, driverName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-driver-phone">Rider Phone</Label>
              <Input
                id="assign-driver-phone"
                value={assignForm.driverPhone}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, driverPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-eta">Estimated Arrival</Label>
              <Input
                id="assign-eta"
                type="datetime-local"
                value={assignForm.estimatedArrivalAt}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, estimatedArrivalAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-notes">Notes</Label>
              <Input
                id="assign-notes"
                value={assignForm.notes}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assignSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitAssign()} disabled={assignSubmitting}>
              {assignSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {assignSubmitting ? "Saving..." : "Save Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
