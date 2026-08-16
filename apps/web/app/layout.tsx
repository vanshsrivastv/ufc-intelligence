import type { Metadata, Viewport } from "next";
import { QueryProvider } from "@/lib/query-provider";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";
import { BackToTop } from "@/components/layout/back-to-top";
import { ToastProvider } from "@/components/ui/toast-provider";
import "./globals.css";
import { AuthSessionProvider } from "@/lib/session-provider";

export const metadata: Metadata = {
  title: "UFC Intelligence",
  description:
    "Career-deep fighter stats, live event coverage, and explainable fight predictions.",
};

// Without this, mobile browsers assume the page is a desktop-width
// design (~980px) and shrink the whole page to fit the screen instead of
// laying it out at the device's actual width - reads as everything being
// tiny and "zoomed out" with no way to interact at a normal scale.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
     <body className="flex min-h-screen flex-col">
        <AuthSessionProvider>
          <QueryProvider>
            <ToastProvider>
              <Nav />
              <div className="flex-1">{children}</div>
              <Footer />
              <BackToTop />
            </ToastProvider>
          </QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
