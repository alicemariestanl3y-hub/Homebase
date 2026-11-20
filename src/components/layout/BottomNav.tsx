"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddActionSheet } from "./AddActionSheet";

/**
 * Avoid usePathname() — with Cache Components + the auth proxy it can throw
 * into the route error boundary on the published host. Sync from the browser
 * location after mount instead.
 */
export function BottomNav() {
  const [pathname, setPathname] = useState("/");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname);

    sync();
    window.addEventListener("popstate", sync);

    const { pushState, replaceState } = window.history;
    window.history.pushState = function (...args) {
      pushState.apply(this, args);
      sync();
    };
    window.history.replaceState = function (...args) {
      replaceState.apply(this, args);
      sync();
    };

    return () => {
      window.removeEventListener("popstate", sync);
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
    };
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <nav className="hb-bottom-nav" aria-label="Primary">
        <Link
          href="/"
          className={`hb-bottom-nav__item${isActive("/") ? " is-active" : ""}`}
          aria-current={isActive("/") ? "page" : undefined}
          onClick={() => setPathname("/")}
        >
          <NavIcon name="home" />
          <span>Home</span>
        </Link>

        <Link
          href="/inventory"
          className={`hb-bottom-nav__item${isActive("/inventory") ? " is-active" : ""}`}
          aria-current={isActive("/inventory") ? "page" : undefined}
          onClick={() => setPathname("/inventory")}
        >
          <NavIcon name="inventory" />
          <span>Inventory</span>
        </Link>

        <div className="hb-bottom-nav__add-slot">
          <button
            type="button"
            className="hb-bottom-nav__add"
            aria-haspopup="dialog"
            aria-expanded={addOpen}
            aria-label="Add to HomeBase"
            onClick={() => setAddOpen(true)}
          >
            <NavIcon name="add" />
            <span className="sr-only">Add</span>
          </button>
          <span className="hb-bottom-nav__add-label" aria-hidden="true">
            Add
          </span>
        </div>

        <Link
          href="/meals"
          className={`hb-bottom-nav__item${isActive("/meals") ? " is-active" : ""}`}
          aria-current={isActive("/meals") ? "page" : undefined}
          onClick={() => setPathname("/meals")}
        >
          <NavIcon name="meals" />
          <span>Meals</span>
        </Link>

        <Link
          href="/insights"
          className={`hb-bottom-nav__item${isActive("/insights") ? " is-active" : ""}`}
          aria-current={isActive("/insights") ? "page" : undefined}
          onClick={() => setPathname("/insights")}
        >
          <NavIcon name="chart" />
          <span>Insights</span>
        </Link>
      </nav>

      <AddActionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function NavIcon({
  name,
}: {
  name: "home" | "inventory" | "add" | "meals" | "chart";
}) {
  const common = {
    width: name === "add" ? 26 : 22,
    height: name === "add" ? 26 : 22,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "inventory":
      return (
        <svg {...common}>
          <path
            d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5v-9Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M12 12v8M5 7.5 12 12l7-4.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "add":
      return (
        <svg {...common}>
          <path
            d="M12 6v12M6 12h12"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "meals":
      return (
        <svg {...common}>
          <path
            d="M7 4v9M5 4v5a2 2 0 0 0 4 0V4M7 13v7M16 4v16M14 8c2.5 0 4 1.5 4 4v1h-4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path
            d="M5 19V10M12 19V5M19 19v-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
