import type { Metadata } from "next";
import { QueryProvider } from "@/lib/query-provider";
import { Nav } from "@/components/layout/nav";
import "./globals.css";
import { AuthSessionProvider } from "@/lib/session-provider";

export const metadata: Metadata = {
  title: "UFC Intelligence",
  description:
    "Career-deep fighter stats, live event coverage, and explainable fight predictions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
     <body>
        <AuthSessionProvider>
          <QueryProvider>
            <Nav />
            {children}
          </QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
