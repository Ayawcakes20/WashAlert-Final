import { motion } from "framer-motion";

const services = [
  { label: "Laundry\nBooking", sub: "Book anytime", icon: "washer" },
  { label: "Real-Time\nTracking", sub: "Live updates", icon: "dryer" },
  { label: "Live Delivery\nMap", sub: "GPS tracking", icon: "detergent" },
  { label: "GCash\nPayment", sub: "Cashless pay", icon: "sneaker" },
  { label: "AI Chat\nSupport", sub: "24/7 help", icon: "phone" },
  { label: "Push\nNotifications", sub: "Stay updated", icon: "app" },
  { label: "Predictive\nInventory", sub: "Smart stock", icon: "cleaning" },
  { label: "Wash and\nFold", sub: "Full service", icon: "fold" },
  { label: "Pickup &\nDelivery", sub: "Door to door", icon: "delivery" },
  { label: "Wi-Fi\nAvailable", sub: "Stay connected", icon: "wifi" },
  { label: "10\nBranches", sub: "Metro Manila", icon: "store" },
  { label: "Pet\nLaundry", sub: "Fur-friendly", icon: "pet" },
];

function ServiceIcon({ type }: { type: string }) {
  const iconContent: Record<string, JSX.Element> = {
    washer: (
      <>
        <circle cx="40" cy="44" r="16" strokeWidth="2" fill="none" />
        <circle cx="40" cy="44" r="8" strokeWidth="1.5" fill="none" />
        <rect x="26" y="20" width="28" height="8" rx="1" strokeWidth="2" fill="none" />
        <circle cx="32" cy="24" r="2" strokeWidth="1.5" fill="none" />
      </>
    ),
    dryer: (
      <>
        <circle cx="40" cy="44" r="16" strokeWidth="2" fill="none" />
        <path d="M32 40 C36 36, 44 48, 48 44" strokeWidth="1.5" fill="none" />
        <rect x="26" y="20" width="28" height="8" rx="1" strokeWidth="2" fill="none" />
        <circle cx="46" cy="24" r="2" strokeWidth="1.5" fill="none" />
      </>
    ),
    detergent: (
      <>
        <circle cx="34" cy="44" r="6" strokeWidth="2" fill="none" />
        <circle cx="46" cy="44" r="6" strokeWidth="2" fill="none" />
        <circle cx="40" cy="32" r="6" strokeWidth="2" fill="none" />
      </>
    ),
    sneaker: (
      <>
        <path d="M24 48 L24 36 C24 32 28 28 32 28 L40 28 L48 34 L56 34 L56 48 Z" strokeWidth="2" fill="none" />
        <line x1="28" y1="48" x2="52" y2="48" strokeWidth="1.5" />
      </>
    ),
    phone: (
      <>
        <rect x="30" y="20" width="20" height="40" rx="3" strokeWidth="2" fill="none" />
        <line x1="30" y1="28" x2="50" y2="28" strokeWidth="1.5" />
        <line x1="30" y1="52" x2="50" y2="52" strokeWidth="1.5" />
        <circle cx="40" cy="56" r="2" strokeWidth="1.5" fill="none" />
      </>
    ),
    app: (
      <>
        <rect x="28" y="22" width="24" height="36" rx="3" strokeWidth="2" fill="none" />
        <rect x="33" y="30" width="14" height="10" rx="1" strokeWidth="1.5" fill="none" />
        <path d="M32 46 L36 42 L40 46 L44 40 L48 46" strokeWidth="1.5" fill="none" />
      </>
    ),
    cleaning: (
      <>
        <rect x="30" y="22" width="14" height="20" rx="2" strokeWidth="2" fill="none" />
        <line x1="37" y1="22" x2="37" y2="16" strokeWidth="2" />
        <path d="M30 42 L26 56 L48 56 L44 42" strokeWidth="2" fill="none" />
      </>
    ),
    fold: (
      <>
        <rect x="26" y="28" width="28" height="8" rx="1" strokeWidth="2" fill="none" />
        <rect x="26" y="36" width="28" height="8" rx="1" strokeWidth="2" fill="none" />
        <rect x="26" y="44" width="28" height="8" rx="1" strokeWidth="2" fill="none" />
        <path d="M34 24 L40 20 L46 24" strokeWidth="1.5" fill="none" />
      </>
    ),
    wifi: (
      <>
        <path d="M22 34 C30 26 50 26 58 34" strokeWidth="2" fill="none" />
        <path d="M28 40 C34 34 46 34 52 40" strokeWidth="2" fill="none" />
        <path d="M34 46 C37 43 43 43 46 46" strokeWidth="2" fill="none" />
        <circle cx="40" cy="52" r="2.5" fill="currentColor" />
      </>
    ),
    delivery: (
      <>
        <rect x="22" y="30" width="22" height="18" rx="1" strokeWidth="2" fill="none" />
        <path d="M44 36 L54 36 L58 44 L58 48 L44 48 Z" strokeWidth="2" fill="none" />
        <circle cx="32" cy="52" r="4" strokeWidth="2" fill="none" />
        <circle cx="52" cy="52" r="4" strokeWidth="2" fill="none" />
      </>
    ),
    store: (
      <>
        <rect x="26" y="32" width="28" height="24" rx="1" strokeWidth="2" fill="none" />
        <path d="M26 32 L30 20 L50 20 L54 32" strokeWidth="2" fill="none" />
        <rect x="36" y="42" width="10" height="14" rx="1" strokeWidth="1.5" fill="none" />
      </>
    ),
    pet: (
      <>
        <ellipse cx="40" cy="46" rx="12" ry="10" strokeWidth="2" fill="none" />
        <circle cx="36" cy="42" r="1.5" fill="currentColor" />
        <circle cx="44" cy="42" r="1.5" fill="currentColor" />
        <path d="M30 30 C28 24 34 22 34 28" strokeWidth="2" fill="none" />
        <path d="M50 30 C52 24 46 22 46 28" strokeWidth="2" fill="none" />
      </>
    ),
  };

  return (
    <div className="w-[80px] h-[80px] md:w-[100px] md:h-[100px] rounded-full border-2 border-foreground/80 flex items-center justify-center mx-auto">
      <svg viewBox="0 0 80 80" className="w-[50px] h-[50px] md:w-[60px] md:h-[60px] text-foreground/80" stroke="currentColor" fill="none">
        {iconContent[type] || iconContent.washer}
      </svg>
    </div>
  );
}

export default function ServiceIconGrid() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Service</h2>
          <p className="text-sm text-muted-foreground mb-2">WashAlert Services</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <p className="text-base md:text-lg text-foreground leading-relaxed">
            WashAlert is a new kind of laundry service,
          </p>
          <p className="text-base md:text-lg text-foreground leading-relaxed">
            designed to make your everyday laundry experience smarter and more convenient.
          </p>
        </motion.div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-6 lg:gap-8">
          {services.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="text-center"
            >
              <ServiceIcon type={s.icon} />
              <h3 className="font-medium text-foreground text-xs md:text-sm whitespace-pre-line leading-snug mt-3 mb-1">{s.label}</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground">{s.sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 text-right">
          <p className="text-xs text-muted-foreground">※ Some services are available at select branches only.</p>
        </div>
      </div>
    </section>
  );
}
