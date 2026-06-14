import assert from "node:assert/strict";
import test from "node:test";

import { formatSimilarityPercent, parseSimilarity } from "../lib/similarity";

test("parseSimilarity chỉ nhận số trong khoảng 0 đến 1", () => {
  assert.equal(parseSimilarity("0"), 0);
  assert.equal(parseSimilarity("0.9634"), 0.9634);
  assert.equal(parseSimilarity("1"), 1);
  assert.equal(parseSimilarity(null), null);
  assert.equal(parseSimilarity(""), null);
  assert.equal(parseSimilarity("abc"), null);
  assert.equal(parseSimilarity("-0.1"), null);
  assert.equal(parseSimilarity("1.1"), null);
});

test("formatSimilarityPercent hiển thị một chữ số thập phân", () => {
  assert.equal(formatSimilarityPercent(0.9634), "96.3%");
  assert.equal(formatSimilarityPercent(null), null);
});
