import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BellRing, Loader2, Megaphone, Send } from "lucide-react";
import { announcementsApi, type AnnouncementRecord, type AnnouncementType } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const BRANCH_OPTIONS = [
  "Makati Branch",
  "UP Diliman",
  "JP Rizal",
  "S. Catalina",
  "Pasig City",
  "Republic Ave",
  "Chestnut St",
  "Tondo",
  "Samat St",
  "St. Nino",
];

const DELAY_PRESETS: Array<{
  id: string;
  label: string;
  title: string;
  message: string;
  type: AnnouncementType;
}> = [
  {
    id: "weather",
    label: "Weather Delay",
    title: "Weather Delay Advisory",
    message:
      "Service may be delayed due to weather conditions. We are prioritizing safety and will update your order status as soon as possible.",
    type: "GENERAL",
  },
  {
    id: "volume",
    label: "Heavy Volume",
    title: "High Order Volume Notice",
    message:
      "We are currently experiencing a high volume of orders. Some bookings may take longer than usual today.",
    type: "GENERAL",
  },
  {
    id: "early",
    label: "Early Ready",
    title: "Laundry Ready Earlier Than Expected",
    message:
      "Good news. Selected orders are ready earlier than expected. Please check your order status for pickup or delivery updates.",
    type: "GENERAL",
  },
];

const typeLabel: Record<AnnouncementType, string> = {
  CLOSURE: "Closure",
  HOLIDAY: "Holiday",
  GENERAL: "General",
};

const typeStyle: Record<AnnouncementType, string> = {
  CLOSURE: "bg-destructive/10 text-destructive",
  HOLIDAY: "bg-amber-500/15 text-amber-700",
  GENERAL: "bg-primary/10 text-primary",
};

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export default function AnnouncementsPage() {
  const currentUser = getSessionUser();
  const isStaff = currentUser?.role === "STAFF";
  const assignedBranch = currentUser?.branch || "";

  const [rows, setRows] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{
    type: AnnouncementType;
    title: string;
    message: string;
    targetScope: "ALL" | "BRANCH";
    branch: string;
  }>({
    type: "GENERAL",
    title: "",
    message: "",
    targetScope: isStaff ? "BRANCH" : "ALL",
    branch: isStaff ? assignedBranch : "",
  });

  const effectiveBranch = useMemo(() => {
    if (isStaff) return assignedBranch;
    if (form.targetScope === "BRANCH") return form.branch;
    return "";
  }, [isStaff, assignedBranch, form.targetScope, form.branch]);

  const loadAnnouncements = async () => {
    try {
      setError("");
      const data = await announcementsApi.list();
      setRows(data);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Unable to load announcements.");
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await loadAnnouncements();
      setLoading(false);
    };
    void run();
  }, []);

  const submitAnnouncement = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error("Title and message are required.");
      return;
    }
    if ((isStaff || form.targetScope === "BRANCH") && !effectiveBranch) {
      toast.error("Branch is required for branch-targeted announcements.");
      return;
    }

    setSubmitting(true);
    try {
      await announcementsApi.create({
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        branch: (isStaff || form.targetScope === "BRANCH") ? effectiveBranch : undefined,
      });
      toast.success("Announcement published and dispatched.");
      setForm((prev) => ({
        ...prev,
        title: "",
        message: "",
      }));
      await loadAnnouncements();
    } catch (err: any) {
      toast.error(err?.message || "Unable to publish announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (presetId: string) => {
    const preset = DELAY_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      setForm((prev) => ({ ...prev, title: "", message: "", type: "GENERAL" }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      type: preset.type,
      title: preset.title,
      message: preset.message,
    }));
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className="space-y-6"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Publish closure and holiday advisories by branch or for all branches. Announcements are saved in history and pushed to mobile notifications.
        </p>
      </motion.div>

      <motion.div variants={item} className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Create Announcement</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="announcement-type">Type</Label>
            <select
              id="announcement-type"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as AnnouncementType }))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="GENERAL">General</option>
              <option value="CLOSURE">Closure</option>
              <option value="HOLIDAY">Holiday</option>
            </select>
          </div>

          {!isStaff ? (
            <div className="space-y-2">
              <Label htmlFor="announcement-scope">Target Scope</Label>
              <select
                id="announcement-scope"
                value={form.targetScope}
                onChange={(e) => setForm((prev) => ({ ...prev, targetScope: e.target.value as "ALL" | "BRANCH" }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ALL">All Branches</option>
                <option value="BRANCH">Specific Branch</option>
              </select>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Delay Presets</Label>
          <div className="flex flex-wrap gap-2">
            {DELAY_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                className="h-8 rounded-lg"
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-lg"
              onClick={() => applyPreset("custom")}
            >
              Custom
            </Button>
          </div>
        </div>

        {(isStaff || form.targetScope === "BRANCH") ? (
          <div className="space-y-2">
            <Label htmlFor="announcement-branch">Branch</Label>
            {isStaff ? (
              <Input id="announcement-branch" value={effectiveBranch} disabled />
            ) : (
              <select
                id="announcement-branch"
                value={form.branch}
                onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select branch</option>
                {BRANCH_OPTIONS.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="announcement-title">Title</Label>
          <Input
            id="announcement-title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Holiday Hours Advisory"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="announcement-message">Message</Label>
          <Textarea
            id="announcement-message"
            value={form.message}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Write the closure/holiday update for users..."
            className="min-h-24"
          />
        </div>

        <Button onClick={() => void submitAnnouncement()} disabled={submitting} className="h-10 rounded-xl gradient-navy">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Publishing..." : "Publish Announcement"}
        </Button>
      </motion.div>

      <motion.div variants={item} className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BellRing className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Announcement History</p>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading announcements...</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && !rows.length ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-border/40 p-4 bg-muted/20">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeStyle[row.type]}`}>
                    {typeLabel[row.type]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {row.targetAllBranches ? "All branches" : row.branch || "Branch target"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{row.title}</p>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{row.message}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  By {row.createdByName || "System"} - {new Date(row.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
