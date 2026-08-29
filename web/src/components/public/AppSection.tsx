import { motion } from "framer-motion";
import { Link } from "react-router-dom";

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
                {/* Punch-hole front camera (Android style) */}
                <div className="absolute top-[13px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#0f1923] ring-1 ring-white/10 z-20" />
                {/* Screen — mirrors the real app's Home tab layout */}
                <div className="w-full h-full bg-white rounded-[1.8rem] overflow-hidden flex flex-col text-left">
                  <div className="bg-primary pt-5 pb-3 px-3">
                    <p className="text-primary-foreground text-xs font-bold tracking-tight">WashAlert</p>
                  </div>

                  <div className="flex-1 overflow-hidden px-3 pt-3 space-y-3">
                    <p className="text-[11px] font-extrabold text-foreground">Our Laundry Services.</p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-border p-2">
                        <span className="inline-block text-[7px] font-semibold px-1 py-0.5 rounded-full bg-[#D6EAF8] text-[#2E86C1] mb-1.5">Standard</span>
                        <p className="text-[9px] font-bold text-foreground">Wash</p>
                        <p className="text-[8px] text-muted-foreground">₱80 / 7kg</p>
                      </div>
                      <div className="rounded-lg border border-border p-2">
                        <span className="inline-block text-[7px] font-semibold px-1 py-0.5 rounded-full bg-[#FFF1F2] text-[#E11D48] mb-1.5">Standard</span>
                        <p className="text-[9px] font-bold text-foreground">Dry</p>
                        <p className="text-[8px] text-muted-foreground">₱90 / 7kg</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] font-extrabold text-foreground mb-1.5">Active Orders</p>
                      <div className="rounded-lg bg-muted/60 p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-semibold text-foreground">Order #WA-1042</span>
                          <span className="text-[6.5px] font-semibold px-1 py-0.5 rounded-full bg-primary/15 text-primary">Washing</span>
                        </div>
                        <div className="h-1 rounded-full bg-border overflow-hidden">
                          <div className="h-full w-3/5 rounded-full bg-primary" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-around border-t border-border py-2 bg-white">
                    {["Home", "Orders", "Book", "Alerts", "Profile"].map((label, i) => (
                      <div key={label} className="flex flex-col items-center gap-0.5">
                        <div className={`w-3 h-3 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                        <span className={`text-[5px] font-medium ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
                      </div>
                    ))}
                  </div>
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
