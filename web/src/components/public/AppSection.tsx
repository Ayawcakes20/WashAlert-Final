import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import appMockup from "@/assets/app-mockup.png";

export default function AppSection() {
  return (
    <section className="bg-[hsl(220,10%,20%)] py-24 lg:py-32 relative overflow-hidden">
      {/* Side text */}
      <div className="hidden lg:block">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 origin-center">
          <span className="text-primary-foreground/10 text-xl font-bold tracking-[0.3em] whitespace-nowrap">WashAlert App</span>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 origin-center">
          <span className="text-primary-foreground/10 text-xl font-bold tracking-[0.3em] whitespace-nowrap">WashAlert App</span>
        </div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-12">
            WashAlert App
          </h2>

          <div className="space-y-2 mb-12">
            <p className="text-base md:text-lg text-primary-foreground/80 leading-relaxed">
              Put your laundry in the basket, put your smartphone in your pocket, and head to the nearest branch.
            </p>
            <p className="text-base md:text-lg text-primary-foreground/80 leading-relaxed">
              Even if you don't have cash, you don't need a wallet.
            </p>
            <p className="text-base md:text-lg text-primary-foreground/80 leading-relaxed">
              Even if you leave the store while your laundry is running, the app will tell you how much time is left.
            </p>
            <p className="text-base md:text-lg text-primary-foreground/80 leading-relaxed mt-6">
              With the WashAlert app,
            </p>
            <p className="text-base md:text-lg text-primary-foreground/80 leading-relaxed">
              a whole new laundry experience begins.
            </p>
          </div>

          {/* Washer icon */}
          <div className="w-20 h-20 rounded-full border-2 border-primary-foreground/40 flex items-center justify-center mx-auto mb-12">
            <svg viewBox="0 0 40 40" className="w-10 h-10 text-primary-foreground/60" stroke="currentColor" fill="none" strokeWidth="1.5">
              <rect x="8" y="6" width="24" height="28" rx="2" />
              <circle cx="20" cy="24" r="8" />
              <circle cx="20" cy="24" r="4" />
              <circle cx="14" cy="12" r="1.5" />
              <rect x="18" y="10" width="8" height="3" rx="1" />
            </svg>
          </div>

          {/* Phone mockup — actual WashAlert UI */}
          <div className="flex justify-center mb-12">
            <div className="relative">
              <div className="absolute inset-0 rounded-[2.8rem] bg-primary/15 blur-2xl scale-110 -z-10" />
              <div className="w-[200px] h-[400px] bg-[#0f1923] rounded-[2.2rem] p-[8px] shadow-2xl ring-1 ring-white/10">
                <div className="w-full h-full bg-[#1a2b3c] rounded-[1.8rem] overflow-hidden">
                  <img
                    src={appMockup}
                    alt="WashAlert App"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
            </div>
          </div>

          <Link
            to="/download"
            className="inline-block text-base font-medium text-primary-foreground border-b-2 border-primary-foreground pb-1 hover:opacity-70 transition-opacity"
          >
            Read More
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
