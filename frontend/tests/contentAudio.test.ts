import assert from "node:assert/strict";
import test from "node:test";

import { buildItemAudioPath } from "../lib/contentAudio";

test("buildItemAudioPath tạo endpoint audio độc lập với response nội dung", () => {
  assert.equal(
    buildItemAudioPath(10, "Mặc định", "Tiếng Việt"),
    "/api/objects/10/content/audio?persona=M%E1%BA%B7c+%C4%91%E1%BB%8Bnh&language=Ti%E1%BA%BFng+Vi%E1%BB%87t"
  );
});
