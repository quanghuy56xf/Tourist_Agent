# Minimap MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khôi phục Minimap visitor dùng bản đồ tĩnh, nhớ vị trí hiện vật gần nhất và hiển thị badge đỏ chưa xem sau khi khách mở một hiện vật.

**Architecture:** Toàn bộ cấu hình và trạng thái nằm ở frontend. `minimapConfig.ts` quản lý mapping và localStorage; `MinimapButton` quản lý badge/modal; `MinimapModal` chỉ hiển thị bản đồ và marker. Layout visitor gắn button một lần, còn trang item ghi nhận vị trí sau khi tải API thành công.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Node assertion tests.

---

## File structure

- Create `frontend/lib/minimapConfig.ts`: config zone, storage item gần nhất và trạng thái chưa xem.
- Create `frontend/components/visitor/MinimapButton.tsx`: floating button, badge đỏ và modal state.
- Create `frontend/components/visitor/MinimapModal.tsx`: dialog bản đồ và marker.
- Create `frontend/public/images/van-mieu-minimap.svg`: placeholder map.
- Create `frontend/tests/minimap.test.cjs`: regression checks cho toàn bộ MVP.
- Modify `frontend/app/[groupSlug]/layout.tsx`: mount button một lần.
- Modify `frontend/app/[groupSlug]/item/[id]/page.tsx`: nhớ item sau khi tải thành công.

### Task 1: Config, storage, and unread state

**Files:**
- Create: `frontend/tests/minimap.test.cjs`
- Create: `frontend/lib/minimapConfig.ts`

- [ ] **Step 1: Write the failing config/storage test**

Tạo test xác nhận module tồn tại và export:

```js
const { getMinimapConfig, findMinimapZone, minimapStorageKey,
  minimapUnreadStorageKey } = moduleRef.exports;

const config = getMinimapConfig("van-mieu-quoc-tu-giam");
assert.ok(config);
assert.equal(findMinimapZone(config, 9).zoneName, "Khuê Văn Các");
assert.equal(findMinimapZone(config, 9999), null);
assert.equal(minimapStorageKey("van-mieu-quoc-tu-giam"),
  "hera_last_item_van-mieu-quoc-tu-giam");
assert.equal(minimapUnreadStorageKey("van-mieu-quoc-tu-giam"),
  "hera_minimap_unread_van-mieu-quoc-tu-giam");
```

Test source cũng phải xác nhận `rememberMinimapItem()` vừa lưu item vừa đặt unread, và `markMinimapSeen()` xóa unread.

- [ ] **Step 2: Run test and verify RED**

Run:

```powershell
node frontend/tests/minimap.test.cjs
```

Expected: FAIL vì `frontend/lib/minimapConfig.ts` chưa tồn tại.

- [ ] **Step 3: Implement minimal config and storage helpers**

Tạo sáu zone Văn Miếu:

```ts
const MINIMAP_CONFIGS: Record<string, MinimapConfig> = {
  "van-mieu-quoc-tu-giam": {
    groupSlug: "van-mieu-quoc-tu-giam",
    title: "Bản đồ Văn Miếu - Quốc Tử Giám",
    imageSrc: "/images/van-mieu-minimap.svg",
    zones: [
      { zoneId: "cong-chinh", zoneName: "Cổng chính", x: 50, y: 88, itemIds: [7] },
      { zoneId: "dai-trung-mon", zoneName: "Đại Trung Môn", x: 50, y: 73, itemIds: [12] },
      { zoneId: "khue-van-cac", zoneName: "Khuê Văn Các", x: 50, y: 57, itemIds: [9] },
      { zoneId: "vuon-bia", zoneName: "Vườn bia Tiến sĩ", x: 29, y: 43, itemIds: [11] },
      { zoneId: "khu-dai-thanh", zoneName: "Khu Đại Thành", x: 50, y: 28, itemIds: [6, 10, 13] },
      { zoneId: "den-khai-thanh", zoneName: "Đền Khải Thánh", x: 50, y: 11, itemIds: [8] },
    ],
  },
};
```

Storage helpers phải SSR-safe và bọc `try/catch`:

```ts
export function rememberMinimapItem(groupSlug: string, itemId: number): void {
  if (typeof window === "undefined" || !Number.isFinite(itemId)) return;
  try {
    window.localStorage.setItem(minimapStorageKey(groupSlug), String(itemId));
    window.localStorage.setItem(minimapUnreadStorageKey(groupSlug), "true");
    window.dispatchEvent(new CustomEvent("hera-minimap-updated", { detail: { groupSlug } }));
  } catch {}
}
```

Thêm `readRememberedMinimapItem`, `hasUnreadMinimap`, `markMinimapSeen`.

- [ ] **Step 4: Run config test**

Run `node frontend/tests/minimap.test.cjs`.

Expected: config/storage assertions pass; component assertions vẫn FAIL vì component chưa tồn tại.

### Task 2: Button, unread badge, and modal

**Files:**
- Modify: `frontend/tests/minimap.test.cjs`
- Create: `frontend/components/visitor/MinimapButton.tsx`
- Create: `frontend/components/visitor/MinimapModal.tsx`

- [ ] **Step 1: Add failing component assertions**

Test phải xác nhận:

```js
assert.match(buttonSource, /hasUnreadMinimap/);
assert.match(buttonSource, /hera-minimap-updated/);
assert.match(buttonSource, /markMinimapSeen\(groupSlug\)/);
assert.match(buttonSource, /aria-label="Có vị trí mới trên bản đồ"/);
assert.match(buttonSource, /<MinimapModal/);
assert.match(modalSource, /role="dialog"/);
assert.match(modalSource, /animate-ping/);
assert.match(modalSource, /Chưa xác định vị trí/);
```

- [ ] **Step 2: Run test and verify RED**

Run `node frontend/tests/minimap.test.cjs`.

Expected: FAIL vì button/modal chưa tồn tại.

- [ ] **Step 3: Implement `MinimapButton`**

Button:

- Dùng `useGroupSlug()`.
- Đọc unread lúc mount và khi nhận event `hera-minimap-updated` đúng group.
- Khi click: `markMinimapSeen(groupSlug)`, set badge false, mở modal.
- Badge là span đỏ tuyệt đối ở góc icon với `aria-label="Có vị trí mới trên bản đồ"`.
- Floating ở dưới trái, phía trên mobile nav.

- [ ] **Step 4: Implement `MinimapModal`**

Modal:

- Đọc item từ storage mỗi lần `open` chuyển true.
- Đóng bằng X, Escape và backdrop.
- Hiển thị ảnh config và marker đỏ `animate-ping` theo `x/y`.
- Fallback “Chưa xác định vị trí” và “Bản đồ chưa khả dụng cho khu tham quan này.”
- Có `role="dialog"`, `aria-modal="true"`.

- [ ] **Step 5: Run component test**

Run `node frontend/tests/minimap.test.cjs`.

Expected: component assertions pass; integration assertions vẫn FAIL.

### Task 3: Route integration and placeholder map

**Files:**
- Modify: `frontend/tests/minimap.test.cjs`
- Modify: `frontend/app/[groupSlug]/layout.tsx`
- Modify: `frontend/app/[groupSlug]/item/[id]/page.tsx`
- Create: `frontend/public/images/van-mieu-minimap.svg`

- [ ] **Step 1: Add failing integration assertions**

```js
assert.ok(exists("public/images/van-mieu-minimap.svg"));
assert.match(layoutSource, /<MinimapButton\s*\/>/);
assert.match(itemSource, /rememberMinimapItem\(groupSlug, itemId\)/);
```

- [ ] **Step 2: Run test and verify RED**

Run `node frontend/tests/minimap.test.cjs`.

Expected: FAIL vì layout, item page và SVG chưa tích hợp.

- [ ] **Step 3: Mount button in visitor layout**

```tsx
import MinimapButton from "@/components/visitor/MinimapButton";

<GroupRouteGuard>
  {children}
  <MinimapButton />
</GroupRouteGuard>
```

- [ ] **Step 4: Remember item only after successful API load**

Import helper và thêm ngay sau guard `cancelled`:

```ts
const data = await getItem(itemId);
if (cancelled) return;
rememberMinimapItem(groupSlug, itemId);
setItem(data);
```

Thêm `groupSlug` vào dependency array của effect.

- [ ] **Step 5: Create lightweight SVG placeholder**

SVG phải có tỷ lệ dọc, nền màu giấy, trục tham quan và nhãn sáu khu vực. Không dùng external resource.

- [ ] **Step 6: Run Minimap regression test**

Run:

```powershell
node frontend/tests/minimap.test.cjs
```

Expected: `Minimap module checks passed.`

### Task 4: Verification and project handoff

**Files:**
- Modify if needed: `PROJECT_STATUS.md` or `project_status.md`

- [ ] **Step 1: Run TypeScript check**

```powershell
cd frontend
& '.\node_modules\.bin\tsc.cmd' --noEmit
```

Expected: exit code 0.

- [ ] **Step 2: Run focused tests again**

```powershell
node frontend/tests/minimap.test.cjs
```

Expected: pass.

- [ ] **Step 3: Check diff scope**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only Minimap files, approved spec/plan, and required integration files changed.

- [ ] **Step 4: Update project status**

Ghi rõ Minimap MVP, unread badge behavior, file config, placeholder limitation và phần chưa làm: zoom/pan, Admin config, backend storage.

- [ ] **Step 5: Commit implementation if Git metadata is writable**

```powershell
git add frontend/lib/minimapConfig.ts frontend/components/visitor/MinimapButton.tsx frontend/components/visitor/MinimapModal.tsx frontend/public/images/van-mieu-minimap.svg frontend/tests/minimap.test.cjs frontend/app/[groupSlug]/layout.tsx frontend/app/[groupSlug]/item/[id]/page.tsx PROJECT_STATUS.md docs/superpowers/specs/2026-06-20-minimap-mvp-design.md docs/superpowers/plans/2026-06-20-minimap-mvp.md
git commit -m "feat: restore visitor minimap"
```

Nếu `.git/index.lock` tiếp tục bị từ chối, không thay đổi quyền hoặc dùng lệnh phá khóa; báo lại để người dùng commit ngoài sandbox.