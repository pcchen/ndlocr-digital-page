const test = require("node:test");
const assert = require("node:assert/strict");
const compare = require("../viewer/compare.js");

test("normalization preserves characters while ignoring whitespace", () => {
  assert.equal(compare.normalizeText(" 國 語\n"), "國語");
  assert.notEqual(compare.normalizeText("國"), compare.normalizeText("囯"));
});

test("similarity reports exact and differing text", () => {
  assert.equal(compare.similarity("臺灣", "臺灣"), 1);
  assert.equal(compare.similarity("臺灣", "台灣"), 0.5);
});

test("line alignment supports a line split in one OCR result", () => {
  const rows = compare.alignLines(["國語の對譯を施せるものなり。"], ["國語の對譯を", "施せるものなり。"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "exact");
  assert.deepEqual(rows[0].right, ["國語の對譯を", "施せるものなり。"]);
});

test("line alignment leaves unrelated inserted text unmatched", () => {
  const rows = compare.alignLines(["甲乙", "丙丁"], ["甲乙", "追加文字", "丙丁"]);
  assert.deepEqual(rows.map(row => row.status), ["exact", "missing", "exact"]);
});

test("line alignment recovers when reading order differs", () => {
  const left = ["一番目の長い行", "二番目の長い行", "三番目の長い行", "四番目の長い行", "五番目の長い行", "六番目の長い行"];
  const right = ["一番目の長い行", "五番目の長い行", "六番目の長い行", "二番目の長い行", "三番目の長い行", "四番目の長い行", "追加された行"];
  const rows = compare.alignLines(left, right);
  assert.equal(rows.filter(row => row.status === "exact").length, 6);
  assert.equal(rows.filter(row => row.status === "missing").length, 1);
});

test("character diff reconstructs both inputs", () => {
  const operations = compare.diffChars("厦門", "夏門");
  assert.equal(operations.filter(op => op.type !== "insert").map(op => op.value).join(""), "厦門");
  assert.equal(operations.filter(op => op.type !== "delete").map(op => op.value).join(""), "夏門");
});
