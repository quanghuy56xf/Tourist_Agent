# Companion Quest Phase 2 — Hybrid Guided Hidden Gems

## Current status

Phase 1 đã hoàn thành và validate pass:

- Quest MVP có onboarding, bait scan, 2 quest, guided stop-by-stop, câu đố và reward.
- Quest tracking UI đã được chuyển thành HUD compact dưới avatar.
- HUD có inline expandable detail và tự thu gọn sau 5 giây.
- Logic Phase 1 vẫn là guided hiện tại: khách cần scan đúng current stop để hiện câu đố và đi tiếp.
- `npm --prefix frontend run lint` pass, chỉ còn warning cũ về `<img>` / `next/image`.
- `npm --prefix frontend run build` pass, chỉ còn warning cũ về `<img>` / `next/image`.

## Important decisions

- Phase 2 sẽ triển khai theo hướng **Hybrid Guided Hidden Gems**.
- Đôn vẫn gợi ý điểm tiếp theo, nhưng khách có thể tham quan tự nhiên.
- Nếu khách scan trúng bất kỳ điểm chưa hoàn thành nào trong quest đã chọn, hệ thống vẫn ghi nhận và mở câu đố cho điểm đó.
- Quest progress không nên phụ thuộc hoàn toàn vào `currentStopIndex`; cần dựa trên `completedStopIds`.
- Không cần backend changes cho Phase 2.
- Quest matching tiếp tục dùng `bestMatch.name` và keyword trong `companionQuests.ts`, không phụ thuộc `item_id` vì ID hiện vật có thể thay đổi khi re-upload data.

## Target behavior

Sau khi chọn quest:

> Đôn sẽ gợi ý từng manh mối, nhưng bạn cứ tham quan tự nhiên. Nếu tìm thấy manh mối khác trước, Đôn vẫn ghi nhận.

Trong quest mode:

1. Nếu scan đúng recommended/current stop:
   - Giữ behavior hiện tại.
   - Đóng camera.
   - Hiện thông báo tìm đúng target.
   - Hiện riddle/câu đố cho stop đó.

2. Nếu scan trúng một stop khác trong cùng quest và stop đó chưa completed:
   - Đóng camera.
   - Hiện assistant message kiểu:
     > Ồ! Bạn đã tìm thấy một manh mối khác của quest: {stop.title}. Ta ghi nhận luôn nhé.
   - Hiện riddle/câu đố cho matched stop đó.
   - Sau khi trả lời, ghi nhận stop này vào progress.

3. Nếu scan trúng stop đã completed:
   - Không duplicate progress.
   - Hiện message nhẹ:
     > Manh mối này bạn đã mở khóa rồi. Gợi ý tiếp theo của ta là {recommendedStop.title}.
   - Cho phép tiếp tục scan quest hoặc nghe kể nhanh nếu cần.

4. Nếu scan một hiện vật không thuộc quest:
   - Giữ rescue behavior hiện tại.
   - Đôn công nhận người dùng vừa tìm thấy hiện vật đó.
   - Cho tùy chọn nghe kể nhanh hoặc tiếp tục tìm điểm quest.

## Main files

- `frontend/lib/companionQuests.ts`
- `frontend/lib/companionState.ts`
- `frontend/components/visitor/CompanionChat.tsx`
- `frontend/components/visitor/CompanionQuestProgress.tsx`
- `frontend/lib/i18n/vi.ts`
- Mirror locale files if new keys are required:
  - `frontend/lib/i18n/en.ts`
  - `frontend/lib/i18n/fr.ts`
  - `frontend/lib/i18n/ja.ts`
  - `frontend/lib/i18n/ko.ts`
  - `frontend/lib/i18n/zh.ts`

## Implementation plan

### 1. Add hidden-gem quest matching helper

In `frontend/lib/companionQuests.ts`, add a helper like:

```ts
export function findMatchingQuestStop(
  itemName: string,
  quest: CompanionQuest,
  excludedStopIds: string[] = []
): CompanionQuestStop | undefined {
  const excluded = new Set(excludedStopIds);

  return quest.stops.find((stop) => {
    if (excluded.has(stop.id)) return false;
    return matchQuestStopTarget(itemName, stop);
  });
}
```

Keep existing helpers:

- `normalizeQuestText`
- `isQuestBaitTarget`
- `matchQuestStopTarget`
- `getQuestById`

### 2. Make quest state progress completed-stop based

`frontend/lib/companionState.ts` already has:

```ts
completedStopIds?: string[];
answeredStopIds?: string[];
currentStopIndex?: number;
```

Add or adjust helper behavior so Phase 2 can:

- Complete an arbitrary stop by `stopId`.
- Preserve completed stop IDs without duplicates.
- Compute whether quest is completed based on `completedStopIds.length >= quest.stops.length`.
- Update `currentStopIndex` to the first uncompleted stop in quest order.

Suggested helper shape:

```ts
export function completeCompanionQuestStop(
  storage: Storage,
  quest: CompanionQuest,
  stopId: string
): CompanionQuestState {
  const current = getCompanionQuestState(storage);
  const completed = new Set(current.completedStopIds ?? []);
  completed.add(stopId);

  const completedStopIds = Array.from(completed);
  const nextIndex = quest.stops.findIndex((stop) => !completed.has(stop.id));
  const isCompleted = completedStopIds.length >= quest.stops.length || nextIndex === -1;

  const nextState: CompanionQuestState = {
    ...current,
    status: isCompleted ? "quest_completed" : "quest_active",
    selectedQuestId: quest.id,
    completedStopIds,
    answeredStopIds: completedStopIds,
    currentStopIndex: isCompleted ? quest.stops.length : nextIndex,
    rewardClaimed: isCompleted ? true : current.rewardClaimed,
  };

  setCompanionQuestState(storage, nextState);
  return nextState;
}
```

If importing `CompanionQuest` into `companionState.ts` creates an undesirable coupling, keep the helper UI-side in `CompanionChat.tsx` or pass only `questId`, `stopIds`, and `stopId`.

### 3. Track pending riddle stop by stop ID

Current Phase 1 answer flow likely assumes the current stop is the active riddle stop.

Phase 2 needs to support out-of-order scan, so add state in `CompanionChat.tsx`:

```ts
const [pendingQuestStopId, setPendingQuestStopId] = useState<string | null>(null);
```

When showing a riddle for any quest stop:

- Set `pendingQuestStopId` to that stop ID.
- Render answer buttons as now.

When handling `quest_answer`:

- Resolve stop from `pendingQuestStopId` first.
- Fallback to current recommended stop for compatibility.
- Complete that specific stop after answer.
- Clear `pendingQuestStopId`.

### 4. Refactor quest scan handling in `CompanionChat.tsx`

Inside `handleCapture`, in the `cameraMode === "quest"` branch:

1. Resolve:
   - `activeQuest`
   - `activeQuestStop`
   - current persisted quest state
   - `completedStopIds`
   - recognized `itemName` from `bestMatch.name`

2. Matching priority:

```ts
const completedStopIds = questState.completedStopIds ?? [];
const currentStopMatched = activeQuestStop
  ? matchQuestStopTarget(itemName, activeQuestStop)
  : false;

const matchedStop = currentStopMatched
  ? activeQuestStop
  : findMatchingQuestStop(itemName, activeQuest, completedStopIds);

const alreadyCompletedStop = findMatchingQuestStop(itemName, activeQuest, []);
const isAlreadyCompleted = alreadyCompletedStop
  ? completedStopIds.includes(alreadyCompletedStop.id)
  : false;
```

3. Cases:

- `matchedStop` exists:
  - Close camera.
  - Store pending stop.
  - Show riddle for `matchedStop`.

- `isAlreadyCompleted`:
  - Close camera.
  - Message that this clue is already unlocked.
  - Suggest current recommended stop.

- Otherwise:
  - Use existing wrong-target rescue flow.

Important: if the recognized item matches current stop but current stop is already completed due to out-of-order state, treat as already completed, not as new progress.

### 5. Update answer advancement to complete arbitrary stop

Refactor `advanceQuestAfterAnswer` so it accepts or resolves a stop ID:

```ts
const advanceQuestAfterAnswer = (
  answerId: CompanionQuestChoice["id"],
  stopIdOverride?: string
) => {
  const quest = activeQuest;
  if (!quest) return;

  const stop = quest.stops.find((item) => item.id === stopIdOverride)
    ?? activeQuestStop;
  if (!stop) return;

  // answer correctness/explanation as now
  // complete this stop, not necessarily current stop
  // choose next recommended stop from first uncompleted
};
```

After answer:

- Add stop to `completedStopIds`.
- If all completed:
  - status `quest_completed`
  - set `completedQuestId`
  - hide active quest HUD if current behavior does that
  - show reward card
- Else:
  - set `activeQuestStopIndex` to first uncompleted stop index.
  - open HUD detail.
  - assistant message should say progress and next recommendation.

Suggested copy:

```text
Bạn đã mở khóa {completed}/{total} manh mối. Gợi ý tiếp theo: {nextStop.title}. {nextStop.hint}
```

### 6. Update HUD progress display

In `CompanionQuestProgress.tsx`, support completed-stop progress.

Possible props:

```ts
completedStopIds?: string[];
recommendedLabel?: string;
```

Display:

- Phase 1-compatible fallback: `Điểm X/3`.
- Phase 2: `Đã tìm X/3`.
- Stop line: `Gợi ý: {recommendedStop.title}`.
- Dots:
  - completed stop IDs → emerald.
  - recommended stop → amber.
  - remaining → white/15.

Implementation should remain backward compatible with Phase 1 until all call sites are updated.

### 7. Add or update i18n keys

Recommended new keys under `companion`:

```ts
questHybridIntro: "Ta sẽ gợi ý từng manh mối, nhưng bạn cứ tham quan tự nhiên. Nếu tìm thấy manh mối khác trước, Đôn vẫn ghi nhận.",
questHiddenGemFound: "Ồ! Bạn đã tìm thấy một manh mối khác của quest: {name}. Ta ghi nhận luôn nhé.",
questAlreadyFound: "Manh mối này bạn đã mở khóa rồi. Gợi ý tiếp theo của ta là {target}.",
questRecommendedNext: "Gợi ý tiếp theo",
questProgressFound: "Đã tìm {current}/{total}",
```

Add to all locale files or ensure the i18n type/default mechanism allows missing mirrored translations. Existing locale files appear to require full key coverage through `VisitorTranslations`, so mirror keys in all locale files if TypeScript requires it.

### 8. Keep normal discovery behavior intact

Do not break:

- normal scanner mode
- bait scanner mode
- uncertain two-choice match behavior
- `CompanionDiscoveryCard`
- `tell_story`
- `ask_more`
- quest reward card
- local storage keys:
  - `hera_companion_quest_state`
  - `hera_companion_visited_items`

## Manual test cases

### Case 1 — Guided current stop still works

1. Choose `Đi tìm Bí mật Khoa Cử`.
2. Recommended stop is `Trống`.
3. Scan `Trống`.
4. Riddle appears.
5. Answer.
6. Progress becomes 1/3.
7. Recommended stop becomes next uncompleted stop.

### Case 2 — Hidden gem out of order works

1. Choose `Đi tìm Bí mật Khoa Cử`.
2. Recommended stop is `Trống`.
3. Scan `Bia Tiến sĩ` first.
4. App accepts it as hidden gem.
5. Riddle for `Bia Tiến sĩ` appears.
6. Answer.
7. Progress becomes 1/3.
8. Recommended stop remains first uncompleted stop, likely `Trống`.

### Case 3 — Already completed stop does not duplicate

1. Complete `Bia Tiến sĩ`.
2. Scan `Bia Tiến sĩ` again.
3. App says clue already unlocked.
4. Progress remains unchanged.
5. Recommended stop is still the first uncompleted stop.

### Case 4 — Scan outside quest still has rescue

1. Active quest is `Đi tìm Bí mật Khoa Cử`.
2. Scan `Đại Thành Điện`.
3. App should not complete quest progress.
4. App should let user hear story or continue quest.

### Case 5 — Complete quest out of order

1. Complete all 3 quest stops in any order.
2. Reward card appears once.
3. Quest status becomes `quest_completed`.
4. HUD no longer shows active quest or shows completed state according to current UX decision.

## Validation commands

Run from repo root:

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
```

Expected:

- Both commands pass.
- Existing `<img>` / `next/image` warnings may remain and are not blockers.

## Deferred / not in Phase 2

- Backend changes.
- Stable backend quest keys.
- Map-based route navigation.
- GPS/indoor positioning.
- Multi-quest simultaneous progress.
- Admin UI for quest authoring.
