import type { Metadata } from "next";
import { VisitorLocaleProvider } from "@/components/VisitorLocaleProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "HERA",
  description: "Trợ lý khám phá di tích bằng AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-950 text-slate-200">
        <VisitorLocaleProvider>{children}</VisitorLocaleProvider>
      </body>
    </html>
  );
}
