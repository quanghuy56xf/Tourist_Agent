"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  AdminButton,
  AdminCard,
  AdminField,
  AdminInput,
  AdminPage,
  alertClass,
} from "@/components/admin/ui";
import { defaultAdminPath, setAdminSession } from "@/lib/adminAuth";
import { loginAdmin } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await loginAdmin(username.trim(), password);
      setAdminSession({
        username: result.username,
        role: result.role,
        token: result.token,
        groupIds: result.group_ids ?? [],
      });
      router.replace(defaultAdminPath(result.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-shell flex min-h-screen items-center justify-center px-4 py-8">
      <AdminPage className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="admin-brand-icon mx-auto mb-4 flex h-12 w-12 items-center justify-center text-lg">
            ✦
          </div>
          <p className="admin-eyebrow mb-2">HERA Ban quản lý</p>
          <h1 className="admin-title text-2xl">Đăng nhập</h1>
          <p className="admin-subtitle mt-2">
            Tài khoản admin có full quyền. Tài khoản quản lý không truy cập trang quản lý
            tài khoản.
          </p>
        </div>

        <AdminCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            <AdminField label="Tên đăng nhập">
              <AdminInput
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </AdminField>
            <AdminField label="Mật khẩu">
              <AdminInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </AdminField>

            {error && <div className={alertClass("error")}>{error}</div>}

            <AdminButton type="submit" disabled={loading} className="w-full py-3">
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </AdminButton>
          </form>
        </AdminCard>
      </AdminPage>
    </div>
  );
}
