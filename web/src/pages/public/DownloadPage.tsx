import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { motion } from "framer-motion";

const appFeatures = [
  { title: "Operate &\nPay Cashless", desc: "Book and pay directly from the app" },
  { title: "Check Status\nAnytime", desc: "Real-time tracking from your phone" },
  { title: "Exclusive\nOffers", desc: "Get special deals and rewards" },
];

export default function DownloadPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-20 lg:pt-24 pb-16 bg-[#1a2b3c]">
        <div className="max-w-7xl mx-auto px-6 pt-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground">WashAlert App</h1>
          </motion.div>
        </div>
      </section>

      {/* App page */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Phone mockup */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex-shrink-0"
            >
              <div className="w-[260px] h-[500px] bg-foreground rounded-[2.5rem] p-3 shadow-2xl">
                <div className="w-full h-full bg-background rounded-[2rem] overflow-hidden">
                  <img
                    src="https://picsum.photos/seed/apppreview1/400/700"
                    alt="WashAlert App Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </motion.div>

            {/* Right side content */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex-1"
            >
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
                WashAlert
              </h2>
              <p className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                made even more convenient.
              </p>
              <p className="text-lg text-muted-foreground mb-12">
                WashAlert Laundry Place App
              </p>

              {/* 3 features with icons */}
              <div className="grid grid-cols-3 gap-8">
                {appFeatures.map((f, i) => (
                  <div key={i} className="text-center">
                    <p className="text-sm font-medium text-primary whitespace-pre-line leading-snug mb-4">{f.title}</p>
                    <div className="w-full h-[200px] bg-secondary rounded-lg flex items-center justify-center">
                      <svg viewBox="0 0 80 120" className="w-16 h-24 text-foreground/60" stroke="currentColor" fill="none" strokeWidth="1.5">
                        <rect x="20" y="10" width="40" height="70" rx="4" />
                        <circle cx="40" cy="50" r="12" />
                        <circle cx="40" cy="50" r="6" />
                        <rect x="28" y="18" width="24" height="6" rx="1" />
                      </svg>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{f.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Download buttons */}
      <section className="py-16 bg-secondary">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-8">Download the App</h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-foreground text-background rounded-lg font-medium text-sm opacity-60 cursor-not-allowed">
              Google Play — Coming Soon
            </button>
            <button className="px-8 py-4 bg-foreground text-background rounded-lg font-medium text-sm opacity-60 cursor-not-allowed">
              App Store — Coming Soon
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
