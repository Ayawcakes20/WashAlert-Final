import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { WashingMachine, Wind, AlertTriangle, CheckCircle2, Wrench, Clock } from "lucide-react";
import { machinesApi } from "@/lib/api";

interface Machine {
  id: number;
  machineId: string;
  type: "WASHER" | "DRYER";
  branch: string;
  status: "AVAILABLE" | "IN_USE" | "MAINTENANCE";
  updatedAt: string;
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  AVAILABLE: { icon: CheckCircle2, color: "text-mint", bg: "bg-mint/15", label: "Available" },
  IN_USE: { icon: Clock, color: "text-primary", bg: "bg-primary/10", label: "In Use" },
  MAINTENANCE: { icon: Wrench, color: "text-accent", bg: "bg-accent/15", label: "Maintenance" },
};

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function MachineMonitoringPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const data = await machinesApi.list();
        setMachines(data as Machine[]);
      } catch (err: any) {
        setError(err?.message || "Unable to load machines.");
        setMachines([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const branchGroups = useMemo(() => {
    return machines.reduce((acc, m) => {
      if (!acc[m.branch]) acc[m.branch] = [];
      acc[m.branch].push(m);
      return acc;
    }, {} as Record<string, Machine[]>);
  }, [machines]);

  const totalAvailable = machines.filter((m) => m.status === "AVAILABLE").length;
  const totalInUse = machines.filter((m) => m.status === "IN_USE").length;
  const totalMaintenance = machines.filter((m) => m.status === "MAINTENANCE").length;

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Machine Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time washer and dryer availability, utilization, and maintenance status</p>
      </motion.div>

      {loading ? <p className="text-sm text-muted-foreground">Loading machines...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Machines", value: machines.length, icon: WashingMachine, color: "bg-primary/10 text-primary" },
          { label: "Available", value: totalAvailable, icon: CheckCircle2, color: "bg-mint/15 text-mint" },
          { label: "In Use", value: totalInUse, icon: Clock, color: "bg-accent/15 text-accent" },
          { label: "Maintenance", value: totalMaintenance, icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
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

      {Object.entries(branchGroups).map(([branch, branchMachines]) => (
        <motion.div key={branch} variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">{branch}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchMachines.map((m) => {
              const cfg = statusConfig[m.status];
              const StatusIcon = cfg.icon;
              return (
                <div key={m.id} className={`rounded-xl p-4 border border-border/30 ${cfg.bg} transition-all hover:shadow-md`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {m.type === "WASHER" ? <WashingMachine className="h-5 w-5 text-foreground" /> : <Wind className="h-5 w-5 text-foreground" />}
                      <div>
                        <span className="text-sm font-bold text-foreground">{m.machineId}</span>
                        <span className="text-xs text-muted-foreground ml-2">{m.type === "WASHER" ? "Washer" : "Dryer"}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>
                      <StatusIcon className="h-3 w-3" /> {cfg.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2">
                    Last update: {m.updatedAt ? new Date(m.updatedAt).toLocaleString() : "-"}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
