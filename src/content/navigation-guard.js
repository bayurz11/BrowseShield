(() => {
  const key = "__browseShieldNavigationGuardV2";
  const existing = window[key];
  if (existing?.version === 2) return;
  const nativeSubmit = HTMLFormElement.prototype.submit;
  const state = {
    version: 2,
    wrappedOpen: null,
    wrappedSubmit: null
  };
  state.wrappedOpen = function (url, target, features) {
    // Page-world popup calls are blocked; isolated-world click handling records user-triggered attempts.
    // Block about:blank too; ad scripts commonly navigate that window later.
    return null;
  };
  state.wrappedSubmit = function () {
    try {
      const destination = new URL(this.action || location.href, location.href);
      const target = (this.target || "_self").toLowerCase();
      const currentHost = location.hostname.toLowerCase().replace(/^www\./, "");
      const targetHost = destination.hostname.toLowerCase().replace(/^www\./, "");
      if (targetHost !== currentHost || (target && target !== "_self")) {
        return;
      }
    } catch { return; }
    return nativeSubmit.call(this);
  };
  Object.defineProperty(window, key, { value: state, configurable: true });
  window.open = state.wrappedOpen;
  HTMLFormElement.prototype.submit = state.wrappedSubmit;
})();
