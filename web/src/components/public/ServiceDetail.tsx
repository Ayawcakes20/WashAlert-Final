import { motion } from "framer-motion";
import { Link } from "react-router-dom";

interface Props {
  number: number;
  title: string;
  description: string;
  icons: string[];
  images: string[];
  bgColor: "gray" | "light-gray";
}

function SmallIcon({ type }: { type: string }) {
  const iconMap: Record<string, JSX.Element> = {
    washer: <><circle cx="20" cy="24" r="8" strokeWidth="1.5" fill="none" /><circle cx="20" cy="24" r="4" strokeWidth="1" fill="none" /><rect x="13" y="10" width="14" height="4" rx="1" strokeWidth="1.5" fill="none" /></>,
    dryer: <><circle cx="20" cy="24" r="8" strokeWidth="1.5" fill="none" /><path d="M16 22 C18 20 22 26 24 24" strokeWidth="1" fill="none" /><rect x="13" y="10" width="14" height="4" rx="1" strokeWidth="1.5" fill="none" /></>,
    detergent: <><circle cx="17" cy="24" r="4" strokeWidth="1.5" fill="none" /><circle cx="23" cy="24" r="4" strokeWidth="1.5" fill="none" /><circle cx="20" cy="17" r="4" strokeWidth="1.5" fill="none" /></>,
    phone: <><rect x="14" y="8" width="12" height="24" rx="2" strokeWidth="1.5" fill="none" /><line x1="14" y1="14" x2="26" y2="14" strokeWidth="1" /><line x1="14" y1="28" x2="26" y2="28" strokeWidth="1" /></>,
    calendar: <><rect x="10" y="12" width="20" height="18" rx="2" strokeWidth="1.5" fill="none" /><line x1="10" y1="18" x2="30" y2="18" strokeWidth="1" /><line x1="16" y1="9" x2="16" y2="15" strokeWidth="1.5" /><line x1="24" y1="9" x2="24" y2="15" strokeWidth="1.5" /></>,
    notification: <><path d="M14 22 C14 16 20 12 20 12 C20 12 26 16 26 22 L28 26 L12 26 Z" strokeWidth="1.5" fill="none" /><circle cx="20" cy="30" r="2" strokeWidth="1" fill="none" /></>,
    wifi: <><path d="M10 18 C14 14 26 14 30 18" strokeWidth="1.5" fill="none" /><path d="M14 22 C17 19 23 19 26 22" strokeWidth="1.5" fill="none" /><circle cx="20" cy="27" r="2" fill="currentColor" /></>,
    basket: <><path d="M10 20 L14 30 L26 30 L30 20" strokeWidth="1.5" fill="none" /><line x1="8" y1="20" x2="32" y2="20" strokeWidth="1.5" /><line x1="20" y1="20" x2="20" y2="30" strokeWidth="1" /></>,
    tracking: <><circle cx="20" cy="20" r="10" strokeWidth="1.5" fill="none" /><circle cx="20" cy="20" r="4" strokeWidth="1" fill="none" /><circle cx="20" cy="20" r="1.5" fill="currentColor" /></>,
    checkmark: <><circle cx="20" cy="20" r="10" strokeWidth="1.5" fill="none" /><path d="M14 20 L18 24 L26 16" strokeWidth="2" fill="none" /></>,
    map: <><path d="M20 10 C20 10 30 18 30 24 C30 30 10 30 10 24 C10 18 20 10 20 10Z" strokeWidth="1.5" fill="none" /><circle cx="20" cy="22" r="3" strokeWidth="1.5" fill="none" /></>,
    delivery: <><rect x="8" y="16" width="14" height="12" rx="1" strokeWidth="1.5" fill="none" /><path d="M22 20 L28 20 L32 24 L32 28 L22 28 Z" strokeWidth="1.5" fill="none" /><circle cx="14" cy="30" r="2.5" strokeWidth="1.5" fill="none" /><circle cx="28" cy="30" r="2.5" strokeWidth="1.5" fill="none" /></>,
    gps: <><circle cx="20" cy="20" r="6" strokeWidth="1.5" fill="none" /><line x1="20" y1="8" x2="20" y2="14" strokeWidth="1.5" /><line x1="20" y1="26" x2="20" y2="32" strokeWidth="1.5" /><line x1="8" y1="20" x2="14" y2="20" strokeWidth="1.5" /><line x1="26" y1="20" x2="32" y2="20" strokeWidth="1.5" /></>,
    timer: <><circle cx="20" cy="22" r="10" strokeWidth="1.5" fill="none" /><line x1="20" y1="22" x2="20" y2="16" strokeWidth="1.5" /><line x1="20" y1="22" x2="24" y2="22" strokeWidth="1.5" /><line x1="20" y1="10" x2="20" y2="12" strokeWidth="1.5" /></>,
    payment: <><rect x="8" y="14" width="24" height="16" rx="2" strokeWidth="1.5" fill="none" /><line x1="8" y1="20" x2="32" y2="20" strokeWidth="1.5" /><line x1="12" y1="26" x2="20" y2="26" strokeWidth="1" /></>,
    gcash: <><circle cx="20" cy="20" r="10" strokeWidth="1.5" fill="none" /><text x="14" y="25" fontSize="12" fontWeight="bold" fill="currentColor" stroke="none">G</text></>,
    secure: <><rect x="13" y="20" width="14" height="12" rx="2" strokeWidth="1.5" fill="none" /><path d="M15 20 L15 16 C15 12 25 12 25 16 L25 20" strokeWidth="1.5" fill="none" /><circle cx="20" cy="26" r="1.5" fill="currentColor" /></>,
    receipt: <><rect x="12" y="8" width="16" height="26" rx="1" strokeWidth="1.5" fill="none" /><line x1="16" y1="14" x2="24" y2="14" strokeWidth="1" /><line x1="16" y1="18" x2="24" y2="18" strokeWidth="1" /><line x1="16" y1="22" x2="22" y2="22" strokeWidth="1" /><path d="M12 34 L16 30 L20 34 L24 30 L28 34" strokeWidth="1" fill="none" /></>,
  };

  return (
    <div className="w-[50px] h-[50px] md:w-[60px] md:h-[60px] rounded-full border border-primary-foreground/40 flex items-center justify-center">
      <svg viewBox="0 0 40 40" className="w-[30px] h-[30px] md:w-[36px] md:h-[36px] text-primary-foreground/80" stroke="currentColor" fill="none">
        {iconMap[type] || iconMap.washer}
      </svg>
    </div>
  );
}

export default function ServiceDetail({ number, title, description, icons, images, bgColor }: Props) {
  const bg = bgColor === "gray" ? "bg-[hsl(220,10%,35%)]" : "bg-[hsl(220,10%,55%)]";

  return (
    <>
      {/* Title section with big number */}
      <section className={`relative ${bg} py-20 lg:py-28 overflow-hidden`}>
        {/* Big number watermark */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[200px] md:text-[300px] font-black text-primary-foreground/5 leading-none select-none -ml-4">
          {number}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-8">
              {title}
            </h2>
            <div className="max-w-2xl mx-auto">
              <p className="text-sm md:text-base text-primary-foreground/80 leading-relaxed">
                {description}
              </p>
            </div>
          </motion.div>

          {/* Icons row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-4 md:gap-6 mt-12 flex-wrap"
          >
            {icons.map((icon, i) => (
              <SmallIcon key={i} type={icon} />
            ))}
          </motion.div>

          {/* Read More link */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="mt-10"
          >
            <Link
              to="/features"
              className="inline-block text-base font-medium text-primary-foreground border-b-2 border-primary-foreground pb-1 hover:opacity-70 transition-opacity"
            >
              Read More
            </Link>
          </motion.div>
        </div>
      </section>

      {/* 2x2 image grid */}
      <div className="grid grid-cols-2 grid-rows-2">
        {images.map((img, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
          >
            <img
              src={img}
              alt={`${title} ${i + 1}`}
              className="w-full h-[200px] md:h-[300px] lg:h-[350px] object-cover"
            />
          </motion.div>
        ))}
      </div>
    </>
  );
}
