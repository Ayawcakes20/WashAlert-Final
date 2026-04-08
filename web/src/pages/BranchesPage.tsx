import { motion } from "framer-motion";
import { MapPin, Users, ShoppingCart, Bike, Wifi, WifiOff } from "lucide-react";

const branches = [
  { name: "Triplets LaundryHubs", location: "Makati", brand: "laundryhubs", capacity: 85, orders: 24, riders: 3, online: true },
  { name: "SpeedyWash", location: "UP Diliman", brand: "speedywash", capacity: 72, orders: 18, riders: 2, online: true },
  { name: "SpeedyWash", location: "JP Rizal", brand: "speedywash", capacity: 90, orders: 31, riders: 4, online: true },
  { name: "SpeedyWash", location: "S. Catalina", brand: "speedywash", capacity: 45, orders: 12, riders: 1, online: true },
  { name: "SpeedyWash", location: "Pasig", brand: "speedywash", capacity: 68, orders: 22, riders: 3, online: true },
  { name: "SpeedyWash", location: "Republic", brand: "speedywash", capacity: 55, orders: 14, riders: 2, online: false },
  { name: "SpeedyWash", location: "Chestnut", brand: "speedywash", capacity: 78, orders: 20, riders: 2, online: true },
  { name: "SpeedyWash", location: "T.O.N", brand: "speedywash", capacity: 62, orders: 16, riders: 2, online: true },
  { name: "SpeedyWash", location: "Samat", brand: "speedywash", capacity: 40, orders: 9, riders: 1, online: true },
  { name: "SpeedyWash", location: "St. Niño", brand: "speedywash", capacity: 50, orders: 11, riders: 1, online: true },
];

function capacityColor(pct: number) {
  if (pct >= 80) return "bg-destructive/80";
  if (pct >= 50) return "bg-accent/80";
  return "bg-mint/80";
}

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function BranchesPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
      className="space-y-8"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Branch Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor all 10 branches across Metro Manila in real time</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {branches.map((b) => (
          <motion.div
            key={b.location}
            variants={item}
            className="glass-card rounded-2xl p-5 hover:shadow-[var(--shadow-elevated)] transition-all group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{b.name}</p>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  {b.location}
                </h3>
              </div>
              {b.online ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-mint bg-mint/10 px-2 py-1 rounded-full">
                  <Wifi className="h-3 w-3" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                  <WifiOff className="h-3 w-3" /> Offline
                </span>
              )}
            </div>

            {/* Capacity Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-semibold text-foreground">{b.capacity}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${capacityColor(b.capacity)}`} style={{ width: `${b.capacity}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-bold text-foreground">{b.orders}</p>
                  <p className="text-[10px] text-muted-foreground">Orders</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40">
                <Bike className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-sm font-bold text-foreground">{b.riders}</p>
                  <p className="text-[10px] text-muted-foreground">Riders</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
