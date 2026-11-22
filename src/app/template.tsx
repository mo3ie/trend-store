// Remounts on every top-level navigation, so its entrance animation replays
// each time a page opens. The wrapper itself only fades (opacity never changes
// how position:fixed children are placed); the rise/blur lives on inner
// sections in globals.css, scoped to the TREND Glass storefront.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="ui-page flex flex-1 flex-col">{children}</div>;
}
