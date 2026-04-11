import { useState } from "react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { motion } from "framer-motion";
import { branches } from "@/data/branches";
import { FiClock, FiMapPin, FiPhone, FiSearch, FiNavigation } from "react-icons/fi";

export default function BranchesPage() {
  const [search, setSearch] = useState("");
  const filtered = branches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.area.toLowerCase().includes(search.toLowerCase()) ||
    b.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-20 lg:pt-24 pb-16 bg-[#1a2b3c]">
        <div className="max-w-7xl mx-auto px-6 pt-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary-foreground/60 mb-3">Locations</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground">Our Branches</h1>
          </motion.div>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative max-w-md mb-10">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Search branches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-background border border-border rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{b.name}</h3>
                    <p className="text-primary font-medium">{b.area}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${b.status === "Open" ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}>
                    {b.status}
                  </span>
                </div>
                <div className="space-y-2.5 mb-5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FiClock className="w-4 h-4 flex-shrink-0" /> {b.hours}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FiMapPin className="w-4 h-4 flex-shrink-0" /> {b.address}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FiPhone className="w-4 h-4 flex-shrink-0" /> {b.phone}
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 py-2.5 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors">
                  <FiNavigation className="w-4 h-4" /> Get Directions
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
