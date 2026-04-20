import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const news = [
  { date: "2025.01.20", text: "Predictive inventory system activated across all branches" },
  { date: "2025.01.15", text: "AI Chat Support now available 24/7 for all customers" },
  { date: "2025.01.10", text: "Live delivery tracking feature launched — track your rider in real time" },
  { date: "2025.01.05", text: "GCash payment integration now live via PayMongo" },
  { date: "2025.01.01", text: "WashAlert now available in 10 branches across Metro Manila" },
];

export default function NewsSection() {
  return (
    <section className="py-20 lg:py-28 bg-[hsl(220,10%,18%)]">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">News</h2>
        </motion.div>
        <div className="border-t border-primary-foreground/10">
          {news.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8 py-5 border-b border-primary-foreground/10 group cursor-pointer hover:opacity-70 transition-opacity"
            >
              <span className="text-sm text-primary-foreground/50 font-medium whitespace-nowrap">{item.date}</span>
              <p className="text-primary-foreground/80 text-sm md:text-base leading-relaxed">{item.text}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link to="/about-public" className="inline-block text-base font-medium text-primary-foreground border-b-2 border-primary-foreground pb-1 hover:opacity-70 transition-opacity">
            Read More
          </Link>
        </div>
      </div>
    </section>
  );
}
