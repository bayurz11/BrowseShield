import test from "node:test";
import assert from "node:assert/strict";
import { buildExternalNavigationRule, buildNetworkRuleConfiguration, isSiteAllowRuleId } from "../src/shared/network-rules.js";

const baseSettings = {
  protectionEnabled: true,
  networkBlockingEnabled: true,
  filterListEnabled: false,
  blockedDomains: [],
  whitelist: []
};

test("network protections stay off when the main protection switch is off", () => {
  const config = buildNetworkRuleConfiguration({ ...baseSettings, protectionEnabled: false, filterListEnabled: true });
  assert.deepEqual(config.enableRulesetIds, []);
  assert.deepEqual(config.disableRulesetIds, ["easylist"]);
  assert.deepEqual(config.dynamicRules, []);
});

test("EasyList requires both the network master switch and its own switch", () => {
  const off = buildNetworkRuleConfiguration({ ...baseSettings, networkBlockingEnabled: false, filterListEnabled: true });
  assert.deepEqual(off.enableRulesetIds, []);

  const on = buildNetworkRuleConfiguration({ ...baseSettings, filterListEnabled: true });
  assert.deepEqual(on.enableRulesetIds, ["easylist"]);
  assert.deepEqual(on.disableRulesetIds, []);
});

test("custom domain rules carry site exceptions and do not match top-level navigation", () => {
  const config = buildNetworkRuleConfiguration({
    ...baseSettings,
    blockedDomains: ["tracker.example"],
    whitelist: ["www.samehadaku.li"]
  });
  const blockRule = config.dynamicRules.find((rule) => rule.action.type === "block");
  assert.equal(blockRule.condition.urlFilter, "||tracker.example^");
  assert.deepEqual(blockRule.condition.excludedInitiatorDomains, ["samehadaku.li"]);
  assert.ok(!blockRule.condition.resourceTypes.includes("main_frame"));
});

test("a whitelisted site gets a higher-priority allow rule for filter-list requests", () => {
  const config = buildNetworkRuleConfiguration({
    ...baseSettings,
    filterListEnabled: true,
    whitelist: ["samehadaku.li", "www.samehadaku.li"]
  });
  const allows = config.dynamicRules.filter((rule) => rule.action.type === "allow");
  assert.equal(allows.length, 1);
  assert.equal(allows[0].priority, 100);
  assert.deepEqual(allows[0].condition.initiatorDomains, ["samehadaku.li"]);
  assert.equal(allows[0].condition.urlFilter, "|http");
});

test("dynamic rule IDs remain unique between allow and custom block rules", () => {
  const config = buildNetworkRuleConfiguration({
    ...baseSettings,
    whitelist: ["example.org"],
    blockedDomains: ["tracker-a.example", "tracker-b.example"]
  });
  const ids = config.dynamicRules.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
});

test("allow rules use a dedicated ID range and are identifiable for history filtering", () => {
  const config = buildNetworkRuleConfiguration({ ...baseSettings, whitelist: ["example.org"] });
  const allowRule = config.dynamicRules.find((rule) => rule.action.type === "allow");
  assert.equal(isSiteAllowRuleId(allowRule.id), true);
  assert.equal(isSiteAllowRuleId(1000), false);
  assert.equal(isSiteAllowRuleId(50000), false);
  assert.equal(isSiteAllowRuleId(Number.NaN), false);
});

test("protected sites get a fallback rule for cross-site top-level navigation", () => {
  const rule = buildExternalNavigationRule({
    protectionEnabled: true,
    whitelist: ["trusted.example"]
  }, { authorizedSites: ["samehadaku.li"] });
  assert.deepEqual(rule, {
    id: 50000,
    priority: 50,
    action: { type: "block" },
    condition: {
      domainType: "thirdParty",
      resourceTypes: ["main_frame"],
      initiatorDomains: ["samehadaku.li"],
      excludedInitiatorDomains: ["trusted.example"]
    }
  });
});

test("global navigation protection excludes allowlisted sites", () => {
  const rule = buildExternalNavigationRule({ protectionEnabled: true, whitelist: ["trusted.example"] }, { globalAccess: true });
  assert.deepEqual(rule.condition, {
    domainType: "thirdParty",
    resourceTypes: ["main_frame"],
    excludedInitiatorDomains: ["trusted.example"]
  });
  assert.equal("initiatorDomains" in rule.condition, false);
});

test("navigation fallback is omitted when protection is off or there are no permitted sites", () => {
  assert.equal(buildExternalNavigationRule({ protectionEnabled: false }, { globalAccess: true }), null);
  assert.equal(buildExternalNavigationRule({ protectionEnabled: true }, { authorizedSites: [] }), null);
});
