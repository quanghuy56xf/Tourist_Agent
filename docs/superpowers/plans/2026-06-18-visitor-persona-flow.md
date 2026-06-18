# Kế hoạch triển khai luồng persona khách tham quan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ bước bắt buộc chọn persona, đưa khách từ trang chọn khu di tích đến thẳng trang phương thức khám phá, đồng thời cung cấp bộ chọn persona tùy chọn dùng trong phiên hiện tại.

**Architecture:** Tách quy tắc lưu và chuẩn hóa persona thành một thư viện frontend độc lập, sau đó cung cấp trạng thái persona qua React context để mọi trang khách dùng chung. Trang chọn khu di tích khởi tạo lượt tham quan mới; trang phương thức hiển thị bộ chọn persona cạnh ngôn ngữ; trang nội dung hiện vật lấy persona từ context thay vì `localStorage`.

**Tech Stack:** Next.js 14, React 18, TypeScript, `node:test`/`assert` dạng kiểm thử nguồn hiện có, `sessionStorage`, Tailwind CSS hiện tại.

---

## Cấu trúc tệp

- Tạo `frontend/lib/visitorPersona.ts`: hằng số, kiểu dữ liệu, chuẩn hóa, đọc/ghi/reset persona phiên.
- Tạo `frontend/components/VisitorPersonaProvider.tsx`: trạng thái persona dùng chung cho luồng khách.
- Tạo `frontend/components/PersonaSelector.tsx`: bộ chọn persona nhỏ gọn theo theme hiện tại.
- Sửa `frontend/app/layout.tsx`: bọc ứng dụng bằng provider persona.
- Sửa `frontend/app/page.tsx`: khi chọn khu di tích, reset persona và đi thẳng tới `/method`.
- Sửa `frontend/app/[groupSlug]/page.tsx`: loại bỏ màn hình chọn persona cũ và chuyển hướng tương thích tới `/method`.
- Sửa `frontend/app/[groupSlug]/method/page.tsx`: đặt bộ chọn ngôn ngữ và persona ở góc trên bên phải.
- Sửa `frontend/app/[groupSlug]/item/[id]/page.tsx`: dùng persona từ provider cho nội dung và chat.
- Sửa `frontend/lib/i18n.ts`: thêm nhãn persona tiếng Việt và tiếng Anh.
- Tạo `frontend/tests/visitor-persona-flow.test.cjs`: kiểm thử hợp đồng luồng, lưu phiên và tích hợp trang.

### Task 1: Thư viện lưu persona theo phiên

**Files:**
- Create: `frontend/lib/visitorPersona.ts`
- Test: `frontend/tests/visitor-persona-flow.test.cjs`

- [ ] **Step 1: Viết kiểm thử thất bại cho hợp đồng persona**

Kiểm tra tệp thư viện phải định nghĩa:

```js
assert.match(personaSource, /export const DEFAULT_VISITOR_PERSONA = "Mặc định"/);
assert.match(personaSource, /export const VISITOR_PERSONA_SESSION_KEY = "hera_visitor_persona"/);
assert.match(personaSource, /sessionStorage/);
assert.doesNotMatch(personaSource, /localStorage\.setItem/);
assert.match(personaSource, /LEGACY_VISITOR_PERSONA_KEY = "user_persona"/);
```

- [ ] **Step 2: Chạy kiểm thử và xác nhận thất bại**

Run: `node frontend/tests/visitor-persona-flow.test.cjs`

Expected: FAIL vì `frontend/lib/visitorPersona.ts` chưa tồn tại.

- [ ] **Step 3: Viết triển khai tối thiểu**

Thư viện cung cấp:

```ts
export const VISITOR_PERSONAS = [
  "Mặc định",
  "Family Visitor",
  "Gen Z Explorer",
] as const;

export type VisitorPersona = (typeof VISITOR_PERSONAS)[number];
export const DEFAULT_VISITOR_PERSONA: VisitorPersona = "Mặc định";
export const VISITOR_PERSONA_SESSION_KEY = "hera_visitor_persona";
export const LEGACY_VISITOR_PERSONA_KEY = "user_persona";

export function normalizeVisitorPersona(value: string | null): VisitorPersona;
export function readSessionPersona(storage: Pick<Storage, "getItem">): VisitorPersona;
export function writeSessionPersona(storage: Pick<Storage, "setItem">, persona: VisitorPersona): void;
export function startVisitorSession(session: Pick<Storage, "setItem">, local: Pick<Storage, "removeItem">): void;
```

`startVisitorSession` ghi `Mặc định` vào `sessionStorage` và xóa khóa cũ
`user_persona` khỏi `localStorage`.

- [ ] **Step 4: Chạy kiểm thử và xác nhận phần thư viện đạt**

Run: `node frontend/tests/visitor-persona-flow.test.cjs`

Expected: Các assertion thư viện PASS; các assertion tích hợp chưa viết hoặc chưa chạy.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/visitorPersona.ts frontend/tests/visitor-persona-flow.test.cjs
git commit -m "feat: add session persona preferences"
```

### Task 2: Provider và bộ chọn persona

**Files:**
- Create: `frontend/components/VisitorPersonaProvider.tsx`
- Create: `frontend/components/PersonaSelector.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/lib/i18n.ts`
- Test: `frontend/tests/visitor-persona-flow.test.cjs`

- [ ] **Step 1: Viết kiểm thử thất bại cho provider và selector**

Thêm assertion:

```js
assert.match(layoutSource, /VisitorPersonaProvider/);
assert.match(providerSource, /readSessionPersona\(window\.sessionStorage\)/);
assert.match(providerSource, /writeSessionPersona\(window\.sessionStorage, next\)/);
assert.match(selectorSource, /useVisitorPersona/);
assert.match(selectorSource, /t\.persona\.general/);
assert.match(selectorSource, /t\.persona\.family/);
assert.match(selectorSource, /t\.persona\.genZ/);
```

- [ ] **Step 2: Chạy kiểm thử và xác nhận thất bại**

Run: `node frontend/tests/visitor-persona-flow.test.cjs`

Expected: FAIL vì provider, selector và khóa dịch chưa tồn tại.

- [ ] **Step 3: Viết provider tối thiểu**

Provider khởi tạo `Mặc định`, đọc `sessionStorage` sau mount, cung cấp:

```ts
type VisitorPersonaContextValue = {
  persona: VisitorPersona;
  ready: boolean;
  setPersona: (persona: VisitorPersona) => void;
};
```

Nếu truy cập storage lỗi, provider giữ `Mặc định` trong state và vẫn đặt
`ready = true`.

- [ ] **Step 4: Viết selector theo theme hiện tại**

Dùng một `<select>` nhỏ gọn với:

```tsx
className="rounded-full px-3 py-2 text-xs font-bold"
style={{
  background: "var(--secondary)",
  border: "1px solid var(--border)",
  color: "var(--foreground)",
}}
```

Nhãn hiển thị lấy từ `t.persona`, còn `value` dùng ba giá trị backend ổn định.

- [ ] **Step 5: Bọc provider và thêm bản dịch**

Trong `frontend/app/layout.tsx`, đặt `VisitorPersonaProvider` bên trong
`VisitorLocaleProvider`. Thêm:

```ts
persona: {
  label: "Đối tượng",
  general: "Phổ thông",
  family: "Trẻ em / Gia đình",
  genZ: "Gen Z",
}
```

và bản tiếng Anh tương ứng với `General`, `Children / Family`, `Gen Z`.

- [ ] **Step 6: Chạy kiểm thử**

Run: `node frontend/tests/visitor-persona-flow.test.cjs`

Expected: PASS cho provider, selector và bản dịch.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/VisitorPersonaProvider.tsx frontend/components/PersonaSelector.tsx frontend/app/layout.tsx frontend/lib/i18n.ts frontend/tests/visitor-persona-flow.test.cjs
git commit -m "feat: add optional visitor persona selector"
```

### Task 3: Rút gọn hành trình và tích hợp persona

**Files:**
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/[groupSlug]/page.tsx`
- Modify: `frontend/app/[groupSlug]/method/page.tsx`
- Modify: `frontend/app/[groupSlug]/item/[id]/page.tsx`
- Test: `frontend/tests/visitor-persona-flow.test.cjs`

- [ ] **Step 1: Viết kiểm thử thất bại cho luồng mới**

Thêm assertion:

```js
assert.match(rootHomeSource, /startVisitorSession\(window\.sessionStorage, window\.localStorage\)/);
assert.match(rootHomeSource, /router\.push\(`\/\$\{slug\}\/method`\)/);
assert.doesNotMatch(groupHomeSource, /const personas:/);
assert.match(groupHomeSource, /router\.replace\(groupMethodPath\)/);
assert.match(methodSource, /<LanguageSelector compact \/>/);
assert.match(methodSource, /<PersonaSelector \/>/);
assert.match(itemSource, /useVisitorPersona\(\)/);
assert.doesNotMatch(itemSource, /localStorage\.getItem\("user_persona"\)/);
```

- [ ] **Step 2: Chạy kiểm thử và xác nhận thất bại**

Run: `node frontend/tests/visitor-persona-flow.test.cjs`

Expected: FAIL ở điều hướng, selector và trang hiện vật.

- [ ] **Step 3: Khởi tạo phiên khi chọn khu di tích**

Trong `handleSelect` của trang `/`:

```ts
const slug = rememberVisitorGroup(group);
startVisitorSession(window.sessionStorage, window.localStorage);
router.push(`/${slug}/method`);
```

- [ ] **Step 4: Thay màn hình persona cũ bằng chuyển hướng tương thích**

Trang `/<groupSlug>` chỉ chạy:

```tsx
useEffect(() => {
  router.replace(groupMethodPath);
}, [groupMethodPath, router]);
```

và hiển thị spinner theo theme trong lúc chuyển hướng. Không reset persona tại
đây vì URL này có thể được dùng khi quay về trang khu di tích trong cùng lượt.

- [ ] **Step 5: Thêm các bộ chọn vào trang phương thức**

Trong header trang phương thức, giữ nút Home/Back bên trái và thêm bên phải:

```tsx
<div className="flex items-center gap-2">
  <LanguageSelector compact />
  <PersonaSelector />
</div>
```

Không thay đổi thẻ phương thức hoặc style chính của trang.

- [ ] **Step 6: Dùng context persona ở trang hiện vật**

Thay state và effect đọc `localStorage` bằng:

```ts
const { persona, ready: personaReady } = useVisitorPersona();
```

Chỉ tải nội dung khi cả `localeReady` và `personaReady`; giữ persona trong
dependency để tải lại nội dung khi lựa chọn thay đổi.

- [ ] **Step 7: Chạy kiểm thử luồng**

Run: `node frontend/tests/visitor-persona-flow.test.cjs`

Expected: PASS.

- [ ] **Step 8: Chạy toàn bộ kiểm thử frontend dạng script**

Run: `Get-ChildItem frontend/tests/*.test.cjs | ForEach-Object { node $_.FullName }`

Expected: Mọi script thoát mã `0`.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/page.tsx frontend/app/[groupSlug]/page.tsx frontend/app/[groupSlug]/method/page.tsx frontend/app/[groupSlug]/item/[id]/page.tsx frontend/tests/visitor-persona-flow.test.cjs
git commit -m "feat: streamline visitor persona flow"
```

### Task 4: Xác minh sản phẩm

**Files:**
- Verify only; không thêm chức năng ngoài phạm vi.

- [ ] **Step 1: Chạy kiểm tra TypeScript và build**

Run: `npm run build`

Working directory: `frontend`

Expected: Next.js production build hoàn tất với exit code `0`.

- [ ] **Step 2: Chạy lại toàn bộ kiểm thử frontend**

Run: `Get-ChildItem tests/*.test.cjs | ForEach-Object { node $_.FullName }`

Working directory: `frontend`

Expected: Mọi script thoát mã `0`.

- [ ] **Step 3: Kiểm tra diff**

Run: `git diff --check`

Expected: Không có lỗi whitespace.

- [ ] **Step 4: Rà soát tiêu chí nghiệm thu**

Xác nhận trong diff:

- Không còn bước persona bắt buộc.
- Chọn khu di tích đi thẳng tới `/method`.
- Persona mặc định là `Mặc định`, hiển thị `Phổ thông`/`General`.
- Persona dùng `sessionStorage`, ngôn ngữ vẫn dùng `localStorage`.
- Bộ chọn persona nằm cạnh bộ chọn ngôn ngữ và dùng biến CSS theme hiện tại.
- Trang hiện vật và chat dùng persona trong phiên.
- Không tạo lịch sử khách lâu dài hoặc định danh mới.

- [ ] **Step 5: Commit phần điều chỉnh xác minh nếu có**

Nếu build hoặc kiểm thử yêu cầu chỉnh sửa, thực hiện lại chu kỳ RED-GREEN cho
lỗi đó, chỉ stage đúng những tệp đã sửa trong chu kỳ này, rồi commit:

```bash
git commit -m "fix: complete visitor persona integration"
```
