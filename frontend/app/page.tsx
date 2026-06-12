import Link from "next/link";

export default function HomePage() {
  return (
    <div className="text-center space-y-8 py-12">
      <h1 className="text-3xl font-bold">Tra cứu vật thể bằng AI</h1>
      <p className="text-slate-400 max-w-md mx-auto">
        Đăng ký vật thể từ nhiều góc nhìn, sau đó quét camera để truy xuất thông
        tin mô tả bằng DINOv2.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/register"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          Đăng ký vật thể
        </Link>
        <Link
          href="/groups"
          className="px-6 py-3 border border-slate-600 hover:border-slate-400 rounded-lg font-medium transition-colors"
        >
          Quản lý nhóm
        </Link>
        <Link
          href="/search"
          className="px-6 py-3 border border-slate-600 hover:border-slate-400 rounded-lg font-medium transition-colors"
        >
          Quét tìm kiếm
        </Link>
      </div>
    </div>
  );
}
