/**
 * Remount grocery import on every navigation so returning via Add always
 * shows the source/upload step rather than a stale review screen.
 */
export default function GroceryTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
