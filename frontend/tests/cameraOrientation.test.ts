import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCameraConstraints,
  getPreviewRotationDeg,
} from "../lib/cameraOrientation";

test("xoay preview 90 độ khi màn hình dọc nhận video ngang", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { innerHeight: 900, innerWidth: 400 },
  });

  assert.equal(getPreviewRotationDeg(1920, 1080), 90);
  assert.equal(getPreviewRotationDeg(1080, 1920), 0);
});

test("không xoay preview khi màn hình ngang", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { innerHeight: 600, innerWidth: 1000 },
  });

  assert.equal(getPreviewRotationDeg(1920, 1080), 0);
});

test("cấu hình camera mobile ưu tiên camera sau và độ phân giải cao", () => {
  assert.deepEqual(buildCameraConstraints(true), {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920, min: 640 },
      height: { ideal: 1080, min: 480 },
      aspectRatio: undefined,
    },
  });
});
