import Link from "next/link";
import { AppShell } from "./AppShell";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AppShell>
      <section className="coming-soon">
        <p className="hb-kicker">Coming soon</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link href="/" className="hb-btn" style={{ display: "inline-block", marginTop: "1rem" }}>
          Back to inventory
        </Link>
      </section>
    </AppShell>
  );
}
