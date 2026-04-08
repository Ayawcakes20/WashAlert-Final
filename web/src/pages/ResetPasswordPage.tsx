import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { firebaseAuthApi } from "@/lib/firebaseAuth";
import { toast } from "@/components/ui/sonner";

const hasUpper = (value: string) => /[A-Z]/.test(value);
const hasLower = (value: string) => /[a-z]/.test(value);
const hasNumber = (value: string) => /\d/.test(value);
const hasSpecial = (value: string) => /[^A-Za-z\d]/.test(value);

type FieldErrors = Partial<Record<"password" | "confirmPassword", string>>;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!completed) return;
    const timer = window.setTimeout(() => navigate("/login"), 1500);
    return () => window.clearTimeout(timer);
  }, [completed, navigate]);

  const rules = useMemo(
    () => [
      { label: "At least 8 characters", ok: password.length >= 8 },
      { label: "Has uppercase letter", ok: hasUpper(password) },
      { label: "Has lowercase letter", ok: hasLower(password) },
      { label: "Has a number", ok: hasNumber(password) },
      { label: "Has special character", ok: hasSpecial(password) },
      { label: "Passwords match", ok: password.length > 0 && password === confirmPassword },
    ],
    [password, confirmPassword],
  );

  const validateForm = (): FieldErrors => {
    const nextErrors: FieldErrors = {};
    if (password.length < 8 || !hasUpper(password) || !hasLower(password) || !hasNumber(password) || !hasSpecial(password)) {
      nextErrors.password = "Password must satisfy all requirements below.";
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    return nextErrors;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!oobCode) {
      const message = "Invalid reset link. Please request a new password reset email.";
      setError(message);
      toast.error(message);
      return;
    }

    const validationErrors = validateForm();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      await firebaseAuthApi.confirmPasswordReset(oobCode, password);
      toast.success("Password reset successful.");
      setCompleted(true);
    } catch (err: any) {
      const message =
        err?.message?.includes("INVALID_OOB_CODE") || err?.message?.includes("EXPIRED_OOB_CODE")
          ? "Reset link is invalid or expired. Request a new one."
          : err?.message || "Unable to reset password.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-md mx-4">
        <div className="glass-card-elevated rounded-2xl p-8 md:p-10">
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
          </button>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Reset Password</h1>
            <p className="text-sm text-muted-foreground mt-1">Set your new account password.</p>
          </div>

          {completed ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/40 bg-muted/40 p-4 text-sm text-foreground">
                Password reset complete. Redirecting to login...
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full h-12 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Go to Login
              </button>
            </div>
          ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: "" }));
                }}
                placeholder="Enter new password"
                className={`w-full h-12 px-4 rounded-xl border bg-muted/30 text-sm text-foreground outline-none focus:ring-2 transition-all ${
                  fieldErrors.password
                    ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                    : "border-border focus:ring-primary/20 focus:border-primary"
                }`}
              />
              {fieldErrors.password ? <p className="text-xs text-destructive mt-1.5">{fieldErrors.password}</p> : null}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                }}
                placeholder="Confirm new password"
                className={`w-full h-12 px-4 rounded-xl border bg-muted/30 text-sm text-foreground outline-none focus:ring-2 transition-all ${
                  fieldErrors.confirmPassword
                    ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                    : "border-border focus:ring-primary/20 focus:border-primary"
                }`}
              />
              {fieldErrors.confirmPassword ? (
                <p className="text-xs text-destructive mt-1.5">{fieldErrors.confirmPassword}</p>
              ) : null}
            </div>

            <div className="rounded-xl bg-muted/40 border border-border/40 p-3 space-y-1.5">
              {rules.map((rule) => (
                <p key={rule.label} className={`text-xs flex items-center gap-2 ${rule.ok ? "text-mint-foreground" : "text-muted-foreground"}`}>
                  {rule.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  {rule.label}
                </p>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-70"
            >
              {submitting ? "Resetting..." : "Reset Password"}
            </button>
          </form>
          )}

          {error ? <p className="text-sm text-destructive text-center mt-4">{error}</p> : null}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Need a new link?{" "}
            <Link to="/forgot-password" className="text-primary font-semibold hover:underline">
              Request Reset
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
