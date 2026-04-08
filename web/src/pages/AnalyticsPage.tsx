import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { analyticsApi } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const COLORS = [
  "hsl(218, 58%, 20%)",
  "hsl(168, 55%, 68%)",
  "hsl(42, 52%, 55%)",
  "hsl(215, 16%, 47%)",
];

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

type AnalyticsSummary = {
  fromDate: string;
  toDate: string;
  totalOrders: number;
  pending: number;
  washing: number;
  drying: number;
  ready: number;
  totalRevenue: number;
  peakHour: number | null;
  branchBreakdown: Array<{ branch: string; totalOrders: number; revenue: number }>;
};

const initialDates = () => {
  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setDate(today.getDate() - 7);
  const fromDate = from.toISOString().slice(0, 10);
  return { fromDate, toDate };
};

export default function AnalyticsPage() {
  const { fromDate: defaultFrom, toDate: defaultTo } = initialDates();
  const [filters, setFilters] = useState({
    fromDate: defaultFrom,
    toDate: defaultTo,
    branch: "All",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [knownBranches, setKnownBranches] = useState<string[]>([]);

  const loadSummary = async (nextFilters = filters) => {
    setLoading(true);
    try {
      setError("");
      const data = await analyticsApi.summary({
        fromDate: nextFilters.fromDate,
        toDate: nextFilters.toDate,
        branch: nextFilters.branch,
      });
      setSummary(data);
      const branches = Array.from(new Set((data.branchBreakdown || []).map((b) => b.branch))).filter(Boolean);
      if (branches.length) {
        setKnownBranches(branches.sort((a, b) => a.localeCompare(b)));
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load analytics summary.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revenueData = useMemo(
    () => (summary?.branchBreakdown || []).map((b) => ({ branch: b.branch, revenue: Number(b.revenue || 0) })),
    [summary],
  );

  const weeklyOrders = useMemo(() => {
    if (!summary) return [];
    return [
      { day: "Pending", orders: summary.pending },
      { day: "Washing", orders: summary.washing },
      { day: "Drying", orders: summary.drying },
      { day: "Ready", orders: summary.ready },
    ];
  }, [summary]);

  const serviceBreakdown = useMemo(() => {
    if (!summary) return [];
    const total = Math.max(summary.totalOrders, 1);
    return [
      { name: "Pending", value: Math.round((summary.pending / total) * 100) },
      { name: "Washing", value: Math.round((summary.washing / total) * 100) },
      { name: "Drying", value: Math.round((summary.drying / total) * 100) },
      { name: "Ready", value: Math.round((summary.ready / total) * 100) },
    ];
  }, [summary]);

  const exportCsv = () => {
    if (!summary) {
      toast.error("No analytics data to export.");
      return;
    }

    const lines = [
      ["From", summary.fromDate],
      ["To", summary.toDate],
      ["Total Orders", String(summary.totalOrders)],
      ["Pending", String(summary.pending)],
      ["Washing", String(summary.washing)],
      ["Drying", String(summary.drying)],
      ["Ready", String(summary.ready)],
      ["Total Revenue", String(summary.totalRevenue)],
      ["Peak Hour", summary.peakHour != null ? `${summary.peakHour}:00` : "N/A"],
      [],
      ["Branch", "Orders", "Revenue"],
      ...summary.branchBreakdown.map((b) => [b.branch, String(b.totalOrders), String(b.revenue)]),
    ];

    const csv = lines.map((line) => line.map((col) => `"${String(col ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `washalert-analytics-${summary.fromDate}-to-${summary.toDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Analytics report exported.");
  };

  const applyFilters = async () => {
    if (filters.toDate < filters.fromDate) {
      toast.error("To date cannot be earlier than from date.");
      return;
    }
    await loadSummary(filters);
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Analytics & Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Revenue, order volume, and status metrics across all branches</p>
      </motion.div>

      <motion.div variants={item} className="glass-card rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <input type="date" value={filters.fromDate} onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <input type="date" value={filters.toDate} onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Branch</label>
            <select value={filters.branch} onChange={(e) => setFilters((p) => ({ ...p, branch: e.target.value }))} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1">
              <option value="All">All</option>
              {knownBranches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button className="h-10 rounded-xl gradient-navy w-full" onClick={() => void applyFilters()} disabled={loading}>
              {loading ? "Loading..." : "Apply Filters"}
            </Button>
            <Button variant="outline" className="h-10 px-3" onClick={exportCsv} disabled={!summary}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {loading ? <p className="text-sm text-muted-foreground">Loading analytics...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Revenue (Range)", value: `PHP ${Number(summary?.totalRevenue || 0).toLocaleString()}`, sub: "Based on verified/paid records" },
          { label: "Total Orders (Range)", value: `${summary?.totalOrders || 0}`, sub: "Across selected branches" },
          { label: "Peak Order Hour", value: summary?.peakHour != null ? `${summary.peakHour}:00` : "N/A", sub: "Highest booking activity hour" },
        ].map((s) => (
          <motion.div key={s.label} variants={item} className="glass-card rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="text-3xl font-bold text-foreground mt-2">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Revenue per Branch (PHP)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
              <XAxis dataKey="branch" tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215, 16%, 47%)" }} />
              <Tooltip formatter={(value: number) => `PHP ${value.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="hsl(218, 58%, 20%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Order Status Volume</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyOrders}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
              <Tooltip />
              <Line type="monotone" dataKey="orders" stroke="hsl(168, 55%, 68%)" strokeWidth={3} dot={{ r: 5, fill: "hsl(168, 55%, 68%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={item} className="glass-card rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-6">Order Status Breakdown</h2>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <ResponsiveContainer width={240} height={240}>
              <PieChart>
                <Pie data={serviceBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                  {serviceBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3">
              {serviceBreakdown.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-sm text-foreground font-medium">{s.name}</span>
                  <span className="text-sm text-muted-foreground">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
