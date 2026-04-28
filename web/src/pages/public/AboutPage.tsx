import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { branches } from "@/data/branches";
import { motion } from "framer-motion";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <Navbar />

      <section className="bg-brand-navy py-16 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-7xl px-6 lg:px-8"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">About WashAlert</p>
          <h1 className="mt-2 text-4xl font-bold text-white md:text-5xl">Operational clarity for every laundry order</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/80">
            WashAlert helps customers and branch teams stay connected with booking, tracking, payment, and delivery updates in one platform.
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="rounded-brand border border-brand-border bg-white p-6 shadow-brand"
          >
            <h2 className="text-2xl font-bold text-brand-navy">Our Mission</h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              Make laundry operations transparent and simple for everyone, from first-time customers to branch operators and delivery teams.
            </p>
          </motion.article>
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 }}
            className="rounded-brand border border-brand-border bg-white p-6 shadow-brand"
          >
            <h2 className="text-2xl font-bold text-brand-navy">What We Improve</h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-muted">
              Clear order progress, secure payment coordination, fewer branch communication gaps, and better service confidence across all locations.
            </p>
          </motion.article>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-brand-navy md:text-4xl">Branch Presence</h2>
          <p className="mt-2 text-sm text-brand-muted">Serving customers across Metro Manila through Triplets LaundryHubs and SpeedyWash.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch, index) => (
              <motion.article
                key={branch.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, ease: "easeOut", delay: index * 0.03 }}
                className="rounded-brand border border-brand-border bg-brand-bg p-5 shadow-brand"
              >
                <p className="text-sm font-semibold text-brand-navy">{branch.area}</p>
                <p className="mt-1 text-sm font-medium text-brand-text">{branch.name}</p>
                <p className="mt-2 text-xs text-brand-muted">{branch.address}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
