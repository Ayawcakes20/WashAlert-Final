import { motion } from "framer-motion";

export default function BrandIntro() {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-12">
            Today, with WashAlert.
          </h2>
          <div className="space-y-2">
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              Doing laundry. Dirty clothes become clean.
            </p>
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              Just that simple act can brighten your entire day.
            </p>
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              Fluffy towels bring happiness. Clean shirts give you confidence.
            </p>
          </div>

          <div className="mt-10 space-y-2">
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              WashAlert's vision of "laundry" is not just about getting things clean,
            </p>
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              but about creating that positive feeling in your everyday life.
            </p>
          </div>

          <div className="mt-10 space-y-2">
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              The satisfaction of freshly washed clothes,
            </p>
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              and even the time spent waiting — we want to make it all comfortable.
            </p>
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              Turning laundry from a chore into something you actually look forward to.
            </p>
          </div>

          <div className="mt-10">
            <p className="text-base md:text-lg text-foreground leading-relaxed">
              A fresh start wrapped in clean clothes — that's WashAlert.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
