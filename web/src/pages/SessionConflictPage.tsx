import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, LogIn } from "lucide-react";

const AUTO_REDIRECT_SECONDS = 5;

type SessionConflictReason = "replaced" | "signed-out";

const COPY: Record<SessionConflictReason, { title: string; message: string }> = {
  replaced: {
    title: "Session Replaced",
    message:
      "Your session was replaced by another sign-in in this browser. This browser only keeps one active WashAlert login at a time — signing in as a different account here logs this one out.",
  },
  "signed-out": {
    title: "Signed Out",
    message: "You were signed out in another tab of this browser.",
  },
};

export default function SessionConflictPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { reason?: string } | null;
  const reason: SessionConflictReason = state?.reason === "signed-out" ? "signed-out" : "replaced";
  const { title, message } = COPY[reason];

  const [secondsLeft, setSecondsLeft] = useState(AUTO_REDIRECT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate("/login", { replace: true });
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card-elevated rounded-2xl p-8 text-center"
      >
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{message}</p>
        <button
          onClick={() => navigate("/login", { replace: true })}
          className="mt-6 w-full h-11 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2"
        >
          <LogIn className="h-4 w-4" />
          Go to Login
        </button>
        <p className="text-xs text-muted-foreground mt-4">
          Redirecting automatically in {secondsLeft}s...
        </p>
      </motion.div>
    </div>
  );
}
