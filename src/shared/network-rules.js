import { normalizeSiteHost } from "./defaults.js";

export const SITE_ALLOW_RULE_ID_START = 40_000;
export const SITE_ALLOW_RULE_ID_END = 49_999;
export const EXTERNAL_NAVIGATION_RULE_ID = 50_000;

export function isSiteAllowRuleId(ruleId) {
  return Number.isInteger(ruleId) && ruleId >= SITE_ALLOW_RULE_ID_START && ruleId <= SITE_ALLOW_RULE_ID_END;
}

export function buildExternalNavigationRule(settings, { globalAccess = false, authorizedSites = [] } = {}) {
  if (!settings.protectionEnabled) return null;
  const excludedInitiatorDomains = [...new Set((settings.whitelist ?? []).map(normalizeSiteHost).filter(Boolean))];
  const condition = { domainType: "thirdParty", resourceTypes: ["main_frame"] };
  if (globalAccess) {
    if (excludedInitiatorDomains.length) condition.excludedInitiatorDomains = excludedInitiatorDomains;
  } else {
    const initiatorDomains = [...new Set(authorizedSites.map(normalizeSiteHost).filter(Boolean))]
      .filter((host) => !excludedInitiatorDomains.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)));
    if (!initiatorDomains.length) return null;
    condition.initiatorDomains = initiatorDomains;
    if (excludedInitiatorDomains.length) condition.excludedInitiatorDomains = excludedInitiatorDomains;
  }
  return {
    id: EXTERNAL_NAVIGATION_RULE_ID,
    priority: 50,
    action: { type: "block" },
    condition
  };
}

export function buildNetworkRuleConfiguration(settings) {
  const enabled = Boolean(settings.protectionEnabled && settings.networkBlockingEnabled);
  const filterListEnabled = Boolean(enabled && settings.filterListEnabled);
  const excludedInitiatorDomains = [...new Set((settings.whitelist ?? []).map(normalizeSiteHost).filter(Boolean))];
  const dynamicRules = [];

  if (enabled) {
    for (const [index, hostname] of excludedInitiatorDomains.entries()) {
      dynamicRules.push({
        id: SITE_ALLOW_RULE_ID_START + index,
        priority: 100,
        action: { type: "allow" },
        condition: { urlFilter: "|http", initiatorDomains: [hostname] }
      });
    }

    for (const [index, domain] of (settings.blockedDomains ?? []).entries()) {
      dynamicRules.push({
        id: 1000 + index,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: `||${domain}^`,
          resourceTypes: ["script", "image", "xmlhttprequest", "sub_frame", "stylesheet", "media", "font"],
          ...(excludedInitiatorDomains.length ? { excludedInitiatorDomains } : {})
        }
      });
    }
  }

  return {
    enableRulesetIds: filterListEnabled ? ["easylist"] : [],
    disableRulesetIds: filterListEnabled ? [] : ["easylist"],
    dynamicRules
  };
}
