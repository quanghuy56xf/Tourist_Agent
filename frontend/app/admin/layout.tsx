import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">C2-App-060</h1>
          <p className="text-xs text-slate-400 uppercase tracking-wider">Admin Panel</p>
        </div>
        
        <nav className="flex flex-col gap-2">
          <Link 
            href="/admin/register" 
            className="px-4 py-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            Đăng ký vật thể
          </Link>
          <Link 
            href="/admin/groups" 
            className="px-4 py-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            Quản lý nhóm
          </Link>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            &larr; Về trang Camera (Public)
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
