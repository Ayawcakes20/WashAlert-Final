import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiMenu, FiX, FiChevronDown } from "react-icons/fi";

const navLinks = [
  {
    label: "Services",
    children: [
      { label: "Laundry Booking", href: "/features" },
      { label: "Order Tracking", href: "/features" },
      { label: "Delivery", href: "/features" },
      { label: "GCash Payment", href: "/features" },
    ],
  },
  { label: "Branches", href: "/branches-public" },
  { label: "Download", href: "/download" },
  { label: "About", href: "/about-public" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdown, setDropdown] = useState<string | null>(null);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  const navBg = scrolled || !isHome
    ? "bg-background/95 backdrop-blur-md shadow-sm"
    : "bg-transparent";

  const textColor = scrolled || !isHome ? "text-foreground" : "text-primary-foreground";

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1400px] h-16 lg:h-20 flex items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <circle cx="12" cy="13" r="5" />
              <circle cx="12" cy="13" r="2" />
              <circle cx="8" cy="8" r="1" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className={`text-sm font-bold tracking-tight ${scrolled || !isHome ? "text-foreground" : "text-primary-foreground"}`}>
              WashAlert
            </span>
            <span className={`text-[9px] tracking-wider ${scrolled || !isHome ? "text-muted-foreground" : "text-primary-foreground/60"}`}>
              Laundry Place
            </span>
          </div>
        </Link>

        {/* Center nav links */}
        <nav className="hidden xl:flex flex-1 items-center justify-center gap-8 px-10">
          {navLinks.map((link) =>
            link.children ? (
              <div
                key={link.label}
                className="relative"
                onMouseEnter={() => setDropdown(link.label)}
                onMouseLeave={() => setDropdown(null)}
              >
                <button className={`flex items-center gap-1 text-sm font-medium ${textColor} hover:opacity-70 transition-opacity`}>
                  {link.label} <FiChevronDown className="w-3.5 h-3.5" />
                </button>
                <AnimatePresence>
                  {dropdown === link.label && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute top-full left-0 mt-2 w-52 bg-background rounded-lg shadow-lg border border-border py-2"
                    >
                      {link.children.map((child) => (
                        <Link
                          key={child.label}
                          to={child.href}
                          className="block px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                key={link.label}
                to={link.href!}
                className={`text-sm font-medium ${textColor} hover:opacity-70 transition-opacity`}
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* Right side buttons */}
        <div className="hidden md:flex items-center gap-3 ml-auto">
          <Link
            to="/branches-public"
            className={`text-sm font-medium px-5 py-2 rounded-sm border transition-all ${
              scrolled || !isHome
                ? "border-foreground/80 text-foreground bg-[hsl(58,100%,60%)] hover:bg-[hsl(58,100%,50%)]"
                : "border-primary-foreground/50 text-foreground bg-[hsl(58,100%,60%)] hover:bg-[hsl(58,100%,50%)]"
            }`}
          >
            Find a Branch
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium px-5 py-2 rounded-sm bg-foreground text-background flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
              <path d="M10 2a4 4 0 00-4 4v2H5a1 1 0 00-1 1v7a2 2 0 002 2h8a2 2 0 002-2V9a1 1 0 00-1-1h-1V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z" />
            </svg>
            Log-in
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`xl:hidden p-2 ${textColor} ml-2`}
        >
          {mobileOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
        </button>
      </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-t border-border overflow-hidden"
          >
            <div className="px-6 py-4 space-y-3">
              {navLinks.map((link) =>
                link.children ? (
                  <div key={link.label}>
                    <button
                      onClick={() => setDropdown(dropdown === link.label ? null : link.label)}
                      className="flex items-center justify-between w-full py-2 text-foreground font-medium"
                    >
                      {link.label} <FiChevronDown className={`w-4 h-4 transition-transform ${dropdown === link.label ? "rotate-180" : ""}`} />
                    </button>
                    {dropdown === link.label && (
                      <div className="pl-4 space-y-2">
                        {link.children.map((child) => (
                          <Link key={child.label} to={child.href} className="block py-1.5 text-sm text-muted-foreground hover:text-primary">
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link key={link.label} to={link.href!} className="block py-2 text-foreground font-medium">
                    {link.label}
                  </Link>
                )
              )}
              <Link to="/login" className="block py-2.5 text-center bg-foreground text-background rounded font-medium">
                Login
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
