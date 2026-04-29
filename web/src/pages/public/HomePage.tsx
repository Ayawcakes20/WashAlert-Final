import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarCheck2,
  MapPinned,
  Truck,
  Wallet,
  Boxes,
  MessageCircle,
  Sparkles,
  Timer,
  ShieldCheck,
  ChevronRight,
  Download,
  Smartphone,
  Info,
} from "lucide-react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import heroMachines from "@/assets/hero-machines.png";
import appMockup from "@/assets/app-mockup.png";
import { branches } from "@/data/branches";

const featureCards = [
  {
    title: "Laundry Booking",
    text: "Book by branch, schedule, and service in just a few taps.",
    icon: CalendarCheck2,
  },
  {
    title: "Real-Time Order Tracking",
    text: "Follow each stage from received to ready for pickup or delivery.",
    icon: Timer,
  },
  {
    title: "Live Delivery Map",
    text: "See driver progress and expected arrival updates in real time.",
    icon: MapPinned,
  },
  {
    title: "GCash Payment",
    text: "Pay securely and receive instant status updates for your order.",
    icon: Wallet,
  },
  {
    title: "Predictive Inventory",
    text: "Smart branch-level supply forecasting helps prevent delays.",
    icon: Boxes,
  },
  {
    title: "AI Chat Support",
    text: "Get quick support for tracking, booking, and delivery questions.",
    icon: MessageCircle,
  },
];

const services = [
  {
    title: "Wash and Fold",
    text: "Daily laundry care handled with branch-standard quality controls.",
  },
  {
    title: "Pickup & Delivery",
    text: "Door-to-door collection and return with progress notifications.",
  },
  {
    title: "Order Tracking",
    text: "Stay informed with live status updates every step of the process.",
  },
  {
    title: "Digital Payment",
    text: "Convenient cashless options including GCash and manual verification.",
  },
];

const steps = [
  { number: "01", title: "Choose a branch", text: "Select the nearest Triplets LaundryHubs or SpeedyWash location." },
  { number: "02", title: "Schedule laundry", text: "Set your preferred service type, date, and collection time." },
  { number: "03", title: "Track progress", text: "Monitor each order stage from washing to drying and ready status." },
  { number: "04", title: "Receive updates", text: "Get pickup and delivery notifications until your order is complete." },
];

export default function HomePage() {
  const highlightedBranches = branches.slice(0, 3);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <Navbar />

      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroMachines} alt="Laundry operations" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-navy/95 via-brand-navy/85 to-brand-navyLight/70" />
        </div>
        <div className="relative mx-auto grid min-h-[78vh] max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-brand-mint"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Triplets LaundryHubs Platform
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.05 }}
              className="mt-5 text-4xl font-extrabold leading-tight text-white md:text-5xl lg:text-6xl"
            >
              Laundry made simple across every branch
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
              className="mt-5 max-w-xl text-base leading-relaxed text-white/80 md:text-lg"
            >
              Book, track, pay, and get real-time updates from Triplets LaundryHubs and SpeedyWash.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                to="/branches"
                className="rounded-brand bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-navy transition hover:brightness-95"
              >
                Book a Laundry Service
              </Link>
              <Link
                to="/login"
                className="rounded-brand border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Log-in
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
              className="mt-6 flex flex-wrap gap-4 text-xs text-white/80"
            >
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-brand-mint" /> Secure digital payment</span>
              <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5 text-brand-mint" /> Live status notifications</span>
              <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-brand-mint" /> Pickup and delivery ready</span>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
            className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur md:p-6"
          >
            <img src={appMockup} alt="WashAlert app preview" className="w-full rounded-xl border border-white/20" />
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-10"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">Core Features</p>
          <h2 className="mt-2 text-3xl font-bold text-brand-navy md:text-4xl">Everything customers and staff need in one flow</h2>
        </motion.div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((feature, index) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.04 }}
              className="rounded-brand border border-brand-border bg-white p-6 shadow-brand"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-mintSoft text-brand-navy">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-semibold text-brand-navy">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">{feature.text}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="bg-brand-navy py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">How It Works</p>
            <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">Fast flow from booking to delivery</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <motion.article
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.05 }}
                className="rounded-brand border border-white/20 bg-white/5 p-5"
              >
                <p className="text-sm font-bold text-brand-gold">{step.number}</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{step.text}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">Services</p>
          <h2 className="mt-2 text-3xl font-bold text-brand-navy md:text-4xl">Designed for modern laundry operations</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {services.map((service, index) => (
            <motion.article
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.05 }}
              className="rounded-brand border border-brand-border bg-white p-6 shadow-brand"
            >
              <h3 className="text-xl font-semibold text-brand-navy">{service.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">{service.text}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-10 flex items-end justify-between gap-4"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">Download App</p>
              <h2 className="mt-2 text-3xl font-bold text-brand-navy md:text-4xl">Use WashAlert on mobile</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">
                Access bookings, tracking, and updates from your phone. Android testing build is available, while iOS is coming soon.
              </p>
            </div>
            <Link
              to="/download"
              className="hidden rounded-brand bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-navyDark md:inline-flex"
            >
              View Download Page
            </Link>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2">
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="rounded-brand border border-brand-border bg-brand-bg p-6 shadow-brand"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-mintSoft text-brand-navy">
                <Smartphone className="h-5 w-5" />
              </span>
              <h3 className="text-xl font-semibold text-brand-navy">Android APK available for testing</h3>
              <p className="mt-2 text-sm text-brand-muted">
                Install the current Android test build to try customer booking and tracking flows.
              </p>
              <Link
                to="/download"
                className="mt-4 inline-flex items-center gap-2 rounded-brand bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy transition hover:brightness-95"
              >
                <Download className="h-4 w-4" /> Get Android Build
              </Link>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.06 }}
              className="rounded-brand border border-brand-border bg-brand-bg p-6 shadow-brand"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-mintSoft text-brand-navy">
                <Info className="h-5 w-5" />
              </span>
              <h3 className="text-xl font-semibold text-brand-navy">iOS build coming soon</h3>
              <p className="mt-2 text-sm text-brand-muted">
                iOS distribution is being finalized. We will publish release instructions once the build is ready.
              </p>
              <button
                type="button"
                disabled
                className="mt-4 inline-flex items-center gap-2 rounded-brand border border-brand-border bg-white px-4 py-2 text-sm font-semibold text-brand-muted"
              >
                <Download className="h-4 w-4" /> iOS Availability Pending
              </button>
            </motion.article>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">Branch Network</p>
              <h2 className="mt-2 text-3xl font-bold text-brand-navy md:text-4xl">Trusted locations across Metro Manila</h2>
            </div>
            <Link
              to="/branches"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-navy hover:text-brand-navyDark"
            >
              View All Branches <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {highlightedBranches.map((branch, index) => (
              <motion.article
                key={branch.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.05 }}
                className="rounded-brand border border-brand-border bg-brand-bg p-6 shadow-brand"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-brand-navy">{branch.area}</h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      branch.status === "Open" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    }`}
                  >
                    {branch.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-brand-text">{branch.name}</p>
                <p className="mt-2 text-sm text-brand-muted">{branch.address}</p>
                <p className="mt-3 text-xs font-medium text-brand-navy">{branch.hours}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-mintSoft py-16 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto max-w-5xl rounded-2xl border border-brand-border bg-white px-6 py-10 text-center shadow-brand lg:px-12"
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">Ready to Start?</p>
          <h2 className="mt-2 text-3xl font-bold text-brand-navy md:text-4xl">Get your laundry moving today</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted">
            Find a nearby branch, schedule your order, and stay updated from pickup to delivery.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/branches"
              className="rounded-brand bg-brand-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-navyDark"
            >
              Find a Branch
            </Link>
            <Link
              to="/login"
              className="rounded-brand bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-navy transition hover:brightness-95"
            >
              Log-in to Dashboard
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
