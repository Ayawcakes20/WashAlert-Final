import { Link } from "react-router-dom";
import { FiFacebook, FiInstagram } from "react-icons/fi";

export default function Footer() {
  return (
    <footer className="bg-background border-t border-border">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Nav links row */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-10">
          <Link to="/branches-public" className="text-sm font-medium text-foreground hover:opacity-70 transition-opacity">Branches</Link>
          <Link to="/features" className="text-sm font-medium text-foreground hover:opacity-70 transition-opacity">Services</Link>
          <Link to="/about-public" className="text-sm font-medium text-foreground hover:opacity-70 transition-opacity">News</Link>
          <Link to="/about-public" className="text-sm font-medium text-foreground hover:opacity-70 transition-opacity">About</Link>
          <Link to="/download" className="text-sm font-medium text-foreground hover:opacity-70 transition-opacity">Download</Link>
        </div>

        {/* Social icons */}
        <div className="flex justify-center gap-6 mb-10">
          <a href="#" className="text-foreground hover:opacity-70 transition-opacity">
            <FiFacebook className="w-6 h-6" />
          </a>
          <a href="#" className="text-foreground hover:opacity-70 transition-opacity">
            <FiInstagram className="w-6 h-6" />
          </a>
        </div>

        {/* Bottom links */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8 text-xs text-muted-foreground">
          <Link to="/about-public" className="hover:opacity-70 transition-opacity">About Us</Link>
          <span>|</span>
          <Link to="/about-public" className="hover:opacity-70 transition-opacity">Privacy Policy</Link>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-foreground flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-background" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <circle cx="12" cy="13" r="5" />
                <circle cx="12" cy="13" r="2" />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-bold text-foreground">WashAlert</span>
              <span className="text-[8px] text-muted-foreground tracking-wider">Laundry Place</span>
            </div>
          </Link>
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-muted-foreground">
          © 2025 WashAlert. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
