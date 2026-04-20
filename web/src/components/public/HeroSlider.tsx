import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import heroMachines from "@/assets/hero-machines.png";
import heroLinens from "@/assets/hero-linens.png";
import heroDetergent from "@/assets/hero-detergent.png";
import heroBasket from "@/assets/hero-basket.png";
import heroDryer from "@/assets/hero-dryer.png";

const slides = [
  { image: heroMachines, label: "Commercial-Grade Washing Machines" },
  { image: heroLinens, label: "Fresh Clean Linens" },
  { image: heroDetergent, label: "Premium Laundry Supplies" },
  { image: heroBasket, label: "Organized Laundry Care" },
  { image: heroDryer, label: "Professional Dryers" },
];

export default function HeroSlider() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((p) => (p + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0"
        >
          <img
            src={slides[current].image}
            alt={slides[current].label}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Bottom dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? "bg-primary-foreground" : "bg-primary-foreground/40"}`}
          />
        ))}
      </div>
    </section>
  );
}
