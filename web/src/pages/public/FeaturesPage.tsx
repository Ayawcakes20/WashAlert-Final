import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { featureDetails } from "@/data/features";

export default function FeaturesPage() {
  const coreServices = featureDetails.slice(0, 4);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <Navbar />

      <section className="bg-brand-navy py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">Services</p>
          <h1 className="mt-2 text-4xl font-bold text-white md:text-5xl">Laundry services built for speed and visibility</h1>
          <p className="mt-4 max-w-3xl text-base text-white/80">
            Explore how WashAlert powers booking, tracking, delivery updates, and payments across Triplets LaundryHubs and SpeedyWash branches.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-6 md:grid-cols-2">
          {coreServices.map((service) => (
            <article key={service.id} className="rounded-brand border border-brand-border bg-white p-6 shadow-brand">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-mint">{service.subtitle}</p>
              <h2 className="mt-2 text-2xl font-bold text-brand-navy">{service.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted">{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-6 text-center lg:px-8">
          <h2 className="text-3xl font-bold text-brand-navy md:text-4xl">Need a nearby branch now?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted">
            Locate an open branch and get directions in one tap.
          </p>
          <Link
            to="/branches-public"
            className="mt-6 inline-flex items-center gap-1 rounded-brand bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-navy transition hover:brightness-95"
          >
            View Branches <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
