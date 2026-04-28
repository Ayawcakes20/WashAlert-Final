import { motion } from "framer-motion";
import { Building2, Target, Users, Zap, MapPin } from "lucide-react";

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const branchLocations = [
  "Triplets LaundryHubs — Makati Branch",
  "SpeedyWash — Chestnut Branch",
  "SpeedyWash — Republic Branch",
  "SpeedyWash — Holy Spirit Branch",
  "SpeedyWash — Sta. Catalina Branch",
  "SpeedyWash — Brookside Branch",
  "SpeedyWash — JP Rizal Branch",
  "SpeedyWash — Luzon Branch",
  "SpeedyWash — St. Anthony Branch",
  "SpeedyWash — UP Diliman / San Vicente Branch",
];

export default function AboutPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-8 max-w-4xl"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">About WashAlert</h1>
        <p className="text-sm text-muted-foreground mt-1">The Management System for Triplets LaundryHubs & SpeedyWash</p>
      </motion.div>

      {/* Brand logos */}
      <motion.div variants={item} className="glass-card rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        <div className="flex items-center justify-center shrink-0">
          <img
            src="/washalert-logo.png"
            alt="WashAlert"
            className="h-20 w-20 rounded-full object-cover ring-4 ring-secondary/30"
          />
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-bold text-foreground">WashAlert</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            A Booking System with Real-Time Tracking and Predictive Inventory built specifically for 
            Triplets LaundryHubs and SpeedyWash. The system digitizes booking management, order tracking, 
            delivery coordination, payment processing, inventory monitoring, and business reporting — 
            replacing the manual, notebook-based operations that have been the standard across all 10 branches.
          </p>
        </div>
      </motion.div>

      {/* Mission cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          {
            icon: Target,
            title: "Our Mission",
            desc: "To eliminate the inefficiencies of manual laundry operations by providing a unified digital platform that connects customers, staff, riders, and administrators across all branches in real time.",
          },
          {
            icon: Zap,
            title: "Why WashAlert",
            desc: "Customers who receive no update on their orders are among those most likely to stop returning — not because of poor washing quality, but because waiting without information becomes too frustrating. WashAlert solves this.",
          },
          {
            icon: Users,
            title: "Who We Serve",
            desc: "Customers can book and track orders without calling. Staff get a clear, organized workflow. Riders manage pickups and deliveries. Owners monitor every branch from a single dashboard.",
          },
          {
            icon: Building2,
            title: "Our Scale",
            desc: "Triplets LaundryHubs handles Makati. SpeedyWash covers 9 branches: Chestnut, Republic, Holy Spirit, Sta. Catalina, Brookside, JP Rizal, Luzon, St. Anthony, and UP Diliman / San Vicente — all owned by the same family.",
          },
        ].map((card) => (
          <motion.div key={card.title} variants={item} className="glass-card rounded-2xl p-6">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary w-fit mb-4">
              <card.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-2">{card.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Branch list */}
      <motion.div variants={item} className="glass-card rounded-2xl p-6">
        <h3 className="text-base font-bold text-foreground mb-4">All 10 Branches</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {branchLocations.map((b) => (
            <div key={b} className="flex items-center gap-2 text-sm text-muted-foreground py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              {b}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
