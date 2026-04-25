import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import logoLaundryHubs from "@/assets/logo-laundryhubs.webp";
import logoSpeedyWash from "@/assets/logo-speedywash.webp";
import { authApi } from "@/lib/api";
import { firebaseAuthApi } from "@/lib/firebaseAuth";
import { saveFirebaseWebSession } from "@/lib/session";
import { toast } from "@/components/ui/sonner";

type LoginField = "email" | "password";
type LoginFieldErrors = Partial<Record<LoginField, string>>;

const toFriendlyLoginMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error || "");
  const normalized = raw.toUpperCase();

  const firebaseBadCredential =
    normalized.includes("INVALID_LOGIN_CREDENTIALS") ||
    normalized.includes("INVALID_CREDENTIAL") ||
    normalized.includes("INVALID_PASSWORD") ||
    normalized.includes("EMAIL_NOT_FOUND") ||
    normalized.includes("USER_NOT_FOUND");

  const backendBadCredential =
    normalized.includes("INCORRECT EMAIL OR PASSWORD") ||
    normalized.includes("EMAIL OR PASSWORD IS INCORRECT") ||
    normalized.includes("BAD CREDENTIALS");

  if (firebaseBadCredential || backendBadCredential) {
    return "Incorrect email or password.";
  }

  return raw || "Unable to sign in right now. Please try again.";
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  const clearFieldError = (field: LoginField) => {
    setFieldErrors((prev) => ({
      ...prev,
      [field]: "",
    }));
  };

  const validateForm = (): LoginFieldErrors => {
    const nextErrors: LoginFieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }

    return nextErrors;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const validationErrors = validateForm();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const firebaseAuth = await firebaseAuthApi.signInWithPassword(email.trim(), password);
      const challenge = await authApi.requestFirebaseLoginOtp({
        idToken: firebaseAuth.idToken,
        platform: "WEB",
      });

      saveFirebaseWebSession({
        idToken: firebaseAuth.idToken,
        refreshToken: firebaseAuth.refreshToken,
        email: firebaseAuth.email,
      });
      const challengeEmail = email.trim();
      toast.success(challenge?.message || "OTP sent to your email.");
      navigate(`/login-otp?email=${encodeURIComponent(challengeEmail)}`);
    } catch (err: any) {
      const message = toFriendlyLoginMessage(err);
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="glass-card-elevated rounded-2xl p-8 md:p-10">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </button>

          <div className="flex flex-col items-center mb-8">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-3 mb-4">
              <img
                src={logoLaundryHubs}
                alt="Triplets"
                className="h-14 w-14 rounded-full object-cover ring-2 ring-secondary/50"
              />
              <img
                src={logoSpeedyWash}
                alt="SpeedyWash"
                className="h-14 w-14 rounded-full object-cover ring-2 ring-secondary/50"
              />
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">WashAlert</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to the Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                placeholder="admin@washalert.ph"
                className={`w-full h-12 px-4 rounded-xl border bg-muted/30 text-sm text-foreground outline-none focus:ring-2 transition-all placeholder:text-muted-foreground ${
                  fieldErrors.email
                    ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                    : "border-border focus:ring-primary/20 focus:border-primary"
                }`}
              />
              {fieldErrors.email ? <p className="text-xs text-destructive mt-1.5">{fieldErrors.email}</p> : null}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError("password");
                  }}
                  placeholder="Enter password"
                  className={`w-full h-12 px-4 pr-12 rounded-xl border bg-muted/30 text-sm text-foreground outline-none focus:ring-2 transition-all placeholder:text-muted-foreground ${
                    fieldErrors.password
                      ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                      : "border-border focus:ring-primary/20 focus:border-primary"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password ? <p className="text-xs text-destructive mt-1.5">{fieldErrors.password}</p> : null}
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-70"
            >
              {submitting ? "Signing In..." : "Sign In"}
            </button>
          </form>

          {error ? <p className="text-sm text-destructive text-center mt-4">{error}</p> : null}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Internal accounts are created by an administrator.
          </p>

          <p className="text-center text-xs text-muted-foreground mt-4">
            WashAlert Copyright 2025 - Triplets LaundryHubs and SpeedyWash
          </p>
        </div>
      </motion.div>
    </div>
  );
}
