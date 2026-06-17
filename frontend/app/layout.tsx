import type { Metadata, Viewport } from "next";
import { VisitorLocaleProvider } from "@/components/VisitorLocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "HERA — Heritage Explorer",
  description: "Explore heritage objects with AI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="overflow-x-hidden">
        <div className="artifact-grain" aria-hidden="true" />
        <VisitorLocaleProvider>{children}</VisitorLocaleProvider>
      </body>
    </html>
  );
}
