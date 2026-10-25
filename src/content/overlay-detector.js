(() => {
  if (globalThis.__browseShieldLoaded) return;
  globalThis.__browseShieldLoaded = true;

  const markerId = "__browseshield_marker";
  let cleanupObserver = null;
  let pickerActive = false;
  let hoveredElement = null;
  let previousOutline = "";
  let savedSelectorObserver = null;
  let lastPickedElement = null;

  function selectorFor(element) {
    return element.id && /^[A-Za-z][A-Za-z0-9_:.-]*$/.test(element.id) ? `#${CSS.escape(element.id)}` : null;
  }

  async function applySavedSelectors() {
    const settings = await chrome.storage.local.get({ overlaySelectors: {}, protectionEnabled: true, whitelist: [] });
    const normalizedHost = location.hostname.toLowerCase().replace(/^www\./, "");
    const isSiteMatch = (site) => {
      const normalizedSite = String(site).toLowerCase().replace(/^www\./, "");
      return normalizedHost === normalizedSite || normalizedHost.endsWith(`.${normalizedSite}`);
    };
    const allowed = settings.whitelist.some(isSiteMatch);
    if (!settings.protectionEnabled || allowed) {
      savedSelectorObserver?.disconnect();
      document.querySelectorAll("[data-browseshield-persistent-hidden]").forEach((element) => {
        try {
          const [display, priority] = JSON.parse(element.getAttribute("data-browseshield-original-display") ?? '["",""]');
          if (display) element.style.setProperty("display", display, priority);
          else element.style.removeProperty("display");
        } catch { element.style.removeProperty("display"); }
        element.removeAttribute("data-browseshield-persistent-hidden");
        element.removeAttribute("data-browseshield-original-display");
      });
      return;
    }
    const selectors = [...new Set([
      ...(settings.overlaySelectors[normalizedHost] ?? []),
      ...(settings.overlaySelectors[location.hostname] ?? []),
      ...(settings.overlaySelectors[`www.${normalizedHost}`] ?? [])
    ])];
    const hideMatches = () => selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((element) => {
          if (!element.hasAttribute("data-browseshield-persistent-hidden")) {
            const previousDisplay = element.style.getPropertyValue("display");
            const previousPriority = element.style.getPropertyPriority("display");
            element.setAttribute("data-browseshield-original-display", JSON.stringify([previousDisplay, previousPriority]));
            element.setAttribute("data-browseshield-persistent-hidden", "true");
          }
          element.style.setProperty("display", "none", "important");
        });
      } catch { /* Ignore malformed legacy selectors. */ }
    });
    savedSelectorObserver?.disconnect();
    if (!selectors.length) return;
    hideMatches();
    if (document.documentElement) {
      savedSelectorObserver = new MutationObserver(hideMatches);
      savedSelectorObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  applySavedSelectors();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && ["overlaySelectors", "protectionEnabled", "whitelist"].some((key) => key in changes)) void applySavedSelectors();
  });

  function likelyOverlays() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!width || !height || !document.body) return [];
    const candidates = [...document.body.querySelectorAll("body *")].filter((element) => {
      if (element.id === markerId || element.closest(`#${markerId}`)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return globalThis.__browseShieldOverlayHeuristics?.isLikelyOverlay({
        position: style.position, display: style.display, visibility: style.visibility, pointerEvents: style.pointerEvents,
        width: Math.max(0, rect.width), height: Math.max(0, rect.height), viewportWidth: width, viewportHeight: height,
        opacity: Number.parseFloat(style.opacity), zIndex: Number.parseInt(style.zIndex, 10),
        backgroundColor: style.backgroundColor, tagName: element.tagName, id: element.id
      }) ?? false;
    });
    return candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
  }
  function hideOverlays(elements) {
    for (const element of elements) {
      if (!element.hasAttribute("data-browseshield-hidden")) {
        element.setAttribute("data-browseshield-original-style", JSON.stringify({
          display: [element.style.getPropertyValue("display"), element.style.getPropertyPriority("display")],
          pointerEvents: [element.style.getPropertyValue("pointer-events"), element.style.getPropertyPriority("pointer-events")]
        }));
      }
      element.setAttribute("data-browseshield-hidden", "true");
      element.style.setProperty("display", "none", "important");
      element.style.setProperty("pointer-events", "none", "important");
    }
  }

  function restoreHiddenOverlays(elements = [...document.querySelectorAll("[data-browseshield-hidden]")]) {
    cleanupObserver?.disconnect();
    cleanupObserver = null;
    for (const element of elements) {
      try {
        const original = JSON.parse(element.getAttribute("data-browseshield-original-style") ?? "{}");
        for (const [property, key] of [["display", "display"], ["pointer-events", "pointerEvents"]]) {
          const [value = "", priority = ""] = original[key] ?? [];
          if (value) element.style.setProperty(property, value, priority);
          else element.style.removeProperty(property);
        }
      } catch {
        element.style.removeProperty("display");
        element.style.removeProperty("pointer-events");
      }
      element.removeAttribute("data-browseshield-hidden");
      element.removeAttribute("data-browseshield-original-style");
    }
  }

  function beginOverlayCleanup() {
    const candidates = likelyOverlays();
    hideOverlays(candidates);
    monitorOverlays();
    showReport(candidates.length, true, candidates);
  }

  function monitorOverlays() {
    if (!cleanupObserver && document.body) {
      cleanupObserver = new MutationObserver(() => hideOverlays(likelyOverlays()));
      cleanupObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "id"] });
    }
  }

  function isLargeClickOverlay(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return globalThis.__browseShieldOverlayHeuristics?.isLikelyOverlay({
      position: style.position, display: style.display, visibility: style.visibility, pointerEvents: style.pointerEvents,
      width: rect.width, height: rect.height, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      opacity: Number.parseFloat(style.opacity), zIndex: Number.parseInt(style.zIndex, 10),
      backgroundColor: style.backgroundColor, tagName: element.tagName, id: element.id
    }) ?? false;
  }
  function guardOverlayClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const overlay = target.closest("#dontfoid") ?? target.closest("[data-browseshield-hidden]");
    if (!overlay || (!isLargeClickOverlay(overlay) && overlay.id !== "dontfoid")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    hideOverlays([overlay]);
    showReport(1, true, [overlay]);
  }

  function showReport(count, cleaned = false, reportedElements = null) {
    document.getElementById(markerId)?.remove();
    const panel = document.createElement("div");
    panel.id = markerId;
    const selectors = (reportedElements ?? likelyOverlays()).map(selectorFor).filter(Boolean);
    const detected = selectors.length ? ` Terdeteksi: ${[...new Set(selectors)].join(", ")}.` : "";
    const knownOverlayDetected = (reportedElements ?? []).some((element) => element.id === "dontfoid");
    const canUndo = (reportedElements ?? []).some((element) => element.hasAttribute("data-browseshield-hidden"));
    panel.innerHTML = `<div style="font-weight:700;margin-bottom:6px">BrowseShield diagnosis</div><div>${cleaned ? `${count} lapisan yang menutupi halaman disembunyikan${detected} Klik pada overlay dihentikan; pemantauan aktif sampai halaman dimuat ulang.` : `${count} elemen besar mungkin menangkap klik${detected}${knownOverlayDetected ? " Overlay #dontfoid terdeteksi dan dinonaktifkan." : " Diagnosis hanya memeriksa; pilih Bersihkan untuk menanganinya."}`}</div>${cleaned ? "" : '<button data-clean style="margin-top:10px;padding:6px 10px;cursor:pointer">Bersihkan overlay & cegah klik</button>'}${canUndo ? '<button data-undo style="margin:10px 0 0 6px;padding:6px 10px;cursor:pointer">Urungkan</button>' : ""}<button data-close style="margin:10px 0 0 6px;padding:6px 10px;cursor:pointer">Tutup</button>`;
    Object.assign(panel.style, {
      all: "initial", position: "fixed", zIndex: "2147483647", right: "16px", top: "16px",
      maxWidth: "300px", padding: "14px", background: "#102a43", color: "white",
      borderRadius: "10px", boxShadow: "0 4px 18px #0005", font: "14px/1.4 system-ui, sans-serif"
    });
    panel.querySelector("[data-clean]")?.addEventListener("click", beginOverlayCleanup);
    panel.querySelector("[data-undo]")?.addEventListener("click", () => {
      restoreHiddenOverlays();
      panel.remove();
    });
    panel.querySelector("[data-close]").addEventListener("click", () => panel.remove());
    document.documentElement.append(panel);
    if (!document.__browseShieldClickGuard) {
      document.__browseShieldClickGuard = true;
      document.addEventListener("click", guardOverlayClick, true);
    }
  }

  function restoreOutline() {
    if (hoveredElement?.isConnected) hoveredElement.style.outline = previousOutline;
    hoveredElement = null;
  }

  function onMove(event) {
    const target = event.target;
    if (!(target instanceof Element) || target.id === markerId || target.closest(`#${markerId}`)) return;
    restoreOutline();
    hoveredElement = target;
    previousOutline = target.style.outline;
    target.style.outline = "3px solid #23c9a9";
  }

  function onPick(event) {
    if (!pickerActive || !(event.target instanceof Element)) return;
    if (event.target.id === markerId || event.target.closest(`#${markerId}`)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (["HTML", "BODY"].includes(event.target.tagName)) {
      stopPicker();
      showPickerMessage("Pilih elemen di dalam halaman, bukan seluruh halaman.");
      return;
    }
    lastPickedElement = event.target;
    const previousDisplay = event.target.style.getPropertyValue("display");
    const previousPriority = event.target.style.getPropertyPriority("display");
    event.target.setAttribute("data-browseshield-picked-style", JSON.stringify([previousDisplay, previousPriority]));
    event.target.style.setProperty("display", "none", "important");
    stopPicker();
    showUndoToast(lastPickedElement);
  }

  function showUndoToast(element) {
    document.getElementById(markerId)?.remove();
    const panel = document.createElement("div");
    panel.id = markerId;
    panel.innerHTML = '<span>Elemen disembunyikan.</span> <button data-undo>Urungkan</button> <button data-close>Tutup</button>';
    Object.assign(panel.style, { all: "initial", position: "fixed", zIndex: "2147483647", right: "16px", top: "16px", padding: "12px", background: "#102a43", color: "white", borderRadius: "10px", boxShadow: "0 4px 18px #0005", font: "14px/1.4 system-ui, sans-serif" });
    panel.querySelectorAll("button").forEach((button) => Object.assign(button.style, { marginLeft: "8px", padding: "5px 8px", cursor: "pointer" }));
    panel.querySelector("[data-undo]").addEventListener("click", () => {
      if (element.hasAttribute("data-browseshield-hidden")) restoreHiddenOverlays([element]);
      else if (element.isConnected) {
        try {
          const [value = "", priority = ""] = JSON.parse(element.getAttribute("data-browseshield-picked-style") ?? '["",""]');
          if (value) element.style.setProperty("display", value, priority);
          else element.style.removeProperty("display");
          element.removeAttribute("data-browseshield-picked-style");
        } catch { element.style.removeProperty("display"); }
      }
      panel.remove();
    });
    panel.querySelector("[data-close]").addEventListener("click", () => panel.remove());
    document.documentElement.append(panel);
  }

  function showPickerMessage(message) {
    document.getElementById(markerId)?.remove();
    const panel = document.createElement("div");
    panel.id = markerId;
    panel.textContent = message;
    Object.assign(panel.style, { all: "initial", position: "fixed", zIndex: "2147483647", right: "16px", top: "16px", padding: "12px", background: "#102a43", color: "white", borderRadius: "10px", font: "14px system-ui, sans-serif" });
    document.documentElement.append(panel);
  }

  function stopPicker() {
    pickerActive = false;
    restoreOutline();
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onPick, true);
    document.body.style.cursor = "";
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "RUN_DIAGNOSIS") {
      const candidates = likelyOverlays();
      const knownOverlays = candidates.filter((element) => element.id === "dontfoid");
      hideOverlays(knownOverlays);
      if (knownOverlays.length) monitorOverlays();
      showReport(candidates.length, false, candidates);
      sendResponse({ selectors: [...new Set(candidates.map(selectorFor).filter(Boolean))] });
    }
    if (message?.type === "APPLY_SAVED_SELECTORS") applySavedSelectors();
    if (message?.type === "START_PICKER") {
      stopPicker();
      pickerActive = true;
      document.body.style.cursor = "crosshair";
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("click", onPick, true);
    }
    return true;
  });
})();
