import { motion } from "framer-motion";
import { QrCode, Package, CheckCircle2, Truck, Clock, MapPin } from "lucide-react";

const bags = [
  { qr: "QR-00481", customer: "Juan Dela Cruz", service: "5kg Wash & Fold", branch: "Makati", status: "In Transit", rider: "Mark Villanueva", eta: "15 min" },
  { qr: "QR-00482", customer: "Maria Santos", service: "3kg Dry Clean", branch: "UP Diliman", status: "At Branch", rider: "—", eta: "—" },
  { qr: "QR-00483", customer: "Pedro Reyes", service: "8kg Wash & Fold", branch: "Pasig", status: "Washing", rider: "—", eta: "—" },
  { qr: "QR-00484", customer: "Ana Garcia", service: "4kg Wash & Iron", branch: "JP Rizal", status: "Ready for Pickup", rider: "Leo Aquino", eta: "25 min" },
  { qr: "QR-00485", customer: "Carlo Mendoza", service: "6kg Wash & Fold", branch: "Chestnut", status: "Delivered", rider: "Mark Villanueva", eta: "Done" },
  { qr: "QR-00486", customer: "Rosa Lim", service: "7kg Wash & Fold", branch: "T.O.N", status: "At Branch", rider: "—", eta: "—" },
];

const statusIcon: Record<string, typeof QrCode> = {
  "In Transit": Truck,
  "At Branch": Package,
  Washing: Clock,
  "Ready for Pickup": CheckCircle2,
  Delivered: CheckCircle2,
};

const statusStyle: Record<string, string> = {
  "In Transit": "bg-accent/20 text-accent-foreground",
  "At Branch": "bg-primary/10 text-primary",
  Washing: "bg-secondary/30 text-secondary-foreground",
  "Ready for Pickup": "bg-mint/20 text-mint-foreground",
  Delivered: "bg-mint/30 text-mint-foreground",
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function QRTrackingPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      className="space-y-8"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">QR Bag Tracking</h1>
        <p className="text-sm text-muted-foreground mt-1">Track laundry bags via QR code across branches and deliveries</p>
      </motion.div>

      {/* Search */}
      <motion.div variants={item} className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <QrCode className="h-8 w-8 text-primary shrink-0" />
        <input
          type="text"
          placeholder="Scan or enter QR code (e.g., QR-00481)"
          className="flex-1 h-12 px-4 rounded-xl border border-border bg-muted/30 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground w-full"
        />
        <button className="h-12 px-6 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shrink-0">
          Track
        </button>
      </motion.div>

      {/* Bag List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {bags.map((b) => {
          const Icon = statusIcon[b.status] || Package;
          return (
            <motion.div key={b.qr} variants={item} className="glass-card rounded-2xl p-5 hover:shadow-[var(--shadow-elevated)] transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-sm font-bold text-primary flex items-center gap-2">
                  <QrCode className="h-4 w-4" />{b.qr}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${statusStyle[b.status]}`}>
                  <Icon className="h-3 w-3" />{b.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">{b.customer}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{b.service}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{b.branch}
                </span>
                {b.rider !== "—" && (
                  <span className="text-xs text-foreground font-medium">
                    {b.rider} · {b.eta}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
