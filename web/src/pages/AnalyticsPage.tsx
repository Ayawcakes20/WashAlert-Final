import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { analyticsApi } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Download, Sparkles, Loader2, TrendingUp } from "lucide-react";

const COLORS = [
  "hsl(218, 58%, 20%)",
  "hsl(168, 55%, 68%)",
  "hsl(42, 52%, 55%)",
  "hsl(215, 16%, 47%)",
];

const PAYMENT_COLORS: Record<string, string> = {
  GCASH: "hsl(220, 82%, 48%)",
  MAYA: "hsl(168, 60%, 40%)",
  CASH: "hsl(42, 80%, 52%)",
};

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
  hourlyBreakdown?: Record<string, number>;
  paymentMethodBreakdown?: Record<string, number>;
};

const PERIOD_PRESETS = [
  { label: "Today", getDates: () => { const d = new Date().toISOString().slice(0, 10); return { from: d, to: d }; } },
  {
    label: "This Week",
    getDates: () => {
      const to = new Date(); const from = new Date(to); from.setDate(to.getDate() - 6);
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
    },
  },
  {
    label: "This Month",
    getDates: () => {
      const to = new Date(); const from = new Date(to); from.setDate(1);
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
    },
  },
];

const suggestedQuestions = [
  "Which branch earned the most revenue?",
  "What is the peak booking hour?",
  "How many orders are in progress?",
  "What is the most used payment method?",
  "Which branch has the most orders?",
];
const EXPORT_INTENT_REGEX = /\b(export|excel|csv|pdf|report|download|document)\b/i;

const initialDates = () => {
  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setDate(today.getDate() - 7);
  return { fromDate: from.toISOString().slice(0, 10), toDate };
};

export default function AnalyticsPage() {
  const { fromDate: defaultFrom, toDate: defaultTo } = initialDates();
  const [activePeriod, setActivePeriod] = useState("This Week");
  const [filters, setFilters] = useState({ fromDate: defaultFrom, toDate: defaultTo, branch: "All" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [knownBranches, setKnownBranches] = useState<string[]>([]);

  // NLQ state
  const [nlqQuestion, setNlqQuestion] = useState("");
  const [nlqAnswer, setNlqAnswer] = useState("");
  const [nlqLoading, setNlqLoading] = useState(false);
  const [showExportChooser, setShowExportChooser] = useState(false);

  const loadSummary = async (nextFilters = filters) => {
    setLoading(true);
    try {
      setError("");
      const data = await analyticsApi.summary({
        fromDate: nextFilters.fromDate,
        toDate: nextFilters.toDate,
        branch: nextFilters.branch,
      });
      setSummary(data as AnalyticsSummary);
      const brs = Array.from(new Set((data.branchBreakdown || []).map((b) => b.branch))).filter(Boolean);
      if (brs.length) setKnownBranches(brs.sort((a, b) => a.localeCompare(b)));
    } catch (err: any) {
      setError(err?.message || "Unable to load analytics summary.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadSummary(); }, []); // eslint-disable-line

  const applyPeriod = (preset: typeof PERIOD_PRESETS[0]) => {
    const { from, to } = preset.getDates();
    const next = { ...filters, fromDate: from, toDate: to };
    setActivePeriod(preset.label);
    setFilters(next);
    void loadSummary(next);
  };

  const applyFilters = async () => {
    if (filters.toDate < filters.fromDate) { toast.error("To date cannot be earlier than from date."); return; }
    setActivePeriod("Custom");
    await loadSummary(filters);
  };

  const revenueData = useMemo(() => (summary?.branchBreakdown || []).map((b) => ({ branch: b.branch, revenue: Number(b.revenue || 0) })), [summary]);

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

  const peakHoursData = useMemo(() => {
    if (!summary?.hourlyBreakdown) {
      // Fallback: highlight just the single peakHour
      if (summary?.peakHour != null) {
        return [{ hour: `${String(summary.peakHour).padStart(2, "0")}:00`, bookings: 1 }];
      }
      return [];
    }
    return Object.entries(summary.hourlyBreakdown)
      .map(([hour, bookings]) => ({ hour, bookings }))
      .filter((_, i) => i % 2 === 0); // Show every 2nd hour to prevent label crowding
  }, [summary]);

  const paymentData = useMemo(() => {
    if (!summary?.paymentMethodBreakdown) return [];
    return Object.entries(summary.paymentMethodBreakdown)
      .map(([method, count]) => ({ method, count, label: method === "GCASH" ? "GCash" : method === "MAYA" ? "Maya" : "Cash" }))
      .filter((d) => d.count > 0);
  }, [summary]);

  const buildReportMeta = () => {
    if (!summary) return null;
    const generatedAt = new Date();
    return {
      generatedAtText: generatedAt.toLocaleString(),
      fromDate: summary.fromDate,
      toDate: summary.toDate,
      totalRevenue: Number(summary.totalRevenue || 0),
      totalOrders: Number(summary.totalOrders || 0),
      pending: Number(summary.pending || 0),
      washing: Number(summary.washing || 0),
      drying: Number(summary.drying || 0),
      ready: Number(summary.ready || 0),
      peakHourText: summary.peakHour != null ? `${summary.peakHour}:00 - ${summary.peakHour + 1}:00` : "N/A",
      branchBreakdown: summary.branchBreakdown || [],
      paymentBreakdown: summary.paymentMethodBreakdown || {},
    };
  };

  // NLQ: generate context-aware answers from real data
  const handleNlqGenerate = () => {
    if (!nlqQuestion.trim()) return;
    if (!summary) { setNlqAnswer("No analytics data loaded. Please apply a date range first."); return; }
    if (EXPORT_INTENT_REGEX.test(nlqQuestion)) {
      setShowExportChooser(true);
      setNlqAnswer("Choose report format to export analytics data.");
      return;
    }
    setShowExportChooser(false);
    setNlqLoading(true);
    setNlqAnswer("");

    setTimeout(() => {
      const q = nlqQuestion.toLowerCase();
      const topRevenueBranch = (summary.branchBreakdown || []).reduce(
        (max, b) => (b.revenue > max.revenue ? b : max),
        { branch: "N/A", revenue: 0, totalOrders: 0 }
      );
      const topOrderBranch = (summary.branchBreakdown || []).reduce(
        (max, b) => (b.totalOrders > max.totalOrders ? b : max),
        { branch: "N/A", revenue: 0, totalOrders: 0 }
      );
      const topPaymentMethod = paymentData.length
        ? paymentData.reduce((max, p) => (p.count > max.count ? p : max))
        : null;

      let answer = "";
      if (q.includes("revenue") || q.includes("earned") || q.includes("most revenue")) {
        answer = topRevenueBranch.branch === "N/A"
          ? "No verified revenue data is available for this period."
          : `${topRevenueBranch.branch} earned the most revenue at PHP ${Number(topRevenueBranch.revenue).toLocaleString()} during the selected period, with ${topRevenueBranch.totalOrders} orders.`;
      } else if (q.includes("peak") || q.includes("hour") || q.includes("busiest")) {
        answer = summary.peakHour != null
          ? `The peak booking hour is ${summary.peakHour}:00 - ${summary.peakHour + 1}:00. This is when most customers place their orders.`
          : "No peak hour data is available yet for this period.";
      } else if (q.includes("in progress") || q.includes("washing") || q.includes("drying")) {
        answer = `Currently there are ${summary.washing} orders being washed and ${summary.drying} being dried. ${summary.pending} are still pending and ${summary.ready} are ready for pickup.`;
      } else if (q.includes("payment") || q.includes("gcash") || q.includes("maya") || q.includes("cash")) {
        answer = topPaymentMethod
          ? `The most used payment method is ${topPaymentMethod.label} with ${topPaymentMethod.count} verified transactions in this period.`
          : "No verified payment transactions were found in this period.";
      } else if (q.includes("most orders") || q.includes("busiest branch")) {
        answer = topOrderBranch.branch === "N/A"
          ? "No order data is available for this period."
          : `${topOrderBranch.branch} has the most orders with ${topOrderBranch.totalOrders} bookings and PHP ${Number(topOrderBranch.revenue).toLocaleString()} revenue.`;
      } else {
        answer = `For the period ${summary.fromDate} to ${summary.toDate}: Total orders = ${summary.totalOrders}, Total revenue = PHP ${Number(summary.totalRevenue).toLocaleString()}, Peak hour = ${summary.peakHour != null ? `${summary.peakHour}:00` : "N/A"}. Top branch by revenue: ${topRevenueBranch.branch}.`;
      }
      setNlqAnswer(answer);
      setNlqLoading(false);
    }, 1000);
  };

  const exportCsv = () => {
    const report = buildReportMeta();
    if (!report) { toast.error("No analytics data to export."); return; }
    const lines = [
      ["Generated At", report.generatedAtText],
      ["From", report.fromDate], ["To", report.toDate],
      ["Total Revenue", String(report.totalRevenue)], ["Total Orders", String(report.totalOrders)],
      ["Pending", String(report.pending)], ["Washing", String(report.washing)],
      ["Drying", String(report.drying)], ["Ready", String(report.ready)],
      ["Peak Booking Hours", report.peakHourText], [],
      ["Branch", "Orders", "Revenue"],
      ...report.branchBreakdown.map((b) => [b.branch, String(b.totalOrders), String(b.revenue)]),
    ];
    if (report.paymentBreakdown) {
      lines.push([], ["Payment Method", "Count"]);
      Object.entries(report.paymentBreakdown).forEach(([k, v]) => lines.push([k, String(v)]));
    }
    const csv = lines.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `washalert-analytics-${report.fromDate}-to-${report.toDate}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Analytics report exported.");
  };

  const exportDocument = () => {
    const report = buildReportMeta();
    if (!report) { toast.error("No analytics data to export."); return; }
    const branchLines = report.branchBreakdown.length
      ? report.branchBreakdown.map((b) => `- ${b.branch}: ${b.totalOrders} orders, PHP ${Number(b.revenue || 0).toLocaleString()}`).join("\n")
      : "- No branch performance data";
    const paymentLines = Object.keys(report.paymentBreakdown).length
      ? Object.entries(report.paymentBreakdown).map(([method, count]) => `- ${method}: ${count}`).join("\n")
      : "- No payment method data";
    const text = [
      "WashAlert Analytics Report",
      `Generated: ${report.generatedAtText}`,
      `Date Range: ${report.fromDate} to ${report.toDate}`,
      "",
      `Revenue Summary: PHP ${report.totalRevenue.toLocaleString()}`,
      `Order Count: ${report.totalOrders}`,
      `Peak Booking Hours: ${report.peakHourText}`,
      "",
      "Branch Performance:",
      branchLines,
      "",
      "Payment Methods:",
      paymentLines,
      "",
      "Status Breakdown:",
      `- Pending: ${report.pending}`,
      `- Washing: ${report.washing}`,
      `- Drying: ${report.drying}`,
      `- Ready: ${report.ready}`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `washalert-analytics-${report.fromDate}-to-${report.toDate}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Document export generated.");
  };

  const exportPdf = () => {
    const report = buildReportMeta();
    if (!report) { toast.error("No analytics data to export."); return; }
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      toast.error("Unable to open print preview. Please allow popups.");
      return;
    }
    const branchRows = report.branchBreakdown.length
      ? report.branchBreakdown.map((b) =>
        `<tr><td style="padding:8px;border:1px solid #d1d5db;">${b.branch}</td><td style="padding:8px;border:1px solid #d1d5db;">${b.totalOrders}</td><td style="padding:8px;border:1px solid #d1d5db;">PHP ${Number(b.revenue || 0).toLocaleString()}</td></tr>`
      ).join("")
      : `<tr><td colspan="3" style="padding:8px;border:1px solid #d1d5db;">No branch performance data</td></tr>`;
    const paymentRows = Object.keys(report.paymentBreakdown).length
      ? Object.entries(report.paymentBreakdown).map(([k, v]) =>
        `<tr><td style="padding:8px;border:1px solid #d1d5db;">${k}</td><td style="padding:8px;border:1px solid #d1d5db;">${v}</td></tr>`
      ).join("")
      : `<tr><td colspan="2" style="padding:8px;border:1px solid #d1d5db;">No payment method data</td></tr>`;

    popup.document.write(`
      <html>
        <head><title>WashAlert Analytics Report</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px; color: #111827;">
          <h1>WashAlert Analytics Report</h1>
          <p><strong>Generated:</strong> ${report.generatedAtText}</p>
          <p><strong>Date Range:</strong> ${report.fromDate} to ${report.toDate}</p>
          <h2>Summary</h2>
          <p><strong>Revenue:</strong> PHP ${report.totalRevenue.toLocaleString()}</p>
          <p><strong>Order Count:</strong> ${report.totalOrders}</p>
          <p><strong>Peak Booking Hours:</strong> ${report.peakHourText}</p>
          <h2>Branch Performance</h2>
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:left;">Branch</th>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:left;">Orders</th>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:left;">Revenue</th>
              </tr>
            </thead>
            <tbody>${branchRows}</tbody>
          </table>
          <h2>Payment Methods</h2>
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 16px;">
            <thead>
              <tr>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:left;">Method</th>
                <th style="padding:8px;border:1px solid #d1d5db;text-align:left;">Count</th>
              </tr>
            </thead>
            <tbody>${paymentRows}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
    toast.success("Print view opened for PDF export.");
  };

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-8">
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">AI Analytics & Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time dashboards, revenue breakdown, and natural language insights</p>
      </motion.div>

      {/* Period presets */}
      <motion.div variants={item} className="flex flex-wrap gap-2">
        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPeriod(preset)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activePeriod === preset.label
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setActivePeriod("Custom")}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            activePeriod === "Custom"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          Custom
        </button>
      </motion.div>

      {/* Filter bar */}
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
              {knownBranches.map((branch) => (<option key={branch} value={branch}>{branch}</option>))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button className="h-10 rounded-xl gradient-navy w-full" onClick={() => void applyFilters()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Loading..." : "Apply Filters"}
            </Button>
            <Button variant="outline" className="h-10 px-3" onClick={exportCsv} disabled={!summary} title="Export CSV">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Revenue (Range)", value: `PHP ${Number(summary?.totalRevenue || 0).toLocaleString()}`, sub: "Verified & paid orders only" },
          { label: "Total Orders (Range)", value: `${summary?.totalOrders || 0}`, sub: "Across selected branches" },
          { label: "Peak Order Hour", value: summary?.peakHour != null ? `${summary.peakHour}:00 - ${summary.peakHour + 1}:00` : "N/A", sub: "Highest booking activity window" },
        ].map((s) => (
          <motion.div key={s.label} variants={item} className="glass-card rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="text-3xl font-bold text-foreground mt-2">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Revenue per Branch (PHP)</h2>
          <ResponsiveContainer width="100%" height={280}>
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
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weeklyOrders}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }} />
              <Tooltip />
              <Line type="monotone" dataKey="orders" stroke="hsl(168, 55%, 68%)" strokeWidth={3} dot={{ r: 5, fill: "hsl(168, 55%, 68%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status Breakdown Donut */}
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Order Status Breakdown</h2>
          <div className="flex justify-center">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={serviceBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} dataKey="value">
                  {serviceBreakdown.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {serviceBreakdown.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} /><span className="text-sm text-foreground">{s.name}</span></div>
                <span className="text-sm text-muted-foreground">{s.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Payment Methods Pie */}
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Payment Methods</h2>
          {paymentData.length > 0 ? (
            <>
              <div className="flex justify-center">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" outerRadius={85} paddingAngle={4} dataKey="count">
                      {paymentData.map((d) => (<Cell key={d.method} fill={PAYMENT_COLORS[d.method] || COLORS[2]} />))}
                    </Pie>
                    <Tooltip formatter={(v: number, _name: string, props: any) => [v, props.payload?.label || props.payload?.method]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                {paymentData.map((d) => (
                  <div key={d.method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[d.method] }} /><span className="text-sm text-foreground">{d.label}</span></div>
                    <span className="text-sm text-muted-foreground">{d.count} transactions</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground gap-2">
              <TrendingUp className="h-8 w-8 opacity-30" />
              <p className="text-sm">No verified payment data for this period</p>
            </div>
          )}
        </motion.div>

        {/* Peak Booking Hours */}
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Peak Booking Hours</h2>
          {peakHoursData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={peakHoursData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 25%, 90%)" />
                <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(215, 16%, 47%)" }} />
                <YAxis dataKey="hour" type="category" tick={{ fontSize: 9, fill: "hsl(215, 16%, 47%)" }} width={46} />
                <Tooltip formatter={(v: number) => [v, "Bookings"]} />
                <Bar dataKey="bookings" fill="hsl(218, 58%, 20%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground gap-2">
              <TrendingUp className="h-8 w-8 opacity-30" />
              <p className="text-sm">No hourly distribution data yet</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Natural Language Q&A */}
      <motion.div variants={item} className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Ask a Question</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Use natural language to generate insights from your actual branch data</p>

        <div className="flex gap-3 mb-4">
          <textarea
            value={nlqQuestion}
            onChange={(e) => setNlqQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleNlqGenerate(); } }}
            placeholder="e.g. Which branch earned the most revenue?"
            className="flex-1 px-4 py-3 border border-border rounded-xl text-sm bg-background text-foreground resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground"
            rows={2}
          />
          <button
            onClick={handleNlqGenerate}
            disabled={nlqLoading || !summary}
            className="px-5 py-2 gradient-navy text-primary-foreground rounded-xl text-sm font-medium self-end disabled:opacity-50 flex items-center gap-2"
          >
            {nlqLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {nlqLoading ? "..." : "Generate"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => setNlqQuestion(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {nlqLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your data...
          </div>
        )}
        {nlqAnswer && (
          <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl text-sm text-foreground leading-relaxed">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p>{nlqAnswer}</p>
            </div>
          </div>
        )}
        {showExportChooser && summary ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">Choose report format</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={exportCsv}>
                Export CSV (Excel-compatible)
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={exportPdf}>
                Export PDF
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={exportDocument}>
                Export Document
              </Button>
            </div>
          </div>
        ) : null}
        {!summary && !loading && (
          <p className="text-xs text-muted-foreground">Apply a date range to enable data-driven Q&A.</p>
        )}
      </motion.div>
    </motion.div>
  );
}
