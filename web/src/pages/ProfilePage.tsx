import { useState } from "react";
import { motion } from "framer-motion";
import { UserCircle, Save, Loader2, ShieldCheck, MapPin } from "lucide-react";
import { getSessionUser, saveSessionUser } from "@/lib/session";
import { authApi } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProfilePage() {
  const currentUser = getSessionUser();
  const [fullName, setFullName] = useState(currentUser?.fullName || "");
  const [submitting, setSubmitting] = useState(false);

  // We only allow updating Full Name right now.
  // Emails and Roles are securely tied to Firebase and Admin actions.
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full Name cannot be empty.");
      return;
    }
    
    setSubmitting(true);
    try {
      await authApi.updateProfile({ fullName: fullName.trim() });
      
      // Update local storage session
      if (currentUser) {
        saveSessionUser({ ...currentUser, fullName: fullName.trim() });
      }
      
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Profile Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Aesthetic background accent */}
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <UserCircle size={120} />
        </div>

        <form onSubmit={handleSave} className="space-y-6 relative z-10">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Basic Information
            </h2>
            
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                className="h-11"
              />
            </div>

            <div className="space-y-2 max-w-sm pt-2">
              <Label htmlFor="email" className="text-muted-foreground">Email Address (Read-Only)</Label>
              <Input
                id="email"
                value={currentUser.email}
                readOnly
                className="h-11 bg-muted/30 text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>

          <div className="my-8 h-px bg-border max-w-lg" />

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Account Attributes
            </h2>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card max-w-sm shadow-sm">
                <div className="bg-primary/10 p-2 rounded-md">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Role</p>
                  <p className="text-sm font-semibold text-foreground">{currentUser.role}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card max-w-sm shadow-sm">
                <div className="bg-primary/10 p-2 rounded-md">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Assigned Branch</p>
                  <p className="text-sm font-semibold text-foreground">
                    {currentUser.role === 'ADMIN' ? 'All Branches (Super User)' : (currentUser.branch || 'Unassigned')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <Button
              type="submit"
              disabled={submitting || fullName.trim() === currentUser.fullName}
              className="h-11 px-8 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
