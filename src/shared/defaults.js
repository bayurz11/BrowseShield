export const DEFAULT_SETTINGS = {
  protectionEnabled: true,
  overlayDiagnosisEnabled: true,
  networkBlockingEnabled: false,
  filterListEnabled: false,
  protectAllSites: false,
  blockedDomains: [],
  navigationProtectedSites: [],
  whitelist: []
};

export async function getSettings({ includeEasyListRules = false } = {}) {
  const [stored, metadata] = await Promise.all([
    chrome.storage.local.get(DEFAULT_SETTINGS),
    chrome.storage.local.get({ easyListUpdatedAt: 0, easyListRuleCount: 0, easyListUpdateError: "" })
  ]);
  const settings = { ...DEFAULT_SETTINGS, ...stored, ...metadata };
  if (includeEasyListRules) {
    const { easyListRules = [] } = await chrome.storage.local.get({ easyListRules: [] });
    settings.easyListRules = easyListRules;
  }
  return settings;
}

export function getSiteKey(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.hostname : null;
  } catch {
    return null;
  }
}

export function normalizeSiteHost(hostname) {
  return typeof hostname === "string" ? hostname.toLowerCase().replace(/^www\./, "") : "";
}
