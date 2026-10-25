import test from "node:test";
import assert from "node:assert/strict";
import { parseEasyListText, sampleEasyListRules } from "../src/shared/easylist.js";

test("EasyList conversion keeps supported filters, deduplicates, and reserves exceptions", () => {
  const lines = [
    "[Adblock Plus 2.0]",
    ...Array.from({ length: 10 }, (_, index) => `||tracker${index}.example^`),
    "||tracker0.example^",
    "@@||allowed.example^",
    "@@||another-allowed.example^",
    "||path.example/banner.js",
    "||modifier.example^$script",
    "##.cosmetic-ad"
  ];
  const rules = parseEasyListText(`${lines.join("\n")}\n${"#".repeat(100_000)}`, 4);
  assert.equal(rules.length, 4);
  assert.equal(rules.filter((rule) => rule.action.type === "allow").length, 1);
  assert.equal(rules.filter((rule) => rule.action.type === "block").length, 3);
  const pathRuleSource = `[Adblock Plus 2.0]\n||path.example/banner.js`.padEnd(100_000, " ");
  assert.equal(parseEasyListText(pathRuleSource, 10)[0].condition.urlFilter, "||path.example/banner.js");
});

test("EasyList conversion handles domain, type, third-party, and badfilter options", () => {
  const source = [
    "[Adblock Plus 2.0]",
    "||cdn.example/ad.js$script,third-party,domain=site.example|~trusted.site.example",
    "||removed.example^$image",
    "||removed.example^$image,badfilter"
  ].join("\n").padEnd(100_000, " ");
  const rules = parseEasyListText(source, 20);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].condition.domainType, "thirdParty");
  assert.deepEqual(rules[0].condition.resourceTypes, ["script"]);
  assert.deepEqual(rules[0].condition.initiatorDomains, ["site.example"]);
  assert.deepEqual(rules[0].condition.excludedInitiatorDomains, ["trusted.site.example"]);
});

test("EasyList conversion rejects a response that does not resemble a filter list", () => {
  assert.throws(() => parseEasyListText("not a valid list"), /basic validation/);
});

test("dynamic EasyList sampling stays within its rule budget", () => {
  const source = Array.from({ length: 20 }, (_, index) => ({
    priority: 1,
    action: { type: index < 4 ? "allow" : "block" },
    condition: { urlFilter: `||host${index}.example^` }
  }));
  const sample = sampleEasyListRules(source, 8);
  assert.equal(sample.length, 8);
  assert.equal(sample.filter((rule) => rule.action.type === "allow").length, 2);
});
