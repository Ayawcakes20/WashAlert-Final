import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MailCheck } from "lucide-react";
import { authApi } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await authApi.verifyEmailOtp({ email: email.trim(), code: code.trim() });
      toast.success("Email verified successfully.");
      navigate("/login");
    } catch (err: any) {
      const message = err?.message || "Unable to verify OTP.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (!email.trim()) {
      setError("Please enter your email first.");
      return;
    }
    setError("");
    setResending(true);
    try {
      await authApi.resendOtp({ email: email.trim() });
      toast.success("OTP sent. Please check your inbox.");
    } catch (err: any) {
      const message = err?.message || "Unable to resend OTP.";
      setError(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

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
            onClick={() => navigate("/signup")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign Up
          </button>

          <div className="flex flex-col items-center mb-7">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Verify Email OTP</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Enter the verification code sent to your email address.
            </p>
          </div>

          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-12 px-4 rounded-xl border border-border bg-muted/30 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">OTP Code</label>
              <input
                type="text"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value)}
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
            onClick={() => void resendOtp()}
            disabled={resending}
            className="w-full mt-3 h-11 rounded-xl border border-border bg-muted/30 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-60"
          >
            {resending ? "Resending..." : "Resend OTP"}
          </button>

          {error ? <p className="text-sm text-destructive text-center mt-4">{error}</p> : null}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already verified?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
