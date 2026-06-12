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
      <body>
        <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg text-blue-400">
              DINOv2 Search
            </Link>
            <div className="flex gap-4 text-sm">
              <Link
                href="/register"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Đăng ký
              </Link>
              <Link
                href="/groups"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Quản lý nhóm
              </Link>
              <Link
                href="/search"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Quét tìm
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
