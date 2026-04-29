import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { motion } from "framer-motion";
import { featureDetails } from "@/data/features";
import { Link } from "react-router-dom";
import svcBooking from "@/assets/svc-booking.png";
import svcTracking from "@/assets/svc-tracking.png";
import svcDelivery from "@/assets/svc-delivery.png";
import svcPayment from "@/assets/svc-payment.png";
import heroMachines from "@/assets/hero-machines.png";
import heroLinens from "@/assets/hero-linens.png";
import heroDetergent from "@/assets/hero-detergent.png";
import heroBasket from "@/assets/hero-basket.png";
import heroDryer from "@/assets/hero-dryer.png";

// 4 contextually relevant images per feature section
const featureImages: Record<number, [string, string, string, string]> = {
  0: [svcBooking,   heroMachines, heroBasket,   heroDetergent],
  1: [svcTracking,  heroDryer,    heroLinens,   heroMachines],
  2: [svcDelivery,  heroBasket,   heroLinens,   heroDetergent],
  3: [svcPayment,   svcBooking,   heroMachines, heroDetergent],
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-20 lg:pt-24 pb-16 bg-[#1a2b3c]">
        <div className="max-w-7xl mx-auto px-6 pt-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground">Our Services</h1>
          </motion.div>
        </div>
      </section>

      {featureDetails.map((f, i) => {
        const imgs = featureImages[i % 4] ?? featureImages[0];
        return (
          <div key={f.id}>
            {/* Numbered section */}
            <section className={`relative py-20 lg:py-28 overflow-hidden ${i % 2 === 0 ? "bg-[hsl(220,10%,35%)]" : "bg-[hsl(220,10%,55%)]"}`}>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[200px] md:text-[300px] font-black text-primary-foreground/5 leading-none select-none -ml-4">
                {i + 1}
              </div>
              <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-8">{f.title}</h2>
                  <p className="text-sm md:text-base text-primary-foreground/80 leading-relaxed max-w-2xl mx-auto">{f.description}</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  className="mt-10"
                >
                  <Link to="/about-public" className="inline-block text-base font-medium text-primary-foreground border-b-2 border-primary-foreground pb-1 hover:opacity-70 transition-opacity">
                    Read More
                  </Link>
                </motion.div>
              </div>
            </section>

            {/* 2x2 image grid */}
            <div className="grid grid-cols-2">
              {imgs.map((src, idx) => (
                <img key={idx} src={src} alt={f.title} className="w-full h-[200px] md:h-[300px] object-cover" />
              ))}
            </div>
          </div>
        );
      })}

      <Footer />
    </div>
  );
}

