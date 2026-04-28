import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logoLaundryHubs from "@/assets/logo-laundryhubs.webp";

const links = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/features" },
  { label: "Branches", href: "/branches" },
  { label: "Download", href: "/download" },
  { label: "About", href: "/about-public" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-brand-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:h-20 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src={logoLaundryHubs}
            alt="Triplets LaundryHubs"
            className="h-9 w-9 rounded-full object-cover ring-1 ring-brand-border"
          />
          <div className="leading-tight">
            <p className="text-sm font-bold text-brand-navy">WashAlert</p>
            <p className="text-[10px] font-medium tracking-wide text-brand-muted">Triplets LaundryHubs</p>
          </div>
        </Link>

        <nav className="ml-8 hidden flex-1 items-center justify-center gap-7 lg:flex">
          {links.map((link) => {
            const active = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`text-sm font-medium transition-colors ${
                  active ? "text-brand-navy" : "text-brand-muted hover:text-brand-navy"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2.5 sm:flex">
          <Link
            to="/branches"
            className="rounded-brand bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy transition hover:brightness-95"
          >
            Find a Branch
          </Link>
          <Link
            to="/login"
            className="rounded-brand bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-navyDark"
          >
            Log-in
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="ml-auto inline-flex rounded-brand border border-brand-border p-2 text-brand-navy lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-brand-border bg-white px-4 py-4 lg:hidden">
          <div className="space-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-brand px-3 py-2 text-sm font-medium text-brand-text hover:bg-brand-mintSoft"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/branches"
                onClick={() => setMobileOpen(false)}
                className="rounded-brand bg-brand-gold px-3 py-2 text-center text-sm font-semibold text-brand-navy"
              >
                Find Branch
              </Link>
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-brand bg-brand-navy px-3 py-2 text-center text-sm font-semibold text-white"
              >
                Log-in
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
