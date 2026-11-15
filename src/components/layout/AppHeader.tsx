import Link from "next/link";
import { SignOutButton } from "@/components/inventory/SignOutButton";

type AppHeaderProps = {
  showSignOut?: boolean;
  menuHref?: string;
};

export function AppHeader({ showSignOut = false, menuHref = "/account" }: AppHeaderProps) {
  return (
    <header className="hb-topbar">
      <Link href="/" className="hb-topbar__icon" aria-label="HomeBase home">
        <HouseIcon />
      </Link>
      <Link href="/" className="hb-topbar__brand">
        HOMEBASE
      </Link>
      {showSignOut ? (
        <div className="hb-topbar__menu">
          <SignOutButton />
        </div>
      ) : (
        <Link href={menuHref} className="hb-topbar__icon" aria-label="Account menu">
          <MenuIcon />
        </Link>
      )}
    </header>
  );
}

function HouseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
