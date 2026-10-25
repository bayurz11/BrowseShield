const enabledInput = document.querySelector("#enabled");
const allSitesInput = document.querySelector("#all-sites");
const networkInput = document.querySelector("#network");
const filterListInput = document.querySelector("#filter-list");
const networkHint = document.querySelector("#network-hint");
const redirectInput = document.querySelector("#redirect");
const siteLabel = document.querySelector("#site");
const siteState = document.querySelector("#site-state");
const siteNote = document.querySelector("#site-note");
const allowButton = document.querySelector("#allowlist");
const status = document.querySelector("#status");
let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
let hostname = null;
let settings = {};
let diagnosedSelectors = [];

settings = (await chrome.runtime.sendMessage({ type: "GET_SETTINGS" })).settings;
enabledInput.checked = settings.protectionEnabled;
allSitesInput.checked = settings.protectAllSites;
networkInput.checked = settings.networkBlockingEnabled;
filterListInput.checked = settings.filterListEnabled;
updateNetworkControls();
updateProtectionBadge();
await refreshTabContext();

function updateProtectionBadge() {
  const active = enabledInput.checked;
  document.querySelector("#protection-state").textContent = active ? "Aktif" : "Jeda";
  document.querySelector(".status-badge").classList.toggle("is-paused", !active);
  allSitesInput.disabled = !active;
  updateNetworkControls();
}

function isWhitelisted(host = hostname) {
  if (!host) return false;
  const normalize = (value) => value.replace(/^www\./i, "").toLowerCase();
  const current = normalize(host);
  return settings.whitelist.some((site) => {
    const allowed = normalize(site);
    return current === allowed || current.endsWith(`.${allowed}`);
  });
}

async function refreshTabContext() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id !== tab?.id || activeTab?.url !== tab?.url) {
    diagnosedSelectors = [];
    document.querySelector("#save-rules").hidden = true;
  }
  tab = activeTab;
  try { hostname = new URL(tab?.url).hostname; } catch { hostname = null; }
  siteLabel.textContent = hostname ?? "Halaman ini tidak dapat diakses";
  redirectInput.checked = Boolean(hostname && !isWhitelisted(hostname) && (settings.protectAllSites || settings.navigationProtectedSites?.some((site) => site.replace(/^www\./i, "").toLowerCase() === hostname.replace(/^www\./i, "").toLowerCase())));
  if (hostname && redirectInput.checked && !settings.protectAllSites) {
    const permissionHost = hostname.replace(/^www\./i, "");
    const hasPermission = await chrome.permissions.contains({ origins: [
      `http://${permissionHost}/*`, `https://${permissionHost}/*`,
      `http://www.${permissionHost}/*`, `https://www.${permissionHost}/*`
    ] });
    if (!hasPermission) status.textContent = "Perlindungan tersimpan, tetapi izin situs perlu diberikan ulang. Matikan lalu aktifkan kembali fitur ini.";
  }
  if (settings.protectAllSites) {
    const hasGlobalPermission = await chrome.permissions.contains({ origins: ["http://*/*", "https://*/*"] });
    if (!hasGlobalPermission) status.textContent = "Perlindungan semua situs tersimpan, tetapi izinnya dicabut. Matikan lalu aktifkan kembali untuk meminta izin.";
  }
  updateAllowButton();
}

function updateAllowButton() {
  const allowed = isWhitelisted();
  redirectInput.checked = Boolean(hostname && !allowed && (settings.protectAllSites || settings.navigationProtectedSites?.some((site) => site.replace(/^www\./i, "").toLowerCase() === hostname.replace(/^www\./i, "").toLowerCase())));
  siteState.classList.toggle("is-exempt", allowed);
  siteState.classList.toggle("is-protected", !allowed && settings.protectionEnabled && redirectInput.checked);
  siteState.classList.toggle("is-warning", !allowed && settings.protectionEnabled && !redirectInput.checked);
  siteState.textContent = !hostname ? "Tidak tersedia"
    : allowed ? "Tidak dilindungi"
      : !settings.protectionEnabled ? "Perlindungan dijeda"
        : redirectInput.checked ? "Popup ditahan"
          : "Popup belum ditahan";
  siteNote.textContent = !hostname
    ? "Buka halaman web untuk mengatur perlindungan situs."
    : allowed
      ? "BrowseShield dilewati di situs ini. Pilih tombol di bawah untuk mengaktifkan perlindungan kembali."
      : !settings.protectionEnabled
        ? "Perlindungan sedang dijeda. Aktifkan BrowseShield untuk melanjutkan."
        : redirectInput.checked
          ? "Popup dan tautan ke situs lain akan ditahan; tautan di situs ini tetap berfungsi."
          : "Popup atau tautan ke situs lain belum ditahan. Nyalakan sakelar di bawah untuk mencegahnya.";
  allowButton.disabled = !hostname;
  allowButton.textContent = allowed ? "Aktifkan perlindungan di situs ini" : "Jadikan situs pengecualian";
  redirectInput.disabled = !settings.protectionEnabled || !hostname || allowed || settings.protectAllSites;
}

function updateNetworkControls() {
  filterListInput.disabled = !networkInput.checked || !enabledInput.checked;
  networkHint.textContent = !enabledInput.checked
    ? "Aktifkan BrowseShield untuk menggunakan pemblokiran jaringan."
    : !networkInput.checked
    ? "Aktifkan daftar blokir untuk memakai filter iklan."
    : filterListInput.checked
      ? "Filter iklan dan pelacak aktif. Jika situs bermasalah, matikan filter ini."
      : "Pemblokiran jaringan aktif. Nyalakan filter untuk memblokir iklan dan pelacak umum.";
  networkHint.classList.toggle("is-active", enabledInput.checked && networkInput.checked && filterListInput.checked);
}

enabledInput.addEventListener("change", async () => {
  settings.protectionEnabled = enabledInput.checked;
  await chrome.storage.local.set({ protectionEnabled: enabledInput.checked });
  updateProtectionBadge();
  await refreshTabContext();
  status.textContent = enabledInput.checked
    ? "Perlindungan diaktifkan."
    : "Perlindungan dinonaktifkan. Refresh tab ini untuk melepas guard yang sudah terpasang.";
});

allSitesInput.addEventListener("change", async () => {
  const desiredState = allSitesInput.checked;
  allSitesInput.disabled = true;
  if (desiredState) {
    let granted = false;
    try { granted = await chrome.permissions.request({ origins: ["http://*/*", "https://*/*"] }); } catch { /* Permission request is unavailable on this page. */ }
    if (!granted) {
      allSitesInput.checked = false;
      updateProtectionBadge();
      status.textContent = "Izin semua situs tidak diberikan; perlindungan tetap berlaku hanya di situs yang dipilih.";
      return;
    }
  }
  const result = await chrome.runtime.sendMessage({ type: "SET_ALL_SITES_PROTECTION", enabled: desiredState });
  if (!result?.ok) {
    allSitesInput.checked = !desiredState;
    updateProtectionBadge();
    status.textContent = result?.error ?? "Pengaturan semua situs gagal disimpan.";
    return;
  }
  settings.protectAllSites = desiredState;
  await refreshTabContext();
  updateProtectionBadge();
  status.textContent = desiredState
    ? "Perlindungan pengalihan aktif pada situs yang dapat diakses, termasuk tab yang sudah terbuka."
    : "Perlindungan semua situs dinonaktifkan; pengaturan per situs tetap tersimpan.";
});

networkInput.addEventListener("change", async () => {
  settings.networkBlockingEnabled = networkInput.checked;
  await chrome.storage.local.set({ networkBlockingEnabled: networkInput.checked });
  updateNetworkControls();
  status.textContent = networkInput.checked ? "Daftar blokir diaktifkan." : "Daftar blokir dijeda.";
});

filterListInput.addEventListener("change", async () => {
  settings.filterListEnabled = filterListInput.checked;
  await chrome.storage.local.set({ filterListEnabled: filterListInput.checked });
  updateNetworkControls();
  status.textContent = filterListInput.checked ? "Filter iklan dan pelacak diaktifkan." : "Filter iklan dan pelacak dinonaktifkan.";
});

redirectInput.addEventListener("change", async () => {
  if (!hostname) { redirectInput.checked = false; status.textContent = "Buka situs web biasa untuk mengatur perlindungan ini."; return; }
  redirectInput.disabled = true;
  const desiredState = redirectInput.checked;
  if (desiredState) {
    const permissionHost = hostname.replace(/^www\./i, "");
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [
        `http://${permissionHost}/*`, `https://${permissionHost}/*`,
        `http://www.${permissionHost}/*`, `https://www.${permissionHost}/*`
      ] });
    } catch { /* Permission request is unavailable on this page. */ }
    if (!granted) {
      redirectInput.checked = false;
      redirectInput.disabled = false;
      status.textContent = "Izin untuk situs ini diperlukan agar pengalihan dapat dicegah sebelum halaman berpindah.";
      return;
    }
  }
  const result = await chrome.runtime.sendMessage({ type: "SET_NAVIGATION_PROTECTION", hostname, enabled: desiredState });
  redirectInput.disabled = false;
  if (!result?.ok) {
    redirectInput.checked = !desiredState;
    status.textContent = result?.error ?? "Pengaturan gagal disimpan.";
    return;
  }
  settings.navigationProtectedSites = result.navigationProtectedSites;
  if (desiredState && tab?.id) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", files: ["src/content/navigation-guard.js"] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content/navigation-interceptor.js"] });
    } catch { /* Registered scripts will take effect on the next navigation. */ }
  }
  status.textContent = redirectInput.checked
    ? `Pencegahan aktif di ${hostname}. Tautan keluar ditahan dan popup/tab baru diblokir.`
    : `Perlindungan pengalihan untuk ${hostname} dinonaktifkan pada tab yang terbuka.`;
});

allowButton.addEventListener("click", async () => {
  const allowed = !isWhitelisted(hostname);
  const result = await chrome.runtime.sendMessage({ type: "SET_SITE_ALLOWLIST", hostname, allowed });
  if (!result?.ok) { status.textContent = result?.error ?? "Pengecualian gagal disimpan."; return; }
  settings = result.settings;
  updateAllowButton();
  status.textContent = allowed
    ? "Situs ini tidak dilindungi. Aktifkan perlindungan kembali lewat tombol di atas."
    : "Perlindungan kembali aktif untuk situs ini, termasuk tab yang sudah terbuka.";
});

async function messagePage(type) {
  await refreshTabContext();
  if (!tab?.id || !hostname) { status.textContent = "Buka situs web biasa untuk memakai fitur ini."; return; }
  if (!settings.protectionEnabled || isWhitelisted(hostname)) { status.textContent = "Aktifkan perlindungan dan hapus situs dari pengecualian terlebih dahulu."; return; }
  if (type === "RUN_DIAGNOSIS" && !settings.overlayDiagnosisEnabled) { status.textContent = "Aktifkan Diagnosis overlay melalui Pengaturan terlebih dahulu."; return; }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/content/overlay-heuristics.js", "src/content/overlay-detector.js"] });
    const result = await chrome.tabs.sendMessage(tab.id, { type });
    if (type === "RUN_DIAGNOSIS") {
      diagnosedSelectors = result?.selectors ?? [];
      document.querySelector("#save-rules").hidden = diagnosedSelectors.length === 0;
    }
    status.textContent = type === "RUN_DIAGNOSIS"
      ? "Diagnosis selesai. Elemen penghalang yang dikenal dinonaktifkan; tinjau hasilnya di halaman sebelum membersihkan elemen lain."
      : "Pilih mode aktif. Klik bagian halaman yang ingin disembunyikan.";
  } catch {
    status.textContent = "Ekstensi tidak dapat berjalan pada halaman ini.";
  }
}

document.querySelector("#diagnose").addEventListener("click", () => messagePage("RUN_DIAGNOSIS"));
document.querySelector("#picker").addEventListener("click", () => messagePage("START_PICKER"));
document.querySelector("#open-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.querySelector("#manage-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.querySelector("#open-history").addEventListener("click", () => chrome.tabs.create({ url: `${chrome.runtime.getURL("src/options/options.html")}#history` }));
updateHistoryCount();

async function updateHistoryCount() {
  try {
    const { blockedHistory = [] } = await chrome.storage.session.get("blockedHistory");
    document.querySelector("#history-count").textContent = String(blockedHistory.length);
  } catch {
    document.querySelector("#history-count").textContent = "–";
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.blockedHistory) updateHistoryCount();
});
document.querySelector("#save-rules").addEventListener("click", async () => {
  await refreshTabContext();
  if (!hostname || !diagnosedSelectors.length) return;
  const normalizedHost = hostname.replace(/^www\./i, "");
  const origins = [
    `http://${normalizedHost}/*`, `https://${normalizedHost}/*`,
    `http://www.${normalizedHost}/*`, `https://www.${normalizedHost}/*`
  ];
  let granted = false;
  try { granted = await chrome.permissions.request({ origins }); } catch { /* Permission request is unavailable on this page. */ }
  if (!granted) { status.textContent = "Izin situs diperlukan agar aturan tetap berlaku setelah refresh."; return; }
  const result = await chrome.runtime.sendMessage({ type: "SAVE_OVERLAY_SELECTORS", hostname: normalizedHost, selectors: diagnosedSelectors });
  if (result.ok) {
    await chrome.tabs.sendMessage(tab.id, { type: "APPLY_SAVED_SELECTORS" });
    status.textContent = `Pilihan disimpan dan akan diterapkan di halaman lain pada ${normalizedHost}.`;
  } else status.textContent = result.error;
});

chrome.tabs.onActivated.addListener(() => refreshTabContext());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url) refreshTabContext();
});
