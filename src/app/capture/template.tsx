/**
 * Remount capture on every navigation so returning via Add → Photograph shelves
 * always shows the photo upload step, not a stale review screen from Soft Nav cache.
 */
export default function CaptureTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
