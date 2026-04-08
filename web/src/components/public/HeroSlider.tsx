import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const slides = [
  { image: "https://picsum.photos/seed/laundromat1/1920/1080", label: "WashAlert" },
  { image: "https://picsum.photos/seed/washroom2/1920/1080", label: "WashAlert" },
  { image: "https://picsum.photos/seed/cleanspace3/1920/1080", label: "WashAlert" },
  { image: "https://picsum.photos/seed/machines4/1920/1080", label: "WashAlert" },
  { image: "https://picsum.photos/seed/freshlinens5/1920/1080", label: "WashAlert" },
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
