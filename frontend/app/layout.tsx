import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DINOv2 Object Search",
  description: "Tra cứu vật thể từ nhiều góc nhìn bằng AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-slate-950 text-slate-200">
        {children}
      </body>
    </html>
  );
}
