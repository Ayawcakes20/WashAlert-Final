import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { motion } from "framer-motion";
import heroMachines from "@/assets/hero-machines.png";
import heroLinens from "@/assets/hero-linens.png";

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-20 lg:pt-24 pb-16 bg-[#1a2b3c]">
        <div className="max-w-7xl mx-auto px-6 pt-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary-foreground/50 mb-3">Who We Are</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground">About WashAlert</h1>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Our Mission</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-4">
              WashAlert transforms the traditional laundry experience into a seamless, technology-driven service.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We believe that laundry should be effortless — from booking to delivery.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Full width image strip */}
      <div className="grid grid-cols-2">
        <img src={heroMachines} alt="WashAlert Machines" className="w-full h-[260px] md:h-[380px] object-cover" />
        <img src={heroLinens} alt="Fresh Laundry" className="w-full h-[260px] md:h-[380px] object-cover" />
      </div>

      {/* Story — dark section matching nav instead of teal */}
      <section className="py-20 lg:py-28 bg-[hsl(220,10%,18%)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-8">Our Story</h2>
            <p className="text-lg text-primary-foreground/75 leading-relaxed mb-4">
              WashAlert was born from a simple observation: laundry services in Metro Manila were stuck in the past.
            </p>
            <p className="text-lg text-primary-foreground/75 leading-relaxed mb-4">
              Long queues, unclear pricing, no status updates, and cash-only payments made the experience frustrating for both customers and business owners.
            </p>
            <p className="text-lg text-primary-foreground/75 leading-relaxed">
              We set out to change that — designing and developing a comprehensive laundry booking and tracking system that leverages AI, real-time tracking, and digital payments to modernize the laundry industry.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 10 branches */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">10 Branches Across Metro Manila</h2>
            <p className="text-muted-foreground mt-3">Serving thousands of customers every day</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { brand: "Triplets LaundryHubs", location: "Makati" },
              { brand: "SpeedyWash", location: "UP Diliman" },
              { brand: "SpeedyWash", location: "JP Rizal" },
              { brand: "SpeedyWash", location: "S. Catalina" },
              { brand: "SpeedyWash", location: "Pasig" },
              { brand: "SpeedyWash", location: "Republic" },
              { brand: "SpeedyWash", location: "Chestnut" },
              { brand: "SpeedyWash", location: "T.O.N" },
              { brand: "SpeedyWash", location: "Samat" },
              { brand: "SpeedyWash", location: "St. Niño" },
            ].map((b) => (
              <motion.div
                key={b.location}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-muted/30 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{b.brand}</p>
                  <p className="text-xs text-muted-foreground">{b.location}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
