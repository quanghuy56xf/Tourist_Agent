"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AdminSession,
  defaultAdminPath,
  getAdminSession,
} from "@/lib/adminAuth";

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [ready, setReady] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    setSession(getAdminSession());
    setReady(true);

    const onAuthChange = () => setSession(getAdminSession());
    window.addEventListener("admin-auth-changed", onAuthChange);
    return () => window.removeEventListener("admin-auth-changed", onAuthChange);
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (isLoginPage) {
      if (session) router.replace(defaultAdminPath(session.role));
      return;
    }

    if (!session) {
      router.replace("/admin/login");
      return;
    }

    if (session.role === "manager" && pathname === "/admin") {
      router.replace("/admin/groups");
    }
  }, [ready, session, pathname, router, isLoginPage]);

  if (!ready) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center">
        <p className="admin-muted text-sm">Đang tải...</p>
      </div>
    );
  }

  if (isLoginPage) {
    return session ? null : children;
  }

  if (!session) return null;

  if (session.role === "manager" && pathname === "/admin") {
    return null;
  }

  return children;
}
