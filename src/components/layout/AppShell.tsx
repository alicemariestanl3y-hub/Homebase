import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

type AppShellProps = {
  children: React.ReactNode;
  /** Kept for call-site compatibility; sign-out is on Account. */
  showSignOut?: boolean;
  showBottomNav?: boolean;
  hero?: React.ReactNode;
};

export function AppShell({
  children,
  showBottomNav = true,
  hero,
}: AppShellProps) {
  return (
    <div className="hb-app">
      <AppHeader />
      {hero}
      <div className="hb-app__body">{children}</div>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
}
