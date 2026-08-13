import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

interface NavGroup {
  label: string;
  items: { href: string; label: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "About",
    items: [
      { href: "/about/our-story", label: "Our Story" },
      { href: "/about/vision-mission", label: "Vision & Mission" },
      { href: "/about/leadership", label: "Leadership" },
      { href: "/about/governance", label: "Governance" },
    ],
  },
  {
    label: "Get Involved",
    items: [
      { href: "/get-involved/donate", label: "Donate" },
      { href: "/get-involved/volunteer", label: "Volunteer" },
      { href: "/get-involved/partner", label: "Partner With Us" },
      { href: "/get-involved/sponsor-a-child", label: "Sponsor a Child" },
      { href: "/get-involved/corporate-support", label: "Corporate Support" },
      { href: "/get-involved/professional-support", label: "Professional Support" },
      { href: "/get-involved/fundraise", label: "Fundraise" },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/resources/policies", label: "Policies" },
      { href: "/resources/reports", label: "Reports" },
      { href: "/resources/gallery", label: "Gallery" },
      { href: "/resources/downloads", label: "Downloads" },
    ],
  },
];

function NavDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className="flex items-center gap-1 font-body text-sm text-cream-100 hover:text-gold-500 transition-colors py-2"
        aria-expanded={open}
      >
        {group.label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 bg-pine-900 border border-pine-700 rounded-lg shadow-xl py-2 min-w-[200px] z-20">
          {group.items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block px-4 py-2 text-sm font-body text-cream-100 hover:bg-pine-700 hover:text-gold-500 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SiteNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="hidden lg:flex items-center gap-6">
        <a href="/" className="font-body text-sm text-cream-100 hover:text-gold-500 transition-colors">
          Home
        </a>
        <NavDropdown group={NAV_GROUPS[0]} />
        <a href="/programmes" className="font-body text-sm text-cream-100 hover:text-gold-500 transition-colors">
          Our Programmes
        </a>
        <a href="/impact" className="font-body text-sm text-cream-100 hover:text-gold-500 transition-colors">
          Our Impact
        </a>
        <NavDropdown group={NAV_GROUPS[1]} />
        <a href="/news" className="font-body text-sm text-cream-100 hover:text-gold-500 transition-colors">
          News
        </a>
        <NavDropdown group={NAV_GROUPS[2]} />
        <a href="/contact" className="font-body text-sm text-cream-100 hover:text-gold-500 transition-colors">
          Contact
        </a>
      </nav>

      <button
        className="lg:hidden text-cream-100"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-pine-900 border-t border-pine-700 px-4 py-4 space-y-4 z-40">
          <a href="/" className="block font-body text-cream-100">
            Home
          </a>
          <a href="/programmes" className="block font-body text-cream-100">
            Our Programmes
          </a>
          <a href="/impact" className="block font-body text-cream-100">
            Our Impact
          </a>
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="font-body text-xs uppercase tracking-wide text-gold-500 mb-2">{g.label}</p>
              <div className="pl-3 space-y-2">
                {g.items.map((item) => (
                  <a key={item.href} href={item.href} className="block font-body text-sm text-cream-100">
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
          <a href="/news" className="block font-body text-cream-100">
            News
          </a>
          <a href="/contact" className="block font-body text-cream-100">
            Contact
          </a>
          <a
            href="https://wa.me/2349153114330"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center px-5 py-2 rounded-full bg-pine-700 text-cream-100 font-body text-sm font-semibold"
          >
            Chat on WhatsApp
          </a>
          <a
            href="/get-involved/donate"
            className="block text-center px-5 py-2 rounded-full bg-cherry-600 text-cream-100 font-body text-sm font-semibold"
          >
            Donate
          </a>
        </div>
      )}
    </>
  );
}
