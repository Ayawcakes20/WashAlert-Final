import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import logoLaundryHubs from "@/assets/logo-laundryhubs.webp";

export default function Footer() {
  return (
    <footer className="bg-brand-navy text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <img
                src={logoLaundryHubs}
                alt="Triplets LaundryHubs"
                className="h-9 w-9 rounded-full object-cover ring-1 ring-white/20"
              />
              <div>
                <p className="text-sm font-bold">WashAlert</p>
                <p className="text-[11px] text-white/70">Triplets LaundryHubs</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-white/80">
              Laundry made simple with booking, tracking, payment, and delivery updates across every branch.
            </p>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold text-brand-mint">Quick Links</p>
            <div className="space-y-2 text-sm text-white/80">
              <Link to="/" className="block transition hover:text-brand-mint">Home</Link>
              <Link to="/features" className="block transition hover:text-brand-mint">Services</Link>
              <Link to="/branches" className="block transition hover:text-brand-mint">Branches</Link>
              <Link to="/download" className="block transition hover:text-brand-mint">Download</Link>
              <Link to="/about-public" className="block transition hover:text-brand-mint">About</Link>
            </div>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold text-brand-mint">Customer Support</p>
            <div className="space-y-3 text-sm text-white/80">
              <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> +63 2 8123 4567</p>
              <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> support@washalert.app</p>
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Metro Manila, Philippines</p>
            </div>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold text-brand-mint">Start Now</p>
            <p className="mb-4 text-sm text-white/80">
              Find your nearest branch and book your next laundry service in minutes.
            </p>
            <div className="flex gap-2">
              <Link
                to="/branches"
                className="rounded-brand bg-brand-gold px-3 py-2 text-xs font-semibold text-brand-navy transition hover:brightness-95"
              >
                Find Branch
              </Link>
              <Link
                to="/login"
                className="rounded-brand border border-white/25 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Log-in
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/20 pt-5 text-xs text-white/70">
          © {new Date().getFullYear()} WashAlert by Triplets LaundryHubs. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
