import { CodeEntry } from "./CodeEntry";

/**
 * The page a TikTok bio link points at.
 *
 * TikTok renders a URL inside a comment as dead text -- no tap target, on any
 * account -- so the link the bot posts cannot be pressed, which made the whole
 * feature unreachable on a phone. The way every TikTok shop already solves this
 * is the profile's Website field: one fixed, clickable link in the bio.
 *
 * So the comment carries a five-character code and this page takes it. The
 * merchant pastes this URL into their bio once and never touches it again.
 */
export const metadata = {
  title: "اكتب الكود",
  robots: { index: false, follow: false },
};

export default function CodePage() {
  return <CodeEntry />;
}
