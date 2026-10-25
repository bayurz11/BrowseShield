import { mkdir, writeFile } from "node:fs/promises";
import { EASYLIST_MAX_RULES, EASYLIST_SOURCE_URL, parseEasyListText } from "../src/shared/easylist.js";
const sourceUrl = EASYLIST_SOURCE_URL;
const response = await fetch(sourceUrl, { headers: { "user-agent": "BrowseShield filter-list builder" } });
if (!response.ok) throw new Error(`EasyList download failed: HTTP ${response.status}`);
const source = await response.text();
if (!source.startsWith("[Adblock") || source.length < 100_000) {
  throw new Error("Downloaded EasyList did not pass basic validation; existing generated rules were left untouched.");
}

const rules = parseEasyListText(source, EASYLIST_MAX_RULES).map((rule, index) => ({ id: index + 1, ...rule }));
if (!rules.length) throw new Error("EasyList conversion produced no usable rules.");

await mkdir("src/rules", { recursive: true });
await writeFile("src/rules/easylist.json", `${JSON.stringify(rules)}\n`, "utf8");
await writeFile("src/rules/EASYLIST-SOURCE.txt", [
  "Generated from EasyList community filter list.",
  `Source: ${sourceUrl}`,
  `Downloaded: ${new Date().toISOString()}`,
  `Generated DNR rules: ${rules.length}`,
  "Supported URL filters and DNR-compatible options are included. Cosmetic, scriptlet, and unsupported modifier rules are omitted.",
  "EasyList source licensing: GPL-3.0-or-later AND CC-BY-SA-3.0. See https://github.com/easylist/easylist/blob/master/package.json",
  "Regenerate with: npm run update:filters"
].join("\n") + "\n", "utf8");
console.log(`Generated ${rules.length} supported network filters from EasyList. Cosmetic, scriptlet, and unsupported modifier rules are skipped.`);
