import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { branches } from "@/data/branches";
import { Clock3, MapPin, Phone, Navigation, Search } from "lucide-react";

const buildGoogleMapsDirectionsUrl = (branch: {
  name: string;
  area: string;
  address: string;
  coords?: { lat: number; lng: number };
}) => {
  const destination = branch.coords
    ? `${branch.coords.lat},${branch.coords.lng}`
    : `${branch.name}, ${branch.address}, ${branch.area}`;

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export default function BranchesPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return branches;
    return branches.filter((b) =>
      [b.name, b.area, b.address].some((field) => field.toLowerCase().includes(query)),
    );
  }, [search]);

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
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-mint">Branches</p>
          <h1 className="mt-2 text-4xl font-bold text-white md:text-5xl">Find your nearest laundry branch</h1>
          <p className="mt-4 max-w-3xl text-base text-white/80">
            Browse open locations, check operating hours, and launch directions instantly.
          </p>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branch, area, or address"
            className="h-11 w-full rounded-brand border border-brand-border bg-white pl-10 pr-4 text-sm text-brand-text outline-none transition focus:border-brand-mint"
          />
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((branch, index) => (
            <motion.article
              key={branch.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: index * 0.03 }}
              className="rounded-brand border border-brand-border bg-white p-6 shadow-brand"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-brand-navy">{branch.area}</h2>
                  <p className="text-sm font-medium text-brand-text">{branch.name}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    branch.status === "Open" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}
                >
                  {branch.status}
                </span>
              </div>

              <div className="space-y-2.5 text-sm text-brand-muted">
                <p className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-4 w-4 text-brand-navy" />
                  <span>{branch.hours}</span>
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-brand-navy" />
                  <span>{branch.address}</span>
                </p>
                <p className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 text-brand-navy" />
                  <span>{branch.phone}</span>
                </p>
              </div>

              <a
                href={buildGoogleMapsDirectionsUrl(branch)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-brand bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navyDark"
              >
                <Navigation className="h-4 w-4" />
                Get Directions
              </a>
            </motion.article>
          ))}
        </div>

        {!filtered.length ? (
          <div className="mt-8 rounded-brand border border-brand-border bg-white p-8 text-center text-sm text-brand-muted shadow-brand">
            No branches found for that search.
          </div>
        ) : null}
      </section>

      <Footer />
    </div>
  );
}
