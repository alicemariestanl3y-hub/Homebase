import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

type AppShellProps = {
  children: React.ReactNode;
  showSignOut?: boolean;
  showBottomNav?: boolean;
  hero?: React.ReactNode;
};

export function AppShell({
  children,
  showSignOut = false,
  showBottomNav = true,
  hero,
}: AppShellProps) {
  return (
    <div className="hb-app">
      <AppHeader showSignOut={showSignOut} />
      {hero}
      <div className="hb-app__body">{children}</div>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
}
