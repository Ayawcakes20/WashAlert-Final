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

type ServicePackage = { name: string; price: string; capacity: string; note?: string };

const servicePackages: ServicePackage[] = [
  { name: "Handwash",        price: "₱150/kg (≤3kg) · ₱90/kg (>3kg)", capacity: "By weight",  note: "Gentle hand-wash for delicates" },
  { name: "Dry Only",        price: "₱90 / 7kg",                        capacity: "7 kg/load",  note: "For pre-washed or lightly soiled items" },
  { name: "Ecowash Full",    price: "₱220 / 5kg",                       capacity: "5 kg/load",  note: "Eco-friendly wash & dry" },
  { name: "Basic Full 7kg",  price: "₱240 / 7kg",                       capacity: "7 kg/load",  note: "Full wash, dry & fold" },
  { name: "Basic Full 8kg",  price: "₱245 / 8kg",                       capacity: "8 kg/load",  note: "Full wash, dry & fold" },
  { name: "Premium Full 7kg",price: "₱270 / 7kg",                       capacity: "7 kg/load",  note: "Premium detergent & softener included" },
  { name: "Premium Full 8kg",price: "₱275 / 8kg",                       capacity: "8 kg/load",  note: "Premium detergent & softener included" },
];

type AddonItem = { label: string; price: string };

const addons: AddonItem[] = [
  { label: "Ariel Detergent",       price: "₱30 / pack" },
  { label: "Surf Detergent",        price: "₱25 / pack" },
  { label: "Downy Fabric Conditioner", price: "₱25 / pack" },
  { label: "Charm Fabric Conditioner", price: "₱15 / pack" },
  { label: "Rush Service",          price: "+₱150 flat" },
  { label: "Pickup & Delivery",     price: "Distance-based (free ≤3km)" },
  { label: "Convenience Fee",       price: "2% of subtotal" },
];

function PricingSection() {
  return (
    <section className="bg-[#0f1e2d] py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-xs font-bold tracking-[3px] uppercase text-blue-400 mb-3">Transparent Pricing</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">Laundry Services &amp; Rates</h2>
          <p className="text-sm md:text-base text-white/60 max-w-xl mx-auto leading-relaxed">
            Prices shown are base rates per load. Your laundry is weighed on arrival — you receive a final price notification before washing begins.
          </p>
        </motion.div>

        {/* Service packages grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
          {servicePackages.map((svc, i) => (
            <motion.div
              key={svc.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors"
            >
              <p className="text-[11px] font-bold tracking-widest uppercase text-blue-400 mb-2">Service</p>
              <h3 className="text-base font-bold text-white mb-1">{svc.name}</h3>
              <p className="text-xl font-black text-blue-300 mb-3">{svc.price}</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/10 text-white/70 text-[10px] font-semibold px-2 py-0.5 rounded-full">{svc.capacity}</span>
              </div>
              {svc.note && <p className="text-[11px] text-white/50 leading-relaxed">{svc.note}</p>}
            </motion.div>
          ))}
        </div>

        {/* Extra weight note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-yellow-400/10 border border-yellow-400/30 rounded-2xl p-5 mb-12 text-center"
        >
          <p className="text-yellow-300 text-sm font-semibold">
            ⚡ Madness Surcharge: +₱50 for every kilogram over the 8kg load limit.
          </p>
        </motion.div>

        {/* Add-ons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8"
        >
          <h3 className="text-lg font-bold text-white mb-6">Add-ons &amp; Fees</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {addons.map((a) => (
              <div key={a.label} className="flex items-center justify-between gap-4 py-2 border-b border-white/10 last:border-0">
                <span className="text-sm text-white/70">{a.label}</span>
                <span className="text-sm font-bold text-white whitespace-nowrap">{a.price}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[11px] text-white/40 leading-relaxed">
            Prices are subject to change without prior notice. Final amounts are confirmed by branch staff after weighing.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

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

      <PricingSection />

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

