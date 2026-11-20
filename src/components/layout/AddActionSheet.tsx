"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

type AddActionSheetProps = {
  open: boolean;
  onClose: () => void;
};

function freshHref(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}fresh=${Date.now()}`;
}

const ACTIONS = [
  {
    path: "/capture",
    title: "Photograph shelves",
    description: "Smart Capture from pantry, fridge or freezer photos.",
  },
  {
    path: "/grocery",
    title: "Import grocery order",
    description: "Paste a Woolworths email or upload receipt screenshots.",
  },
  {
    path: "/inventory?add=1",
    title: "Add item manually",
    description: "Type a product into your household inventory.",
  },
] as const;

export function AddActionSheet({ open, onClose }: AddActionSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="hb-sheet" role="presentation">
      <button
        type="button"
        className="hb-sheet__backdrop"
        aria-label="Close add menu"
        onClick={onClose}
      />
      <div
        className="hb-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="hb-sheet__handle" aria-hidden="true" />
        <div className="hb-sheet__head">
          <h2 id={titleId} className="hb-sheet__title">
            Add to HomeBase
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="hb-sheet__close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <ul className="hb-sheet__list">
          {ACTIONS.map((action) => (
            <li key={action.path}>
              <Link
                href={freshHref(action.path)}
                className="hb-sheet__action"
                onClick={onClose}
              >
                <span className="hb-sheet__action-title">{action.title}</span>
                <span className="hb-sheet__action-desc">
                  {action.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
