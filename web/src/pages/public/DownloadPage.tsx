import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { motion } from "framer-motion";
import appMockup from "@/assets/app-mockup.png";

const appFeatures = [
  {
    title: "Laundry\nBooking",
    desc: "Book a service anytime, pick your branch and schedule — all from your phone.",
    icon: (
      <svg viewBox="0 0 40 40" className="w-8 h-8" stroke="currentColor" fill="none" strokeWidth="1.5">
        <rect x="8" y="6" width="24" height="28" rx="2" />
        <circle cx="20" cy="24" r="8" />
        <circle cx="20" cy="24" r="4" />
        <circle cx="14" cy="12" r="1.5" />
        <rect x="18" y="10" width="8" height="3" rx="1" />
      </svg>
    ),
  },
  {
    title: "Real-Time\nTracking",
    desc: "Know exactly where your laundry is — Washing, Drying, Ready — at every step.",
    icon: (
      <svg viewBox="0 0 40 40" className="w-8 h-8" stroke="currentColor" fill="none" strokeWidth="1.5">
        <circle cx="20" cy="20" r="12" />
        <polyline points="20,10 20,20 26,20" />
        <circle cx="20" cy="20" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "GCash\nPayment",
    desc: "Pay securely via GCash through PayMongo — no cash needed.",
    icon: (
      <svg viewBox="0 0 40 40" className="w-8 h-8" stroke="currentColor" fill="none" strokeWidth="1.5">
        <rect x="6" y="10" width="28" height="20" rx="3" />
        <line x1="6" y1="16" x2="34" y2="16" />
        <line x1="10" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
];

export default function DownloadPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-20 lg:pt-24 pb-16 bg-[#1a2b3c]">
        <div className="max-w-7xl mx-auto px-6 pt-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary-foreground/50 mb-3">Mobile Application</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground">WashAlert App</h1>
          </motion.div>
        </div>
      </section>

      {/* App preview section */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

            {/* Phone frame with actual app mockup */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex-shrink-0 relative"
            >
              {/* Outer glow ring */}
              <div className="absolute inset-0 rounded-[2.8rem] bg-primary/10 blur-2xl scale-110 -z-10" />
              {/* Phone bezel */}
              <div className="w-[260px] h-[520px] bg-[#0f1923] rounded-[2.5rem] p-[10px] shadow-2xl ring-1 ring-white/10">
                {/* Notch */}
                <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-20 h-5 bg-[#0f1923] rounded-full z-20" />
                {/* Screen */}
                <div className="w-full h-full bg-[#1a2b3c] rounded-[2rem] overflow-hidden">
                  <img
                    src={appMockup}
                    alt="WashAlert Mobile App"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
            </motion.div>

            {/* Right side */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex-1"
            >
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/70 mb-4">Mobile App</p>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-3">WashAlert</h2>
              <p className="text-2xl md:text-3xl font-bold text-foreground mb-4">made even more convenient.</p>
              <p className="text-base text-muted-foreground mb-12 leading-relaxed">
                Book laundry services, track your order status in real time, and pay securely — all from one app designed for Triplets LaundryHubs and SpeedyWash.
              </p>

              {/* Feature cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {appFeatures.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="group border border-border rounded-2xl p-5 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    <div className="text-primary mb-3">{f.icon}</div>
                    <p className="text-sm font-semibold text-foreground whitespace-pre-line leading-snug mb-2">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Download CTA — dark navy to match header */}
      <section className="py-20 bg-[hsl(220,10%,18%)]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-6">
              <svg viewBox="0 0 40 40" className="w-8 h-8 text-primary-foreground" stroke="currentColor" fill="none" strokeWidth="1.5">
                <rect x="8" y="6" width="24" height="28" rx="2" />
                <circle cx="20" cy="24" r="8" />
                <circle cx="20" cy="24" r="4" />
                <circle cx="14" cy="12" r="1.5" />
              </svg>
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-3">Download the App</h3>
            <p className="text-primary-foreground/60 mb-10 text-base">Available soon on Google Play and Apple App Store</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                disabled
                className="flex items-center gap-3 px-8 py-4 bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground/50 rounded-xl font-medium text-sm cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M3.18 23.76c.3.17.64.24.99.19l12.47-12.47L3 4.38a1.2 1.2 0 0 0-.99.18C1.69 4.88 1.5 5.37 1.5 6v12c0 .63.19 1.12.69 1.46z" opacity=".6"/>
                  <path d="m13.36 12-2.8-2.8 2-2 4.8 4.8-4.8 4.8-2-2 2.8-2.8z" opacity=".8"/>
                  <path d="m4.17 23.95 11.11-11.11-2.38-2.38L1.5 22.27c.4.85 1.37 1.22 2.67.74z"/>
                  <path d="M1.5 1.73 12.9 13.12l2.38-2.38L4.17.07C2.87-.41 1.9-.04 1.5.8z"/>
                </svg>
                Google Play — Coming Soon
              </button>
              <button
                disabled
                className="flex items-center gap-3 px-8 py-4 bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground/50 rounded-xl font-medium text-sm cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                App Store — Coming Soon
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
