import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** /r/<token> — the customer-facing private reply page. */
const PRIVATE_LINK = /^\/r\/([A-Za-z0-9]{1,32})$/;

export async function middleware(request: NextRequest) {
  /*
   * The private-reply page marks a link as seen so a refresh does not spend the
   * customer’s single open. That marking has to happen HERE.
   *
   * It was in the page itself, which crashed every visit: Next forbids cookie
   * writes during a render -- "HTTP does not allow setting cookies after streaming
   * starts, so you must use .set in a Server Function or Route Handler"
   * (next/dist/docs .../functions/cookies.md). The page threw before it rendered a
   * single line, and every customer who tapped a price link got an error screen.
   *
   * Middleware owns the response headers, so it can both read the cookie and write
   * it, and it tells the page which case it is through a request header the page
   * cannot be lied to about: the value is overwritten here on every request, so a
   * forged x-pl-seen from the client is discarded.
   *
   * Returned early, before the Supabase session work below: this route is public,
   * has no user, and must stay fast for someone on a phone over mobile data.
   */
  const pl = request.nextUrl.pathname.match(PRIVATE_LINK);
  if (pl) {
    const token = pl[1];
    const seen = request.cookies.get(`pl_${token}`)?.value === "1";
    const headers = new Headers(request.headers);
    headers.set("x-pl-seen", seen ? "1" : "0");
    const res = NextResponse.next({ request: { headers } });
    if (!seen) {
      res.cookies.set(`pl_${token}`, "1", {
        httpOnly: true, sameSite: "lax", secure: true,
        path: `/r/${token}`, maxAge: 60 * 60 * 24 * 7,
      });
    }
    return res;
  }

  const response = NextResponse.next();

  // Anon client — for verifying the user's JWT from cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Service-role client — for reading profiles without RLS interference
  const admin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "employee")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/r/:path*"],
};
