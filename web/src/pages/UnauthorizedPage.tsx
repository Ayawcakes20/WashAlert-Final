import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card-elevated rounded-2xl p-8 text-center"
      >
        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldX className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Access Restricted</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Your account does not have permission to open this module.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-6 w-full h-11 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Go to Dashboard
        </button>
      </motion.div>
    </div>
  );
}
