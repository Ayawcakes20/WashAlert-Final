import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { motion } from "framer-motion";

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-20 lg:pt-24 pb-16 bg-[#1a2b3c]">
        <div className="max-w-7xl mx-auto px-6 pt-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground">About WashAlert</h1>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Our Mission</h2>
            <p className="text-lg text-foreground leading-relaxed mb-4">
              WashAlert transforms the traditional laundry experience into a seamless, technology-driven service.
            </p>
            <p className="text-lg text-foreground leading-relaxed">
              We believe that laundry should be effortless — from booking to delivery.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-secondary">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">Our Story</h2>
            <p className="text-lg text-foreground leading-relaxed mb-4">
              WashAlert was born from a simple observation: laundry services in Metro Manila were stuck in the past.
            </p>
            <p className="text-lg text-foreground leading-relaxed mb-4">
              Long queues, unclear pricing, no status updates, and cash-only payments made the experience frustrating for both customers and business owners.
            </p>
            <p className="text-lg text-foreground leading-relaxed">
              We set out to change that — designing and developing a comprehensive laundry booking and tracking system that leverages AI, real-time tracking, and digital payments to modernize the laundry industry.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Full width image grid */}
      <div className="grid grid-cols-2">
        <img src="https://picsum.photos/seed/aboutwash1/800/600" alt="WashAlert Branch" className="w-full h-[250px] md:h-[350px] object-cover" />
        <img src="https://picsum.photos/seed/aboutwash2/800/600" alt="Laundry Service" className="w-full h-[250px] md:h-[350px] object-cover" />
      </div>

      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">10 Branches Across Metro Manila</h2>
            <p className="text-muted-foreground mt-3">Serving thousands of customers every day</p>
          </motion.div>
          <div className="text-center">
            <p className="text-lg text-foreground leading-relaxed mb-4">
              With strategically located branches from Makati to Marikina,
            </p>
            <p className="text-lg text-foreground leading-relaxed">
              there's always a WashAlert-powered laundry branch within reach.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
