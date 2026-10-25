import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(await readFile(resolve(projectRoot, "manifest.json"), "utf8"));

test("manifest references existing extension and toolbar icons", async () => {
  const references = [...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
  assert.ok(references.length >= 6);
  for (const file of references) {
    const png = await readFile(resolve(projectRoot, file));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file} must be a PNG`);
    assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0, `${file} must have a valid size`);
  }
});

test("manifest declares the alarms permission required for scheduled filter refresh", () => {
  assert.ok(manifest.permissions.includes("alarms"));
  assert.ok(manifest.optional_host_permissions.includes("https://*/*"));
});
