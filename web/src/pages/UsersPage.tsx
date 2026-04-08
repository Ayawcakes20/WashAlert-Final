import { motion } from "framer-motion";
import { Shield, UserCog, Search, Plus, Pencil, Loader2, Truck, Mail } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usersApi, type UserAdminRecord } from "@/lib/api";
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
import { Switch } from "@/components/ui/switch";

type Role = "STAFF" | "DRIVER" | "ADMIN";

interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: Role;
  branch: string;
  status: "Pending" | "Active" | "Suspended" | "Deactivated";
  joined: string;
  raw: UserAdminRecord;
}

const roleIcon: Record<Role, typeof UserCog> = {
  STAFF: UserCog,
  DRIVER: Truck,
  ADMIN: Shield,
};

const roleStyle: Record<Role, string> = {
  STAFF: "bg-accent/20 text-accent-foreground",
  DRIVER: "bg-secondary/20 text-secondary-foreground",
  ADMIN: "bg-mint/20 text-mint-foreground",
};

const AVAILABLE_BRANCHES = [
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

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const mapUser = (u: UserAdminRecord): UserRecord => ({
  id: u.id,
  name: u.fullName,
  email: u.email,
  role: (u.role === "DRIVER" ? "DRIVER" : u.role === "ADMIN" ? "ADMIN" : "STAFF") as Role,
  branch: u.branch || "Unassigned",
  status:
    u.status === "PENDING"
      ? "Pending"
      : u.status === "SUSPENDED"
      ? "Suspended"
      : u.status === "DEACTIVATED"
      ? "Deactivated"
      : "Active",
  joined: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-",
  raw: u,
});

const statusDescription: Record<UserRecord["status"], string> = {
  Active: "Can access assigned modules",
  Pending: "Awaiting password setup",
  Suspended: "Temporarily blocked from login",
  Deactivated: "Long-term disabled and removed from active roster",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | UserRecord["status"]>("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    role: "STAFF" as "STAFF" | "DRIVER",
    branch: "",
    initialPassword: "",
    showPassword: false,
  });
  const [createErrors, setCreateErrors] = useState<
    Partial<Record<"fullName" | "email" | "role" | "branch" | "initialPassword", string>>
  >({});

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    branch: "",
    enabled: true,
  });

  const loadUsers = async () => {
    try {
      setError("");
      const data = await usersApi.listStaff();
      setUsers(data.map(mapUser));
    } catch (err: any) {
      setError(err?.message || "Unable to load users.");
      setUsers([]);
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await loadUsers();
      setLoading(false);
    };
    void run();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter(
      (u) =>
        (query.trim()
          ? u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q) ||
            u.branch.toLowerCase().includes(q)
          : true) &&
        (roleFilter === "ALL" ? true : u.role === roleFilter) &&
        (statusFilter === "ALL" ? true : u.status === statusFilter) &&
        (branchFilter === "ALL" ? true : u.branch === branchFilter),
    );
  }, [users, query, roleFilter, statusFilter, branchFilter]);

  const branchOptions = useMemo(() => {
    const unique = Array.from(
      new Set([...AVAILABLE_BRANCHES, ...users.map((u) => u.branch).filter((branch) => branch && branch !== "Unassigned")]),
    );
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [users]);

  const editBranchOptions = useMemo(() => {
    const unique = new Set(AVAILABLE_BRANCHES);
    if (selectedUser?.branch && selectedUser.branch !== "Unassigned") {
      unique.add(selectedUser.branch);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [selectedUser]);

  const openEdit = (user: UserRecord) => {
    setSelectedUser(user);
    setEditForm({
      fullName: user.name,
      email: user.email,
      branch: user.branch === "Unassigned" ? "" : user.branch,
      enabled: user.status === "Active",
    });
    setEditOpen(true);
  };

  const submitCreate = async () => {
    const nextErrors: Partial<Record<"fullName" | "email" | "role" | "branch" | "initialPassword", string>> = {};
    if (!createForm.fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }
    if (!createForm.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!createForm.role) {
      nextErrors.role = "Role is required.";
    }
    if (!AVAILABLE_BRANCHES.length) {
      nextErrors.branch = "No branches available.";
    } else if (!createForm.branch.trim()) {
      nextErrors.branch = "Branch is required.";
    }

    if (createForm.role === "DRIVER") {
      if (!createForm.initialPassword.trim()) {
        nextErrors.initialPassword = "Password is required for driver accounts.";
      } else if (createForm.initialPassword.trim().length < 8) {
        nextErrors.initialPassword = "Password must be at least 8 characters.";
      }
    }

    setCreateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setCreateSubmitting(true);
    try {
      await usersApi.createStaff({
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        branch: createForm.branch.trim() || undefined,
        initialPassword: createForm.role === "DRIVER" ? createForm.initialPassword.trim() || undefined : undefined,
      });
      if (createForm.role === "DRIVER") {
        toast.success("Driver account created. They can now log in on the mobile app.");
      } else {
        toast.success("Invitation sent successfully");
      }
      setCreateOpen(false);
      setCreateForm({ fullName: "", email: "", role: "STAFF", branch: "", initialPassword: "", showPassword: false });
      setCreateErrors({});
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "Unable to create user.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!selectedUser) return;
    if (!editForm.fullName.trim() || !editForm.email.trim()) {
      toast.error("Name and email are required.");
      return;
    }
    if (!editForm.branch.trim()) {
      toast.error("Branch is required.");
      return;
    }

    setEditSubmitting(true);
    try {
      await usersApi.updateStaff(selectedUser.id, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        branch: selectedUser.role === "STAFF" ? editForm.branch.trim() || undefined : undefined,
        enabled: editForm.enabled,
      });
      toast.success("User updated successfully.");
      setEditOpen(false);
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update user.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const updateStatus = async (user: UserRecord, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED") => {
    try {
      await usersApi.updateStatus(user.id, status);
      if (status === "SUSPENDED") {
        toast.success("Account suspended. Login is temporarily blocked.");
      } else if (status === "DEACTIVATED") {
        toast.success("Account deactivated and removed from active roster.");
      } else {
        toast.success("Account reactivated.");
      }
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update user status.");
    }
  };

  const resendInvite = async (user: UserRecord) => {
    try {
      await usersApi.resendInvite(user.id);
      toast.success("Invitation resent successfully.");
      await loadUsers();
    } catch (err: any) {
      toast.error(err?.message || "Unable to resend invite.");
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      className="space-y-8"
    >
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage internal staff and driver accounts</p>
        </div>
        <Button className="h-10 px-5 rounded-xl gradient-navy" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Invite User
        </Button>
      </motion.div>

      <motion.div variants={item} className="flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-2.5 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users by name, email, role, branch..."
          className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
        />
      </motion.div>

      <motion.div variants={item} className="flex flex-wrap items-center gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter((e.target.value as Role | "ALL") || "ALL")}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="ALL">All Roles</option>
          <option value="STAFF">Staff</option>
          <option value="DRIVER">Driver</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter((e.target.value as UserRecord["status"] | "ALL") || "ALL")}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="ALL">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Deactivated">Deactivated</option>
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value || "ALL")}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="ALL">All Branches</option>
          {branchOptions.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>
      </motion.div>

      <motion.div variants={item} className="rounded-xl border border-border/40 bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Suspend</span>: temporary login block.{" "}
          <span className="font-semibold text-foreground">Deactivate</span>: long-term disabled and removed from active roster.
        </p>
      </motion.div>

      {loading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <motion.div variants={item} className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border/50 bg-muted/20">
                <th className="text-left p-4 font-medium">User</th>
                <th className="text-left p-4 font-medium">Role</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Branch</th>
                <th className="text-left p-4 font-medium hidden lg:table-cell">Joined</th>
                <th className="text-center p-4 font-medium">Status</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const RoleIcon = roleIcon[u.role];
                return (
                  <tr key={u.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full gradient-navy flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                          {u.name
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${roleStyle[u.role]}`}>
                        <RoleIcon className="h-3 w-3" />
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground hidden md:table-cell">{u.branch}</td>
                    <td className="p-4 text-muted-foreground hidden lg:table-cell">{u.joined}</td>
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                            u.status === "Active"
                              ? "bg-mint/20 text-mint-foreground"
                              : u.status === "Pending"
                              ? "bg-accent/20 text-accent-foreground"
                              : u.status === "Suspended"
                              ? "bg-destructive/20 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {u.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{statusDescription[u.status]}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        {u.status === "Pending" ? (
                          <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => void resendInvite(u)}>
                            <Mail className="h-3.5 w-3.5" />
                            Resend Invite
                          </Button>
                        ) : null}
                        {u.status === "Active" ? (
                          <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => void updateStatus(u, "SUSPENDED")}>
                            Suspend (Temp)
                          </Button>
                        ) : null}
                        {(u.status === "Suspended" || u.status === "Deactivated") ? (
                          <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => void updateStatus(u, "ACTIVE")}>
                            Reactivate
                          </Button>
                        ) : null}
                        {u.status !== "Deactivated" ? (
                          <Button size="sm" variant="destructive" className="h-8 px-2.5 text-xs" onClick={() => void updateStatus(u, "DEACTIVATED")}>
                            Deactivate (Long-term)
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </motion.div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateErrors({});
            setCreateForm({ fullName: "", email: "", role: "STAFF", branch: "", initialPassword: "", showPassword: false });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Internal User</DialogTitle>
            <DialogDescription>
              {createForm.role === "DRIVER"
                ? "Create a driver account with a direct password. The driver can immediately log in on the mobile app."
                : "Create a pending staff account and send a one-time password setup email."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Full Name</Label>
              <Input
                id="create-name"
                value={createForm.fullName}
                onChange={(e) => {
                  setCreateForm((prev) => ({ ...prev, fullName: e.target.value }));
                  setCreateErrors((prev) => ({ ...prev, fullName: "" }));
                }}
                className={createErrors.fullName ? "border-destructive focus-visible:ring-destructive/30" : ""}
              />
              {createErrors.fullName ? <p className="text-xs text-destructive">{createErrors.fullName}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => {
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }));
                  setCreateErrors((prev) => ({ ...prev, email: "" }));
                }}
                className={createErrors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}
              />
              {createErrors.email ? <p className="text-xs text-destructive">{createErrors.email}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <select
                id="create-role"
                value={createForm.role}
                onChange={(e) => {
                  const value = e.target.value === "DRIVER" ? "DRIVER" : "STAFF";
                  setCreateForm((prev) => ({ ...prev, role: value }));
                  setCreateErrors((prev) => ({ ...prev, role: "" }));
                }}
                className={`w-full h-10 rounded-md border bg-background px-3 text-sm ${
                  createErrors.role ? "border-destructive" : "border-input"
                }`}
              >
                <option value="STAFF">Staff</option>
                <option value="DRIVER">Driver</option>
              </select>
              {createErrors.role ? <p className="text-xs text-destructive">{createErrors.role}</p> : null}
            </div>
            <div className="space-y-2">
                <Label htmlFor="create-branch">Branch</Label>
                <select
                  id="create-branch"
                  value={createForm.branch}
                  onChange={(e) => {
                    setCreateForm((prev) => ({ ...prev, branch: e.target.value }));
                    setCreateErrors((prev) => ({ ...prev, branch: "" }));
                  }}
                  disabled={!AVAILABLE_BRANCHES.length}
                  className={`w-full h-10 rounded-md border bg-background px-3 text-sm ${
                    createErrors.branch ? "border-destructive" : "border-input"
                  }`}
                >
                  <option value="">
                    {AVAILABLE_BRANCHES.length ? "Select branch" : "No branches available"}
                  </option>
                  {AVAILABLE_BRANCHES.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
                {!AVAILABLE_BRANCHES.length ? <p className="text-xs text-muted-foreground">No branches available</p> : null}
                {createErrors.branch ? <p className="text-xs text-destructive">{createErrors.branch}</p> : null}
              </div>
            {createForm.role === "DRIVER" && (
              <div className="space-y-2">
                <Label htmlFor="create-password">Initial Password</Label>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={createForm.showPassword ? "text" : "password"}
                    value={createForm.initialPassword}
                    onChange={(e) => {
                      setCreateForm((prev) => ({ ...prev, initialPassword: e.target.value }));
                      setCreateErrors((prev) => ({ ...prev, initialPassword: "" }));
                    }}
                    placeholder="Min. 8 characters"
                    className={createErrors.initialPassword ? "border-destructive pr-10" : "pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setCreateForm((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {createForm.showPassword ? "🙈" : "👁"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Driver will use this password to log in on the mobile app.</p>
                {createErrors.initialPassword ? <p className="text-xs text-destructive">{createErrors.initialPassword}</p> : null}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={createSubmitting}>
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {createSubmitting
                ? (createForm.role === "DRIVER" ? "Creating..." : "Sending Invite...")
                : (createForm.role === "DRIVER" ? "Create Driver Account" : "Send Invitation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update staff account details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.fullName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch">Branch</Label>
              <select
                id="edit-branch"
                value={editForm.branch}
                onChange={(e) => setEditForm((prev) => ({ ...prev, branch: e.target.value }))}
                disabled={selectedUser?.role !== "STAFF" || !editBranchOptions.length}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{editBranchOptions.length ? "Select branch" : "No branches available"}</option>
                {editBranchOptions.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
              {!editBranchOptions.length ? <p className="text-xs text-muted-foreground">No branches available</p> : null}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
              <Label htmlFor="edit-enabled">Account Enabled</Label>
              <Switch
                id="edit-enabled"
                checked={editForm.enabled}
                onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void submitEdit()} disabled={editSubmitting}>
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {editSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
