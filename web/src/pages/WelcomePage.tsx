import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  WashingMachine,
  Truck,
  QrCode,
  ShieldCheck,
  Clock,
  Sparkles,
  MapPin,
  Phone,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import logoLaundryHubs from "@/assets/logo-laundryhubs.webp";
import logoSpeedyWash from "@/assets/logo-speedywash.webp";
import { toast } from "@/components/ui/sonner";

const services = [
  {
    icon: WashingMachine,
    title: "Wash & Fold",
    desc: "Professional washing and folding with premium detergents. Available in 3kg, 5kg, and 8kg loads.",
    price: "Starting at ₱65/kg",
  },
  {
    icon: Sparkles,
    title: "Dry Cleaning",
    desc: "Delicate fabrics handled with care. Corporate suits, gowns, and specialty garments.",
    price: "Starting at ₱150/pc",
  },
  {
    icon: Clock,
    title: "Express Service",
    desc: "Same-day turnaround for urgent needs. Drop off before 10 AM, pick up by 5 PM.",
    price: "+₱30 rush fee",
  },
  {
    icon: Truck,
    title: "Free Pickup & Delivery",
    desc: "Door-to-door service within 3km radius. Real-time rider tracking via the app.",
    price: "Free for orders ₱300+",
  },
];

const branches = [
  { name: "Triplets LaundryHubs — Makati Branch", brand: "triplets" },
  { name: "SpeedyWash — Chestnut Branch", brand: "speedywash" },
  { name: "SpeedyWash — Republic Branch", brand: "speedywash" },
  { name: "SpeedyWash — Holy Spirit Branch", brand: "speedywash" },
  { name: "SpeedyWash — Sta. Catalina Branch", brand: "speedywash" },
  { name: "SpeedyWash — Brookside Branch", brand: "speedywash" },
  { name: "SpeedyWash — JP Rizal Branch", brand: "speedywash" },
  { name: "SpeedyWash — Luzon Branch", brand: "speedywash" },
  { name: "SpeedyWash — St. Anthony Branch", brand: "speedywash" },
  { name: "SpeedyWash — UP Diliman / San Vicente Branch", brand: "speedywash" },
];

const testimonials = [
  {
    name: "Maria Santos",
    branch: "UP Diliman / San Vicente",
    text: "SpeedyWash saved me during finals week! Same-day delivery and my clothes smelled amazing.",
    rating: 5,
  },
  {
    name: "Carlos Mendoza",
    branch: "Makati",
    text: "Triplets LaundryHubs handles my office suits perfectly. The QR tracking is a game-changer.",
    rating: 5,
  },
  {
    name: "Ana Reyes",
    branch: "Brookside",
    text: "Best laundry service in the metro. The pickup & delivery is always on time!",
    rating: 4,
  },
];

const heroSlides = [
  {
    headline: "Your Laundry, Our Priority",
    sub: "10 branches across Metro Manila serving Triplets LaundryHubs & SpeedyWash customers with premium care.",
    brand: "both",
  },
  {
    headline: "Triplets LaundryHubs",
    sub: "Premium laundry care in the heart of Makati. Trusted by professionals and families since Day 1.",
    brand: "triplets",
  },
  {
    headline: "SpeedyWash",
    sub: "9 branches, one mission — fast, affordable, and reliable laundry across Metro Manila.",
    brand: "speedywash",
  },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = heroSlides[currentSlide];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 inset-x-0 z-50 h-16 flex items-center justify-between px-6 md:px-12 bg-card/70 backdrop-blur-xl border-b border-border/40"
      >
        <div className="flex items-center gap-3">
          <img src={logoLaundryHubs} alt="Triplets" className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/20" />
          <img src={logoSpeedyWash} alt="SpeedyWash" className="h-9 w-9 rounded-full object-cover ring-2 ring-secondary/30" />
          <span className="text-lg font-bold text-foreground tracking-tight hidden sm:block">
            Wash<span className="text-primary">Alert</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="px-5 py-2.5 text-sm font-semibold rounded-xl gradient-navy text-primary-foreground shadow-lg shadow-primary/15 hover:opacity-90 transition-opacity"
          >
            Staff Portal
          </button>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative pt-16 min-h-[85vh] flex items-center overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-secondary/15 blur-[100px]" />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[80px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 md:px-12 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    {(slide.brand === "both" || slide.brand === "triplets") && (
                      <img src={logoLaundryHubs} alt="Triplets" className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/30 shadow-md" />
                    )}
                    {(slide.brand === "both" || slide.brand === "speedywash") && (
                      <img src={logoSpeedyWash} alt="SpeedyWash" className="h-12 w-12 rounded-full object-cover ring-2 ring-secondary/30 shadow-md" />
                    )}
                  </div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
                    {slide.headline}
                  </h1>
                  <p className="text-lg text-muted-foreground mt-5 max-w-lg leading-relaxed">
                    {slide.sub}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Slide indicators */}
              <div className="flex items-center gap-3 mt-8">
                <button onClick={() => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {heroSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`}
                  />
                ))}
                <button onClick={() => setCurrentSlide((prev) => (prev + 1) % heroSlides.length)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-3 mt-10">
                <button
                  onClick={() => toast.info("Mobile app coming soon")}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-xl gradient-navy text-primary-foreground font-semibold text-sm shadow-xl shadow-primary/20 hover:opacity-90 transition-opacity"
                >
                  Download the App
                </button>
              </div>
            </div>

            {/* Right: Stats card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="hidden lg:block"
            >
              <div className="glass-card-elevated rounded-3xl p-8 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-3 w-3 rounded-full bg-mint animate-pulse" />
                  <span className="text-xs font-semibold text-mint uppercase tracking-wider">Live Status</span>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  {[
                    { label: "Active Branches", value: "10", icon: MapPin },
                    { label: "Orders Today", value: "284", icon: WashingMachine },
                    { label: "Happy Customers", value: "12K+", icon: Star },
                    { label: "Riders Active", value: "18", icon: Truck },
                  ].map((stat) => (
                    <div key={stat.label} className="p-4 rounded-2xl bg-muted/40 border border-border/30">
                      <stat.icon className="h-5 w-5 text-primary mb-2" />
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-6 md:px-12 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Our Services</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mt-3">
              Premium Laundry Solutions
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              From everyday wash & fold to specialty dry cleaning — we handle it all with care and precision.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map((svc, i) => (
              <motion.div
                key={svc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6 hover:shadow-[var(--shadow-elevated)] transition-all group"
              >
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4 group-hover:bg-primary/15 transition-colors">
                  <svc.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{svc.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{svc.desc}</p>
                <span className="text-xs font-bold text-mint">{svc.price}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why WashAlert */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-accent">Why Choose Us</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mt-3">
              Technology Meets Laundry Care
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: QrCode,
                title: "QR Bag Tracking",
                desc: "Every laundry bag gets a unique QR code. Track your order from drop-off to delivery in real time.",
              },
              {
                icon: ShieldCheck,
                title: "Secure & Reliable",
                desc: "Role-based access control ensures only authorized staff handle your orders. Your garments are safe with us.",
              },
              {
                icon: Sparkles,
                title: "AI-Powered Insights",
                desc: "Predictive inventory management and smart analytics help us serve you better, faster, and more efficiently.",
              },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="text-center p-8 rounded-2xl glass-card hover:shadow-[var(--shadow-elevated)] transition-all"
              >
                <div className="mx-auto p-4 rounded-2xl bg-accent/10 w-fit mb-5">
                  <feat.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-3">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Branches */}
      <section className="py-20 px-6 md:px-12 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-secondary-foreground/60">Our Locations</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mt-3">
              10 Branches Across Metro Manila
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b, i) => (
              <motion.div
                key={b.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 rounded-xl glass-card hover:shadow-[var(--shadow-elevated)] transition-all"
              >
                <img
                  src={b.brand === "triplets" ? logoLaundryHubs : logoSpeedyWash}
                  alt={b.brand}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-border"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">{b.name}</p>
                  <p className="text-xs text-mint font-medium">Open Now</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-primary">Testimonials</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mt-3">
              What Our Customers Say
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card-elevated rounded-2xl p-6"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 text-accent fill-accent" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-5 italic">"{t.text}"</p>
                <div>
                  <p className="text-sm font-bold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.branch} Branch</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-3xl gradient-navy p-12 md:p-16 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-primary-foreground mb-4">
              WashAlert Staff Portal
            </h2>
            <p className="text-primary-foreground/70 max-w-lg mx-auto mb-8">
              Customer features are available on mobile. Internal users can access the Staff Portal from the top navigation.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => toast.info("Mobile app coming soon")}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-primary font-bold text-sm shadow-xl hover:bg-white/90 transition-colors"
              >
                Download the App
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 md:px-12 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoLaundryHubs} alt="Triplets" className="h-8 w-8 rounded-full object-cover" />
            <img src={logoSpeedyWash} alt="SpeedyWash" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-sm font-bold text-foreground">WashAlert</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>© 2025 Triplets LaundryHubs & SpeedyWash</span>
            <a href="tel:+639123456789" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Phone className="h-3 w-3" /> Contact Us
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
