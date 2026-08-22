import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Behind sign-in or identical for every visitor regardless of URL -
      // matches what's already excluded from sitemap.ts.
      disallow: [
        "/api/",
        "/account",
        "/roster",
        "/my-predictions",
        "/signin",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/design-sandbox",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
