import { redirect } from "next/navigation";

/**
 * The per-account console used to live here, duplicating the main bot screen: the
 * same rules, the same settings, the same videos, in a different layout. Two doors to
 * one room read as two rooms, which is how it was reported — "the same tools again,
 * what is the difference?".
 *
 * There is one console now. This route stays so old links and bookmarks still land
 * somewhere, and sends them to it.
 */
export default async function TikTokAccountConsoleRedirect() {
  redirect("/tiktok-bot");
}
