import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { authApi } from "@/lib/api";
import {
  clearFirebaseWebSession,
  getFirebaseWebSession,
  saveSessionUser,
} from "@/lib/session";
import { toast } from "@/components/ui/sonner";

const FALLBACK_COOLDOWN_SECONDS = 60;

export default function LoginOtpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(FALLBACK_COOLDOWN_SECONDS);
  const [error, setError] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const session = useMemo(() => getFirebaseWebSession(), []);
  const queryEmail = searchParams.get("email") || "";

  useEffect(() => {
    if (!session?.idToken) {
      setError("Login session expired. Please sign in again.");
      setTimer(0);
      return;
    }
    if (timer <= 0) {
      return;
    }
    const timeoutId = window.setTimeout(() => setTimer((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [session?.idToken, timer]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError("Enter a valid 6-digit OTP.");
      return;
    }
    if (!session?.idToken) {
      setError("Login session expired. Please sign in again.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const sessionProfile = await authApi.verifyFirebaseLoginOtp({
        idToken: session.idToken,
        platform: "WEB",
        code: trimmedCode,
        selectedBranch: session.selectedBranch,
      });

      const me = await authApi.me().catch(() => ({
        id: sessionProfile.id,
        firebaseUid: sessionProfile.firebaseUid,
        email: sessionProfile.email,
        fullName: sessionProfile.fullName,
        role: sessionProfile.role,
        status: sessionProfile.status,
        branchId: sessionProfile.branchId,
        branch: sessionProfile.branch,
        enabled: sessionProfile.status === "ACTIVE",
        mustChangePassword: false,
        provider: "FIREBASE",
      }));

      saveSessionUser(me);
      // The Firebase idToken/refreshToken were only needed to get through this OTP
      // step — the app now runs on the httpOnly API session cookie. Clearing this
      // here means a non-expiring refresh token doesn't sit in localStorage as
      // XSS loot for the rest of the session.
      clearFirebaseWebSession();
      toast.success("Login successful.");
      navigate("/dashboard");
    } catch (err: any) {
      const message = err?.message || "Unable to verify OTP.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!session?.idToken) {
      setError("Login session expired. Please sign in again.");
      return;
    }
    setResending(true);
    setError("");
    try {
      const challenge = await authApi.resendFirebaseLoginOtp({
        idToken: session.idToken,
        platform: "WEB",
        selectedBranch: session.selectedBranch,
      });
      setMaskedEmail(challenge.email || "");
      setTimer(challenge.resendCooldownSeconds || FALLBACK_COOLDOWN_SECONDS);
      toast.success(challenge.message || "OTP sent to your email.");
    } catch (err: any) {
      const message = err?.message || "Unable to resend OTP.";
      setError(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  const emailForDisplay = maskedEmail || queryEmail || session?.email || "your email";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass-card-elevated rounded-2xl p-8 md:p-10">
          <button
            onClick={() => {
              clearFirebaseWebSession();
              navigate("/login");
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
          </button>

          <div className="flex flex-col items-center mb-7">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Verify Login OTP</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Enter the 6-digit code sent to {emailForDisplay}.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                OTP Code
              </label>
              <input
                type="text"
                value={code}
                maxLength={6}
                onChange={(e) => {
                  const next = e.target.value.replace(/[^\d]/g, "");
                  setCode(next);
                }}
                placeholder="6-digit code"
                className="w-full h-12 px-4 rounded-xl border border-border bg-muted/30 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-70"
            >
              {submitting ? "Verifying..." : "Verify OTP"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending || timer > 0}
            className="w-full mt-3 h-11 rounded-xl border border-border bg-muted/30 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-60"
          >
            {resending ? "Resending..." : timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
          </button>

          {error ? <p className="text-sm text-destructive text-center mt-4">{error}</p> : null}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Need a new sign-in attempt?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Return to Login
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
