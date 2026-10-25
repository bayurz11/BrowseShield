import test from "node:test";
import assert from "node:assert/strict";
import { historyKindForRule, sanitizeHistoryDestination } from "../src/shared/history-utils.js";

test("history destination omits credentials, query parameters, and fragments", () => {
  assert.equal(
    sanitizeHistoryDestination("https://user:secret@redirect.example/path?token=private#player"),
    "https://redirect.example/path"
  );
});

test("history destination rejects non-web schemes and bounds long URLs", () => {
  assert.equal(sanitizeHistoryDestination("javascript:alert(1)"), "Tujuan tidak diketahui");
  assert.ok(sanitizeHistoryDestination(`https://example.com/${"x".repeat(2000)}`).length <= 1024);
});

test("network history labels navigation, EasyList, and other blocks by exact rule ranges", () => {
  assert.equal(historyKindForRule(50_000), "Navigasi lintas situs diblokir");
  assert.equal(historyKindForRule(100_000), "Iklan/pelacak diblokir");
  assert.equal(historyKindForRule(50_001), "Permintaan jaringan diblokir");
  assert.equal(historyKindForRule(2_000), "Permintaan jaringan diblokir");
});
