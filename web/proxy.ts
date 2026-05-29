import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "dashboard_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24h

export function proxy(req: NextRequest) {
  const dashboardSecret = process.env.DASHBOARD_SECRET;

  // No secret configured → open access (dev mode)
  if (!dashboardSecret) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const cookie = req.cookies.get(COOKIE_NAME);

    // Already authenticated
    if (cookie?.value === dashboardSecret) return NextResponse.next();

    // Secret provided in URL → set cookie + redirect to clean URL
    const urlSecret = searchParams.get("secret");
    if (urlSecret === dashboardSecret) {
      const cleanUrl = req.nextUrl.clone();
      cleanUrl.searchParams.delete("secret");
      const res = NextResponse.redirect(cleanUrl);
      res.cookies.set(COOKIE_NAME, dashboardSecret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
      return res;
    }

    // Unauthorized
    return new NextResponse(
      `<!doctype html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb">
        <div style="text-align:center;padding:2rem;border:1px solid #e5e7eb;border-radius:1rem;background:#fff;max-width:320px">
          <div style="font-size:2.5rem">🔒</div>
          <h2 style="margin:.5rem 0">Access Restricted</h2>
          <p style="color:#6b7280;font-size:.875rem">Append <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">?secret=YOUR_SECRET</code> to the URL.</p>
        </div>
      </body></html>`,
      { status: 401, headers: { "Content-Type": "text/html" } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
