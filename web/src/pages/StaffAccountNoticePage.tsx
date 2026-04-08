import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function StaffAccountNoticePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-md mx-4">
        <div className="glass-card-elevated rounded-2xl p-8 md:p-10 text-center">
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
          </button>

          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 mx-auto">
            <ShieldAlert className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Sign Up Unavailable</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Internal accounts are created by an administrator.
          </p>

          <div className="mt-6">
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full h-12 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
