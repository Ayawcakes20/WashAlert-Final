import { motion } from "framer-motion";
import { Download, Smartphone, Info } from "lucide-react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import appMockup from "@/assets/app-mockup.png";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <Navbar />

      <section className="bg-brand-navy py-16 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-7xl px-6 lg:px-8"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">Download App</p>
          <h1 className="mt-2 text-4xl font-bold text-white md:text-5xl">WashAlert Mobile</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/80">
            Use WashAlert on your phone for booking, order tracking, delivery updates, and branch notifications.
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="rounded-brand border border-brand-border bg-white p-6 shadow-brand"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-mintSoft text-brand-navy">
              <Smartphone className="h-5 w-5" />
            </span>
            <h2 className="text-2xl font-bold text-brand-navy">Android APK available for testing</h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              Install the latest Android test build to validate booking, tracking, and push notification behavior on real devices.
            </p>
            <button
              type="button"
              className="mt-5 inline-flex items-center gap-2 rounded-brand bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy transition hover:brightness-95"
            >
              <Download className="h-4 w-4" />
              Get Android APK
            </button>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.06 }}
            className="rounded-brand border border-brand-border bg-white p-6 shadow-brand"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-mintSoft text-brand-navy">
              <Info className="h-5 w-5" />
            </span>
            <h2 className="text-2xl font-bold text-brand-navy">iOS build coming soon</h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              We are finalizing iOS distribution requirements. Release instructions will be posted once available.
            </p>
            <button
              type="button"
              disabled
              className="mt-5 inline-flex items-center gap-2 rounded-brand border border-brand-border bg-brand-bg px-4 py-2 text-sm font-semibold text-brand-muted"
            >
              <Download className="h-4 w-4" />
              iOS Availability Pending
            </button>
          </motion.article>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mt-10 rounded-brand border border-brand-border bg-white p-5 shadow-brand"
        >
          <img
            src={appMockup}
            alt="WashAlert mobile preview"
            className="mx-auto w-full max-w-[380px] rounded-xl border border-brand-border"
          />
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
