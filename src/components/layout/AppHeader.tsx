import Link from "next/link";

type AppHeaderProps = {
  /** @deprecated Sign-out lives on Account; kept for AppShell compatibility. */
  showSignOut?: boolean;
  menuHref?: string;
};

/**
 * Consistent HomeBase brand header. Primary destinations live in BottomNav;
 * account/settings are secondary via the trailing control.
 */
export function AppHeader({ menuHref = "/account" }: AppHeaderProps) {
  return (
    <header className="hb-topbar">
      <span className="hb-topbar__spacer" aria-hidden="true" />
      <Link href="/" className="hb-topbar__brand">
        HOMEBASE
      </Link>
      <Link
        href={menuHref}
        className="hb-topbar__icon"
        aria-label="Account and settings"
      >
        <SettingsIcon />
      </Link>
    </header>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
