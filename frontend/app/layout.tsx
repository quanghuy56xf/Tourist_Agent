import type { Metadata } from "next";
import { Lato, Playfair_Display } from "next/font/google";
import { VisitorLocaleProvider } from "@/components/VisitorLocaleProvider";
import "./globals.css";

const lato = Lato({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HERA — Heritage Explorer",
  description: "Explore heritage objects with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${lato.variable} ${playfair.variable}`}>
      <body className={lato.className}>
        <div className="artifact-grain" aria-hidden="true" />
        <VisitorLocaleProvider>{children}</VisitorLocaleProvider>
      </body>
    </html>
  );
}
