"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "home", soon: false },
  { href: "/capture", label: "Add items", icon: "camera", soon: false },
  { href: "/shopping", label: "Shopping", icon: "list", soon: true },
  { href: "/meals", label: "Meals", icon: "meals", soon: true },
  { href: "/insights", label: "Insights", icon: "chart", soon: true },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="hb-bottom-nav" aria-label="Primary">
      {ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`hb-bottom-nav__item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
            {item.soon ? <span className="hb-soon-dot" title="Coming soon" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function NavIcon({ name }: { name: (typeof ITEMS)[number]["icon"] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-1.8A1 1 0 0 1 10.5 4h3a1 1 0 0 1 .8.4L15.5 6h2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9Z" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "meals":
      return (
        <svg {...common}>
          <path d="M7 4v9M5 4v5a2 2 0 0 0 4 0V4M7 13v7M16 4v16M14 8c2.5 0 4 1.5 4 4v1h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M5 19V10M12 19V5M19 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}
