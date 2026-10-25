(() => {
  if (globalThis.__browseShieldNavigationInterceptor) return;
  globalThis.__browseShieldNavigationInterceptor = true;
  window.__browseShieldNavigationGuardActive = true;

  async function syncProtectionState() {
    try {
      const settings = await chrome.storage.local.get({ protectionEnabled: true, protectAllSites: false, navigationProtectedSites: [], whitelist: [] });
      const normalize = (host) => String(host).toLowerCase().replace(/^www\./, "");
      const host = normalize(location.hostname);
      const isSiteMatch = (site) => {
        const normalizedSite = normalize(site);
        return host === normalizedSite || host.endsWith(`.${normalizedSite}`);
      };
      const active = settings.protectionEnabled
        && (settings.protectAllSites || (settings.navigationProtectedSites ?? []).some(isSiteMatch))
        && !(settings.whitelist ?? []).some(isSiteMatch);
      window.__browseShieldNavigationGuardActive = active;
    } catch { /* Keep the registered guard state if storage is temporarily unavailable. */ }
  }
  void syncProtectionState();
  chrome.storage.onChanged.addListener((_changes, area) => { if (area === "local") void syncProtectionState(); });

  function report(url, type) {
    chrome.runtime.sendMessage({ type: "LOG_BLOCKED_POPUP", url, sourceType: type }).catch(() => {});
  }

  function externalUrl(value) {
    try {
      const destination = new URL(value, location.href);
      const currentHost = location.hostname.toLowerCase().replace(/^www\./, "");
      const targetHost = destination.hostname.toLowerCase().replace(/^www\./, "");
      return ["http:", "https:"].includes(destination.protocol) && targetHost !== currentHost
        ? destination.href
        : null;
    } catch {
      return null;
    }
  }

  function blockEvent(event, url, type) {
    if (!url) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    report(url, type);
  }

  function findAnchor(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
    return path.find((node) => node instanceof HTMLAnchorElement || node instanceof HTMLAreaElement) ?? null;
  }

  function onLinkActivation(event) {
    if (window.__browseShieldNavigationGuardActive === false) return;
    const anchor = findAnchor(event);
    if (!anchor || anchor.hasAttribute("download")) return;
    const target = (anchor.getAttribute("target") || "_self").toLowerCase();
    const opensNewContext = (target && target !== "_self") || event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1;
    const destination = externalUrl(anchor.href);
    if (destination) blockEvent(event, destination, "tautan");
    else if (opensNewContext) blockEvent(event, anchor.href, "popup");
  }

  window.addEventListener("click", onLinkActivation, true);
  window.addEventListener("auxclick", onLinkActivation, true);

  window.addEventListener("submit", (event) => {
    if (window.__browseShieldNavigationGuardActive === false) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const destination = externalUrl(form.action || location.href);
    const target = (form.target || "_self").toLowerCase();
    if (destination) blockEvent(event, destination, "form");
    else if (target && target !== "_self") blockEvent(event, form.action || location.href, "popup");
  }, true);

})();
