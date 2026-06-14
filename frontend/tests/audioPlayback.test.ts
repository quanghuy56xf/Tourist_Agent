import assert from "node:assert/strict";
import test from "node:test";

import {
  getAudioControlState,
  shouldRetryAudioPlay,
  shouldRestartAudio,
  syncAudioSource,
} from "../lib/audioPlayback";

test("khóa nút nghe trong lúc audio đang được chuẩn bị", () => {
  assert.deepEqual(getAudioControlState("loading", "running"), {
    disabled: true,
    action: "wait",
    label: "preparing",
  });
});

test("cho phép dừng khi audio đã sẵn sàng và đang phát", () => {
  assert.deepEqual(getAudioControlState("ready", "running", true), {
    disabled: false,
    action: "stop",
    label: "stop",
  });
});

test("cho phép người dùng bật audio nếu trình duyệt chặn tự phát", () => {
  assert.deepEqual(getAudioControlState("ready", "running", false), {
    disabled: false,
    action: "play",
    label: "resume",
  });
});

test("cho phép tiếp tục khi audio đang tạm dừng", () => {
  assert.deepEqual(getAudioControlState("ready", "paused"), {
    disabled: false,
    action: "play",
    label: "resume",
  });
});

test("cho phép nghe lại khi phiên đã kết thúc", () => {
  assert.deepEqual(getAudioControlState("ready", "finished"), {
    disabled: false,
    action: "play",
    label: "replay",
  });
});

test("không khóa phần chữ khi audio bị lỗi", () => {
  assert.deepEqual(getAudioControlState("error", "running"), {
    disabled: true,
    action: "unavailable",
    label: "error",
  });
});

test("tiếp tục nghe giữ nguyên vị trí audio hiện tại", () => {
  assert.equal(shouldRestartAudio("resume"), false);
});

test("tự phát lần đầu và nghe lại bắt đầu từ đầu", () => {
  assert.equal(shouldRestartAudio("autoplay"), true);
  assert.equal(shouldRestartAudio("replay"), true);
});

test("tiếp tục nghe không reload khi src tương đối vẫn là cùng nguồn", () => {
  let pauseCalls = 0;
  let loadCalls = 0;
  const audio = {
    src: "http://localhost:3000/api/audio",
    getAttribute: (name: string) => (name === "src" ? "/api/audio" : null),
    pause: () => {
      pauseCalls += 1;
    },
    load: () => {
      loadCalls += 1;
    },
  };

  assert.equal(syncAudioSource(audio, "/api/audio"), false);
  assert.equal(pauseCalls, 0);
  assert.equal(loadCalls, 0);
});

test("retry autoplay khi audio chưa tải đủ dữ liệu", () => {
  assert.equal(shouldRetryAudioPlay(0, false), true);
  assert.equal(shouldRetryAudioPlay(2, false), true);
  assert.equal(shouldRetryAudioPlay(3, false), false);
  assert.equal(shouldRetryAudioPlay(0, true), false);
});
