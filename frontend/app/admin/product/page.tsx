import {
  AdminCard,
  AdminLink,
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/ui";

export default function AdminProductPage() {
  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Sản phẩm"
        title="Thông tin sản phẩm"
        description="HERA — hệ thống hướng dẫn tham quan di tích thông minh"
      />

      <AdminCard title="HERA">
        <p className="text-sm leading-relaxed">
          HERA giúp khách tham quan khám phá di tích qua quét hiện vật, nghe câu chuyện do AI
          tạo theo từng đối tượng khán giả, và tham gia tour khám phá có gợi ý tại từng điểm
          dừng.
        </p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="admin-muted mb-1">Mã dự án</dt>
            <dd>C2-App-060</dd>
          </div>
          <div>
            <dt className="admin-muted mb-1">Phiên bản</dt>
            <dd>0.1.0</dd>
          </div>
        </dl>
      </AdminCard>

      <AdminCard title="Tính năng chính">
        <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed">
          <li>Quét nhận diện hiện vật bằng camera</li>
          <li>Nội dung đa persona (trẻ em, Gen Z, khách quốc tế)</li>
          <li>Tour khám phá với gợi ý từng điểm dừng</li>
          <li>RAG tài liệu khu di tích cho trợ lý AI</li>
          <li>Quản trị hiện vật, tour và tài liệu theo khu di tích</li>
        </ul>
      </AdminCard>

      <AdminLink href="/">Xem trang dành cho khách tham quan →</AdminLink>
    </AdminPage>
  );
}
