import { DEFAULT_SETTINGS, getSettings, normalizeSiteHost } from "../shared/defaults.js";
import { buildExternalNavigationRule, buildNetworkRuleConfiguration, isSiteAllowRuleId } from "../shared/network-rules.js";
import { EASYLIST_MAX_RULES, EASYLIST_SOURCE_URL, parseEasyListText, sampleEasyListRules } from "../shared/easylist.js";
import { historyKindForRule, sanitizeHistoryDestination } from "../shared/history-utils.js";

const EASYLIST_ALARM = "browseshield-easylist-refresh";
const EASYLIST_REFRESH_DAYS = 7;
const EASYLIST_DYNAMIC_ID_START = 100_000;

let networkRulesUpdate = Promise.resolve();
let navigationScriptsUpdate = Promise.resolve();
let overlayScriptsUpdate = Promise.resolve();
let historyWrite = Promise.resolve();

function appendSessionHistory(entry) {
  if (!chrome.storage.session) return Promise.resolve();
  historyWrite = historyWrite.then(async () => {
    const { blockedHistory = [] } = await chrome.storage.session.get("blockedHistory");
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, time: Date.now(), ...entry };
    await chrome.storage.session.set({ blockedHistory: [item, ...blockedHistory].slice(0, 100) });
  }).catch((error) => console.error("BrowseShield could not save session history:", error));
  return historyWrite;
}

function getHost(value) {
  try { return new URL(value).hostname; } catch { return "Tidak diketahui"; }
}

function isHostAllowlisted(hostname, allowlist) {
  const host = normalizeSiteHost(hostname);
  return allowlist.some((entry) => {
    const allowedHost = normalizeSiteHost(entry);
    return allowedHost && (host === allowedHost || host.endsWith(`.${allowedHost}`));
  });
}

chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  const request = info.request ?? {};
  const ruleId = info.rule?.ruleId;
  if (!request.url || !Number.isInteger(ruleId) || isSiteAllowRuleId(ruleId)) return;
  void appendSessionHistory({
    kind: historyKindForRule(ruleId),
    source: getHost(request.initiator || request.documentUrl || ""),
    destination: sanitizeHistoryDestination(request.url),
    resourceType: request.type ?? "unknown",
    ruleId
  });
});

chrome.storage.session?.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => {});

function queueNetworkRulesUpdate() {
  networkRulesUpdate = networkRulesUpdate
    .catch(() => {})
    .then(() => refreshNetworkRules());
  return networkRulesUpdate;
}

function queueNavigationGuardUpdate() {
  navigationScriptsUpdate = navigationScriptsUpdate
    .catch(() => {})
    .then(() => refreshNavigationGuards());
  return navigationScriptsUpdate;
}

function queueOverlayScriptUpdate() {
  overlayScriptsUpdate = overlayScriptsUpdate
    .catch(() => {})
    .then(() => refreshOverlayScripts());
  return overlayScriptsUpdate;
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.set({ ...DEFAULT_SETTINGS, ...stored });
  chrome.alarms.create(EASYLIST_ALARM, { delayInMinutes: 1, periodInMinutes: EASYLIST_REFRESH_DAYS * 24 * 60 });
  await Promise.all([queueNetworkRulesUpdate(), queueNavigationGuardUpdate(), queueOverlayScriptUpdate()]);
  void updateEasyListIfDue();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(EASYLIST_ALARM, { delayInMinutes: 1, periodInMinutes: EASYLIST_REFRESH_DAYS * 24 * 60 });
  void Promise.all([queueNetworkRulesUpdate(), queueNavigationGuardUpdate(), queueOverlayScriptUpdate()])
    .catch((error) => console.error("BrowseShield could not restore site protections:", error));
  void updateEasyListIfDue();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === EASYLIST_ALARM) void updateEasyListIfDue();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (["protectionEnabled", "networkBlockingEnabled", "filterListEnabled", "blockedDomains", "whitelist", "navigationProtectedSites", "protectAllSites", "easyListRules"].some((key) => key in changes)) {
    void queueNetworkRulesUpdate().catch((error) => console.error("BrowseShield could not refresh network rules:", error));
  }
  if (changes.filterListEnabled?.newValue === true || changes.networkBlockingEnabled?.newValue === true) void updateEasyListIfDue();
  if (["protectionEnabled", "navigationProtectedSites", "protectAllSites", "whitelist"].some((key) => key in changes)) {
    void queueNavigationGuardUpdate().catch((error) => console.error("BrowseShield could not refresh navigation guards:", error));
  }
  if (["protectionEnabled", "whitelist"].some((key) => key in changes)) {
    void queueOverlayScriptUpdate().catch((error) => console.error("BrowseShield could not refresh site selectors:", error));
  }
});

chrome.permissions.onRemoved?.addListener(() => {
  void queueNavigationGuardUpdate().catch((error) => console.error("BrowseShield could not reconcile revoked site access:", error));
  void queueNetworkRulesUpdate().catch((error) => console.error("BrowseShield could not reconcile network access:", error));
  void queueOverlayScriptUpdate().catch((error) => console.error("BrowseShield could not reconcile overlay access:", error));
});

async function refreshNetworkRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const settings = await getSettings({ includeEasyListRules: true });
  const configuration = buildNetworkRuleConfiguration(settings);
  const globalAccess = settings.protectAllSites && await chrome.permissions.contains({ origins: ["http://*/*", "https://*/*"] });
  const authorizedSites = [];
  if (!globalAccess) {
    for (const hostname of new Set((settings.navigationProtectedSites ?? []).map(normalizeSiteHost).filter(Boolean))) {
      const origins = [`http://${hostname}/*`, `https://${hostname}/*`, `http://www.${hostname}/*`, `https://www.${hostname}/*`];
      let authorized = false;
      for (const origin of origins) {
        if (await chrome.permissions.contains({ origins: [origin] })) authorized = true;
      }
      if (authorized) authorizedSites.push(hostname);
    }
  }
  const externalNavigationRule = buildExternalNavigationRule(settings, { globalAccess, authorizedSites });
  const baseDynamicRules = [...configuration.dynamicRules];
  if (externalNavigationRule) baseDynamicRules.push(externalNavigationRule);
  const filterListActive = configuration.enableRulesetIds.includes("easylist");
  const cachedEasyList = Array.isArray(settings.easyListRules) ? settings.easyListRules : [];
  const dynamicLimit = chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_RULES ?? 5_000;
  const dynamicEasyListCapacity = filterListActive ? Math.max(0, Math.min(EASYLIST_MAX_RULES, dynamicLimit - baseDynamicRules.length)) : 0;
  const selectedEasyList = sampleEasyListRules(cachedEasyList, dynamicEasyListCapacity);
  const useDynamicEasyListOnly = selectedEasyList.length > 0 && selectedEasyList.length === cachedEasyList.length;
  configuration.dynamicRules = [
    ...baseDynamicRules,
    ...selectedEasyList.map((rule, index) => ({ id: EASYLIST_DYNAMIC_ID_START + index, ...rule }))
  ];
  if (filterListActive && useDynamicEasyListOnly) {
    configuration.enableRulesetIds = [];
    configuration.disableRulesetIds = ["easylist"];
  }
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: configuration.enableRulesetIds,
    disableRulesetIds: configuration.disableRulesetIds
  });
  const removeRuleIds = existing.map(({ id }) => id);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: configuration.dynamicRules });
}

async function refreshNavigationGuards() {
  const prefix = "browseshield-nav-";
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const oldIds = registered.filter(({ id }) => id.startsWith(prefix)).map(({ id }) => id);
  if (oldIds.length) await chrome.scripting.unregisterContentScripts({ ids: oldIds });

  const settings = await getSettings();
  if (!settings.protectionEnabled) {
    await syncOpenTabNavigationGuards(settings, false);
    return;
  }
  const allowlisted = new Set(settings.whitelist.map(normalizeSiteHost));
  const allOrigins = ["http://*/*", "https://*/*"];
  const scripts = [];
  const globalAccess = settings.protectAllSites && await chrome.permissions.contains({ origins: allOrigins });
  if (globalAccess) {
    const excludeMatches = [...allowlisted].flatMap((hostname) => [
      `http://${hostname}/*`, `https://${hostname}/*`,
      `http://*.${hostname}/*`, `https://*.${hostname}/*`
    ]);
    scripts.push(
      { id: `${prefix}main-all`, matches: allOrigins, excludeMatches, js: ["src/content/navigation-guard.js"], runAt: "document_start", world: "MAIN", allFrames: true, persistAcrossSessions: true },
      { id: `${prefix}isolated-all`, matches: allOrigins, excludeMatches, js: ["src/content/navigation-interceptor.js"], runAt: "document_start", world: "ISOLATED", allFrames: true, persistAcrossSessions: true }
    );
  }
  if (globalAccess) {
    if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
    await syncOpenTabNavigationGuards(settings, true);
    return;
  }
  const hosts = [...new Set((settings.navigationProtectedSites ?? []).map(normalizeSiteHost))]
    .filter((host) => host && !isHostAllowlisted(host, [...allowlisted]));
  for (const hostname of hosts) {
    const wwwHostname = `www.${hostname}`;
    const candidates = [`http://${hostname}/*`, `https://${hostname}/*`, `http://${wwwHostname}/*`, `https://${wwwHostname}/*`];
    const matches = [];
    for (const origin of candidates) {
      if (await chrome.permissions.contains({ origins: [origin] })) matches.push(origin);
    }
    if (!matches.length) continue;
    const id = hostname.replace(/[^a-z0-9_-]/gi, "-");
    scripts.push(
      { id: `${prefix}main-${id}`, matches, js: ["src/content/navigation-guard.js"], runAt: "document_start", world: "MAIN", allFrames: true, persistAcrossSessions: true },
      { id: `${prefix}isolated-${id}`, matches, js: ["src/content/navigation-interceptor.js"], runAt: "document_start", world: "ISOLATED", allFrames: true, persistAcrossSessions: true }
    );
  }
  if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
  await syncOpenTabNavigationGuards(settings, false);
}

async function syncOpenTabNavigationGuards(settings, globalAccess) {
  const tabs = await chrome.tabs.query({});
  const protectedSites = [...new Set((settings.navigationProtectedSites ?? []).map(normalizeSiteHost).filter(Boolean))];
  for (const tab of tabs) {
    if (!tab.id || typeof tab.url !== "string") continue;
    let hostname;
    try {
      const pageUrl = new URL(tab.url);
      if (!["http:", "https:"].includes(pageUrl.protocol)) continue;
      hostname = normalizeSiteHost(pageUrl.hostname);
    } catch { continue; }
    const allowlisted = isHostAllowlisted(hostname, settings.whitelist ?? []);
    const siteMatch = protectedSites.some((site) => hostname === site || hostname.endsWith(`.${site}`));
    const shouldProtect = settings.protectionEnabled && !allowlisted && (globalAccess || siteMatch);
    if (shouldProtect) {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", files: ["src/content/navigation-guard.js"] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "ISOLATED", files: ["src/content/navigation-interceptor.js"] });
      } catch { /* The page may not grant injection access or may have navigated. */ }
      continue;
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: () => {
          const key = "__browseShieldNavigationGuardV2";
          const state = window[key];
          const legacyGuardActive = window.__browseShieldNavigationGuard === true;
          if ((!state || typeof state !== "object") && !legacyGuardActive) return;
          const restoreOpen = state?.version === 2 ? window.open === state.wrappedOpen : legacyGuardActive;
          const restoreSubmit = state?.version === 2 ? HTMLFormElement.prototype.submit === state.wrappedSubmit : legacyGuardActive;
          const frame = document.createElement("iframe");
          frame.style.display = "none";
          document.documentElement.append(frame);
          const nativeWindow = frame.contentWindow;
          if (!nativeWindow) { frame.remove(); return; }
          if (restoreOpen) window.open = nativeWindow.open.bind(window);
          if (restoreSubmit) {
            HTMLFormElement.prototype.submit = nativeWindow.HTMLFormElement.prototype.submit;
          }
          frame.remove();
          delete window[key];
        }
      });
    } catch { /* A revoked host permission can prevent cleanup until the next page load. */ }
  }
}

async function updateEasyListIfDue(force = false) {
  const settings = await getSettings();
  if (!settings.protectionEnabled || !settings.networkBlockingEnabled || !settings.filterListEnabled) return { ok: false, message: "Aktifkan pemblokiran jaringan dan EasyList terlebih dahulu." };
  const permission = await chrome.permissions.contains({ origins: ["https://easylist.to/*"] });
  if (!permission) return { ok: false, message: "Izin EasyList belum diberikan." };
  const lastUpdated = Number(settings.easyListUpdatedAt) || 0;
  const refreshInterval = EASYLIST_REFRESH_DAYS * 24 * 60 * 60 * 1000;
  if (!force && lastUpdated && Date.now() - lastUpdated < refreshInterval) return { ok: true, skipped: true, message: "EasyList masih terbaru." };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response;
    try {
      response = await fetch(EASYLIST_SOURCE_URL, { signal: controller.signal, cache: "no-store" });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = await response.text();
    const easyListRules = parseEasyListText(source, EASYLIST_MAX_RULES);
    await chrome.storage.local.set({ easyListRules, easyListRuleCount: easyListRules.length, easyListUpdatedAt: Date.now(), easyListUpdateError: "" });
    await queueNetworkRulesUpdate();
    return { ok: true, count: easyListRules.length, message: `EasyList diperbarui (${easyListRules.length.toLocaleString("id-ID")} aturan).` };
  } catch (error) {
    const message = error?.name === "AbortError" ? "Permintaan EasyList melewati batas waktu." : `Pembaruan EasyList gagal: ${String(error?.message ?? error).slice(0, 180)}`;
    await chrome.storage.local.set({ easyListUpdateError: message });
    return { ok: false, message };
  }
}

async function refreshOverlayScripts() {
  const { overlaySelectors = {} } = await chrome.storage.local.get("overlaySelectors");
  const normalizedSelectors = {};
  for (const [storedHost, storedRules] of Object.entries(overlaySelectors)) {
    const hostname = normalizeSiteHost(storedHost);
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(hostname) || !Array.isArray(storedRules)) continue;
    normalizedSelectors[hostname] = [...new Set([...(normalizedSelectors[hostname] ?? []), ...storedRules.filter((selector) => typeof selector === "string" && /^#[A-Za-z0-9_:.-]+$/.test(selector))])];
  }
  if (JSON.stringify(normalizedSelectors) !== JSON.stringify(overlaySelectors)) {
    await chrome.storage.local.set({ overlaySelectors: normalizedSelectors });
  }

  const prefix = "browseshield-overlay-";
  const legacyIds = new Set(Object.keys(overlaySelectors).flatMap((host) => {
    const safe = host.replace(/[^a-z0-9_-]/gi, "-");
    return [`browseshield-${safe}`, `browseshield-www-${safe.replace(/^www-/, "")}`];
  }));
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const oldIds = registered.filter(({ id }) => id.startsWith(prefix) || legacyIds.has(id)).map(({ id }) => id);
  if (oldIds.length) await chrome.scripting.unregisterContentScripts({ ids: oldIds });

  const settings = await getSettings();
  if (!settings.protectionEnabled) return;
  const allowlisted = settings.whitelist;
  const scripts = [];
  for (const hostname of Object.keys(normalizedSelectors)) {
    if (isHostAllowlisted(hostname, allowlisted)) continue;
    const wwwHostname = `www.${hostname}`;
    const candidates = [`http://${hostname}/*`, `https://${hostname}/*`, `http://${wwwHostname}/*`, `https://${wwwHostname}/*`];
    const matches = [];
    for (const origin of candidates) {
      if (await chrome.permissions.contains({ origins: [origin] })) matches.push(origin);
    }
    if (!matches.length) continue;
    scripts.push({
      id: `${prefix}${hostname.replace(/[^a-z0-9_-]/gi, "-")}`,
      matches,
      js: ["src/content/overlay-heuristics.js", "src/content/overlay-detector.js"],
      runAt: "document_start",
      allFrames: true,
      persistAcrossSessions: true
    });
  }
  if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SETTINGS") {
    getSettings().then((settings) => {
      const { easyListRules: _rules, ...popupSettings } = settings;
      sendResponse({ settings: popupSettings });
    });
    return true;
  }

  if (message?.type === "UPDATE_EASYLIST_NOW") {
    updateEasyListIfDue(true).then(sendResponse).catch(() => sendResponse({ ok: false, message: "Pembaruan EasyList gagal." }));
    return true;
  }

  if (message?.type === "SET_SITE_ALLOWLIST" && typeof message.hostname === "string") {
    (async () => {
      const settings = await getSettings();
      const hostname = normalizeSiteHost(message.hostname);
      if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(hostname)) {
        sendResponse({ ok: false, error: "Nama situs tidak valid." });
        return;
      }
      const whitelist = new Set(settings.whitelist.map(normalizeSiteHost));
      if (message.allowed) whitelist.add(hostname);
      else whitelist.delete(hostname);
      const nextWhitelist = [...whitelist];
      await chrome.storage.local.set({ whitelist: nextWhitelist });
      sendResponse({ ok: true, settings: { ...settings, whitelist: nextWhitelist } });
    })().catch(() => sendResponse({ ok: false, error: "Pengecualian situs gagal disimpan." }));
    return true;
  }

  if (message?.type === "SET_ALL_SITES_PROTECTION" && typeof message.enabled === "boolean") {
    (async () => {
      const origins = ["http://*/*", "https://*/*"];
      if (message.enabled && !(await chrome.permissions.contains({ origins }))) {
        sendResponse({ ok: false, error: "Izin semua situs belum diberikan." });
        return;
      }
      const previous = (await getSettings()).protectAllSites;
      await chrome.storage.local.set({ protectAllSites: message.enabled });
      try {
        await queueNavigationGuardUpdate();
        const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [`browseshield-nav-main-all`, `browseshield-nav-isolated-all`] });
        if (message.enabled && scripts.length !== 2) throw new Error("Global navigation scripts were not registered.");
        if (!message.enabled) {
          try { await chrome.permissions.remove({ origins }); } catch { /* The browser may require revoking broad access in extension settings. */ }
        }
        sendResponse({ ok: true, enabled: message.enabled });
      } catch {
        await chrome.storage.local.set({ protectAllSites: previous });
        await queueNavigationGuardUpdate().catch(() => {});
        sendResponse({ ok: false, error: "Perlindungan semua situs gagal dipasang." });
      }
    })().catch(() => sendResponse({ ok: false, error: "Pengaturan semua situs gagal disimpan." }));
    return true;
  }

  if (message?.type === "SET_NAVIGATION_PROTECTION" && typeof message.hostname === "string" && typeof message.enabled === "boolean") {
    (async () => {
      const hostname = normalizeSiteHost(message.hostname);
      if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(hostname)) {
        sendResponse({ ok: false, error: "Nama situs tidak valid." });
        return;
      }
      const settings = await getSettings();
      if (message.enabled) {
        const wwwHostname = `www.${hostname}`;
        const origins = [`http://${hostname}/*`, `https://${hostname}/*`, `http://${wwwHostname}/*`, `https://${wwwHostname}/*`];
        let permitted = false;
        for (const origin of origins) {
          if (!permitted && await chrome.permissions.contains({ origins: [origin] })) permitted = true;
        }
        if (!permitted) {
          sendResponse({ ok: false, error: "Izin untuk situs ini belum diberikan." });
          return;
        }
      }
      const protectedSites = new Set((settings.navigationProtectedSites ?? []).map(normalizeSiteHost));
      if (message.enabled) protectedSites.add(hostname);
      else protectedSites.delete(hostname);
      const previousSites = settings.navigationProtectedSites ?? [];
      const nextSites = [...protectedSites];
      await chrome.storage.local.set({ navigationProtectedSites: nextSites });
      try {
        await queueNavigationGuardUpdate();
        sendResponse({ ok: true, navigationProtectedSites: nextSites });
      } catch {
        await chrome.storage.local.set({ navigationProtectedSites: previousSites });
        await queueNavigationGuardUpdate().catch(() => {});
        sendResponse({ ok: false, error: "Pencegahan navigasi gagal dipasang. Pastikan izin situs telah diberikan." });
      }
    })().catch(() => sendResponse({ ok: false, error: "Pengaturan pengalihan gagal disimpan." }));
    return true;
  }

  if (message?.type === "LOG_BLOCKED_POPUP" && typeof message.url === "string") {
    let destination;
    try {
      destination = new URL(message.url);
      if (!["http:", "https:"].includes(destination.protocol)) return false;
    } catch { return false; }
    appendSessionHistory({
      kind: message.sourceType === "tautan" ? "Tautan lintas situs dicegah"
        : message.sourceType === "form" ? "Form lintas situs dicegah"
          : "Popup atau tab baru dicegah",
      source: getHost(_sender.url ?? ""),
      destination: sanitizeHistoryDestination(destination.href),
      resourceType: message.sourceType ?? "popup"
    }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "SAVE_OVERLAY_SELECTORS" && typeof message.hostname === "string" && Array.isArray(message.selectors)) {
    (async () => {
      const hostname = normalizeSiteHost(message.hostname);
      const validHostname = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(hostname);
      const selectors = [...new Set(message.selectors.filter((selector) => typeof selector === "string" && /^#[A-Za-z0-9_:.-]+$/.test(selector)))];
      const wwwHostname = `www.${hostname}`;
      const origins = [`http://${hostname}/*`, `https://${hostname}/*`, `http://${wwwHostname}/*`, `https://${wwwHostname}/*`];
      if (!validHostname || !selectors.length || !(await chrome.permissions.contains({ origins }))) {
        sendResponse({ ok: false, error: "Izin situs belum diberikan atau selector tidak valid." });
        return;
      }
      const { overlaySelectors = {} } = await chrome.storage.local.get("overlaySelectors");
      overlaySelectors[hostname] = [...new Set([
        ...(overlaySelectors[hostname] ?? []),
        ...(overlaySelectors[wwwHostname] ?? []),
        ...selectors
      ])];
      delete overlaySelectors[wwwHostname];
      await chrome.storage.local.set({ overlaySelectors });
      await queueOverlayScriptUpdate();
      sendResponse({ ok: true, selectors: overlaySelectors[hostname] });
    })().catch(() => sendResponse({ ok: false, error: "Gagal menyimpan aturan situs." }));
    return true;
  }

  return false;
});

