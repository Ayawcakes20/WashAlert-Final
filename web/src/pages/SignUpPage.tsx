import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, ChevronDown, ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { motion } from "framer-motion";
import logoLaundryHubs from "@/assets/logo-laundryhubs.webp";
import logoSpeedyWash from "@/assets/logo-speedywash.webp";
import { authApi } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const branches = [
  { name: "Triplets LaundryHubs - Makati", brand: "triplets" },
  { name: "SpeedyWash - UP Diliman", brand: "speedywash" },
  { name: "SpeedyWash - JP Rizal", brand: "speedywash" },
  { name: "SpeedyWash - S. Catalina", brand: "speedywash" },
  { name: "SpeedyWash - Pasig", brand: "speedywash" },
  { name: "SpeedyWash - Republic", brand: "speedywash" },
  { name: "SpeedyWash - Chestnut", brand: "speedywash" },
  { name: "SpeedyWash - T.O.N", brand: "speedywash" },
  { name: "SpeedyWash - Samat", brand: "speedywash" },
  { name: "SpeedyWash - St. Nino", brand: "speedywash" },
];

type SignUpField = "branch" | "fullName" | "email" | "role" | "password";
type SignUpFieldErrors = Partial<Record<SignUpField, string>>;

export default function SignUpPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [branch, setBranch] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({});

  const selectedBranch = branches.find((b) => b.name === branch);
  const activeLogo =
    selectedBranch?.brand === "triplets"
      ? logoLaundryHubs
      : selectedBranch?.brand === "speedywash"
      ? logoSpeedyWash
      : null;
  const brandName =
    selectedBranch?.brand === "triplets"
      ? "Triplets LaundryHubs"
      : selectedBranch?.brand === "speedywash"
      ? "SpeedyWash"
      : null;

  const passwordRules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Has uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Has lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Has a number", ok: /\d/.test(password) },
    { label: "Has special character", ok: /[^A-Za-z\d]/.test(password) },
  ];
  const passwordValid = passwordRules.every((rule) => rule.ok);

  const setFieldError = (field: SignUpField) => {
    setFieldErrors((prev) => ({
      ...prev,
      [field]: "",
    }));
  };

  const validateForm = (): SignUpFieldErrors => {
    const nextErrors: SignUpFieldErrors = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedBranch = branch.trim();
    const trimmedRole = role.trim();

    if (!trimmedBranch) {
      nextErrors.branch = "Branch is required.";
    }
    if (!trimmedName) {
      nextErrors.fullName = "Full name is required.";
    } else if (trimmedName.length < 2) {
      nextErrors.fullName = "Full name must be at least 2 characters.";
    }
    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!trimmedRole) {
      nextErrors.role = "Role is required.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (!passwordValid) {
      nextErrors.password = "Password must meet all requirements below.";
    }

    return nextErrors;
  };

  const handleSignUp = async (e: React.FormEvent) => {
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
      await authApi.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      toast.success("Account created. Verify your OTP before signing in.");
      navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      const message = err?.message || "Registration failed. Please try again.";
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
            <motion.div
              key={activeLogo || "default"}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-3 mb-4"
            >
              {activeLogo ? (
                <img
                  src={activeLogo}
                  alt={brandName || ""}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/30 shadow-lg"
                />
              ) : (
                <>
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
                </>
              )}
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {brandName ? `Join ${brandName}` : "Create Account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Register for WashAlert Management System</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Branch
              </label>
              <div className="relative">
                <select
                  value={branch}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    setFieldError("branch");
                  }}
                  className={`w-full h-12 px-4 pr-10 rounded-xl border bg-muted/30 text-sm text-foreground appearance-none outline-none focus:ring-2 transition-all ${
                    fieldErrors.branch
                      ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                      : "border-border focus:ring-primary/20 focus:border-primary"
                  }`}
                >
                  <option value="">Select your branch</option>
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {fieldErrors.branch ? <p className="text-xs text-destructive mt-1.5">{fieldErrors.branch}</p> : null}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setFieldError("fullName");
                }}
                placeholder="Juan Dela Cruz"
                className={`w-full h-12 px-4 rounded-xl border bg-muted/30 text-sm text-foreground outline-none focus:ring-2 transition-all placeholder:text-muted-foreground ${
                  fieldErrors.fullName
                    ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                    : "border-border focus:ring-primary/20 focus:border-primary"
                }`}
              />
              {fieldErrors.fullName ? <p className="text-xs text-destructive mt-1.5">{fieldErrors.fullName}</p> : null}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldError("email");
                }}
                placeholder="juan@washalert.ph"
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
                Role
              </label>
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setFieldError("role");
                  }}
                  className={`w-full h-12 px-4 pr-10 rounded-xl border bg-muted/30 text-sm text-foreground appearance-none outline-none focus:ring-2 transition-all ${
                    fieldErrors.role
                      ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                      : "border-border focus:ring-primary/20 focus:border-primary"
                  }`}
                >
                  <option value="">Select your role</option>
                  <option value="admin">Administrator</option>
                  <option value="staff">Staff</option>
                  <option value="driver">Driver / Rider</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {fieldErrors.role ? <p className="text-xs text-destructive mt-1.5">{fieldErrors.role}</p> : null}
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
                    setFieldError("password");
                  }}
                  placeholder="Enter your password"
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

            <div className="rounded-xl bg-muted/40 border border-border/40 p-3 space-y-1.5">
              {passwordRules.map((rule) => (
                <p
                  key={rule.label}
                  className={`text-xs flex items-center gap-2 ${rule.ok ? "text-mint-foreground" : "text-muted-foreground"}`}
                >
                  {rule.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  {rule.label}
                </p>
              ))}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 disabled:opacity-70"
            >
              {submitting ? "Creating..." : "Create Account"}
            </button>
          </form>

          {error ? <p className="text-sm text-destructive text-center mt-4">{error}</p> : null}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign In
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground mt-4">
            WashAlert Copyright 2025 - Triplets LaundryHubs and SpeedyWash
          </p>
        </div>
      </motion.div>
    </div>
  );
}
