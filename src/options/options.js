const enabled = document.querySelector("#enabled");
const overlay = document.querySelector("#overlay");
const network = document.querySelector("#network");
const filterList = document.querySelector("#filter-list");
const sites = document.querySelector("#sites");
const blockedDomains = document.querySelector("#blocked-domains");
const domainInput = document.querySelector("#domain-input");
const status = document.querySelector("#status");
const filterHint = document.querySelector("#filter-hint");
const historyList = document.querySelector("#history-list");
const historySummary = document.querySelector("#history-summary");
const historyCapability = document.querySelector("#history-capability");
const easyListStatus = document.querySelector("#easylist-status");
const updateEasyListButton = document.querySelector("#update-easylist");
let settings = await chrome.storage.local.get({ protectionEnabled: true, overlayDiagnosisEnabled: true, networkBlockingEnabled: false, filterListEnabled: false, blockedDomains: [], whitelist: [], easyListRuleCount: 0, easyListUpdatedAt: 0, easyListUpdateError: "" });
enabled.checked = settings.protectionEnabled;
overlay.checked = settings.overlayDiagnosisEnabled;
network.checked = settings.networkBlockingEnabled;
filterList.checked = settings.filterListEnabled;
updateFilterAvailability();
renderSites();
renderBlockedDomains();
renderHistory();
renderEasyListStatus();
historyCapability.textContent = chrome.declarativeNetRequest?.onRuleMatchedDebug
  ? "Riwayat ini hanya berisi kejadian yang dapat dideteksi BrowseShield, bukan seluruh aktivitas browser. Parameter sensitif pada URL tidak disimpan."
  : "Browser ini tidak menyediakan laporan kecocokan aturan jaringan. Riwayat pengalihan mungkin tetap tersedia, tetapi tidak mencatat semua aktivitas. Parameter sensitif pada URL tidak disimpan.";
if (location.hash === "#history") document.querySelector("#history").scrollIntoView({ block: "start" });

async function save(patch) {
  settings = { ...settings, ...patch };
  await chrome.storage.local.set(patch);
  status.textContent = "Pengaturan disimpan.";
}

function renderSites() {
  sites.replaceChildren();
  if (settings.whitelist.length === 0) {
    const empty = document.createElement("li");
    empty.className = "list-empty";
    empty.textContent = "Belum ada situs yang dikecualikan.";
    sites.append(empty);
    return;
  }
  for (const hostname of settings.whitelist) {
    const item = document.createElement("li");
    item.append(document.createTextNode(hostname));
    const button = document.createElement("button");
    button.innerHTML = '<svg aria-hidden="true"><use href="../assets/heroicons.svg#trash"></use></svg><span>Hapus</span>';
    button.setAttribute("aria-label", `Hapus pengecualian ${hostname}`);
    button.title = `Hapus ${hostname}`;
    button.addEventListener("click", async () => {
      settings.whitelist = settings.whitelist.filter((site) => site !== hostname);
      await save({ whitelist: settings.whitelist });
      renderSites();
    });
    item.append(button);
    sites.append(item);
  }
}

function renderBlockedDomains() {
  blockedDomains.replaceChildren();
  if (settings.blockedDomains.length === 0) {
    const empty = document.createElement("li");
    empty.className = "list-empty";
    empty.textContent = "Belum ada domain yang diblokir.";
    blockedDomains.append(empty);
    return;
  }
  for (const hostname of settings.blockedDomains) {
    const item = document.createElement("li");
    item.append(document.createTextNode(hostname));
    const button = document.createElement("button");
    button.innerHTML = '<svg aria-hidden="true"><use href="../assets/heroicons.svg#trash"></use></svg><span>Hapus</span>';
    button.setAttribute("aria-label", `Hapus domain ${hostname}`);
    button.title = `Hapus ${hostname}`;
    button.addEventListener("click", async () => {
      settings.blockedDomains = settings.blockedDomains.filter((domain) => domain !== hostname);
      await save({ blockedDomains: settings.blockedDomains });
      renderBlockedDomains();
    });
    item.append(button);
    blockedDomains.append(item);
  }
}

document.querySelector("#domain-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = domainInput.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) {
    status.textContent = "Masukkan alamat situs tanpa https:// atau bagian setelah garis miring. Contoh: iklan.example.";
    return;
  }
  if (!settings.blockedDomains.includes(value)) {
    settings.blockedDomains = [...settings.blockedDomains, value];
    await save({ blockedDomains: settings.blockedDomains });
    renderBlockedDomains();
  }
  domainInput.value = "";
});

enabled.addEventListener("change", async () => {
  updateFilterAvailability();
  await save({ protectionEnabled: enabled.checked });
});
overlay.addEventListener("change", () => save({ overlayDiagnosisEnabled: overlay.checked }));
network.addEventListener("change", async () => {
  updateFilterAvailability();
  await save({ networkBlockingEnabled: network.checked });
});
filterList.addEventListener("change", async () => {
  await save({ filterListEnabled: filterList.checked });
  updateFilterAvailability();
});

updateEasyListButton.addEventListener("click", async () => {
  if (!enabled.checked || !network.checked || !filterList.checked) {
    status.textContent = "Aktifkan perlindungan jaringan dan EasyList terlebih dahulu.";
    return;
  }
  updateEasyListButton.disabled = true;
  try {
    const granted = await chrome.permissions.request({ origins: ["https://easylist.to/*"] });
    if (!granted) {
      status.textContent = "Izin EasyList tidak diberikan; aturan bawaan tetap digunakan.";
      return;
    }
    status.textContent = "Mengunduh dan memeriksa pembaruan EasyList…";
    const result = await chrome.runtime.sendMessage({ type: "UPDATE_EASYLIST_NOW" });
    status.textContent = result?.message ?? "Pembaruan EasyList gagal.";
    settings = { ...settings, ...await chrome.storage.local.get({ easyListRuleCount: 0, easyListUpdatedAt: 0, easyListUpdateError: "" }) };
    renderEasyListStatus();
  } catch {
    status.textContent = "Pembaruan EasyList gagal. Periksa koneksi dan izin situs.";
  } finally {
    updateEasyListButton.disabled = false;
  }
});

function renderEasyListStatus() {
  const count = Number(settings.easyListRuleCount) || 0;
  if (settings.easyListUpdateError) easyListStatus.textContent = settings.easyListUpdateError;
  else if (settings.easyListUpdatedAt) easyListStatus.textContent = `Diperbarui ${new Date(settings.easyListUpdatedAt).toLocaleString("id-ID")} · ${count.toLocaleString("id-ID")} aturan tersimpan`;
  else easyListStatus.textContent = "Belum pernah diperbarui; daftar bawaan akan digunakan sampai pembaruan berhasil.";
}

function updateFilterAvailability() {
  filterList.disabled = !network.checked || !enabled.checked;
  filterHint.textContent = !enabled.checked
    ? "Aktifkan BrowseShield untuk menggunakan pemblokiran jaringan."
    : !network.checked
    ? "Aktifkan “Blokir daftar situs” untuk menggunakan EasyList."
    : filterList.checked
      ? "EasyList aktif. Jika situs bermasalah, matikan filter ini atau tambahkan situs ke pengecualian."
      : "Pemblokiran jaringan aktif. Nyalakan EasyList untuk memblokir permintaan dari daftar komunitas.";
  filterHint.classList.toggle("is-active", network.checked && filterList.checked);
}

async function renderHistory() {
  historyList.replaceChildren();
  try {
    const { blockedHistory = [] } = await chrome.storage.session.get("blockedHistory");
    historySummary.textContent = `${blockedHistory.length} dari 100 catatan`;
    if (!blockedHistory.length) {
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "Belum ada permintaan yang diblokir pada sesi ini.";
      historyList.append(empty);
      return;
    }
    for (const entry of blockedHistory) {
      const item = document.createElement("li");
      item.className = "history-item";
      const heading = document.createElement("div");
      heading.className = "history-heading";
      const reason = document.createElement("strong");
      reason.textContent = entry.kind ?? "Permintaan diblokir";
      const time = document.createElement("time");
      time.dateTime = new Date(entry.time).toISOString();
      time.textContent = new Date(entry.time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      heading.append(reason, time);
      const route = document.createElement("div");
      route.className = "history-route";
      route.textContent = `${entry.source ?? "Asal tidak diketahui"} → ${entry.destination ?? "Tujuan tidak diketahui"}`;
      const meta = document.createElement("small");
      meta.textContent = `Jenis: ${entry.resourceType ?? "unknown"}`;
      item.append(heading, route, meta);
      historyList.append(item);
    }
  } catch {
    historySummary.textContent = "Pencatatan sesi tidak tersedia di browser ini.";
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "Gunakan browser yang mendukung chrome.storage.session.";
    historyList.append(empty);
  }
}

document.querySelector("#clear-history").addEventListener("click", async () => {
  try {
    if (!chrome.storage.session) throw new Error("Session storage is unavailable.");
    await chrome.storage.session.remove("blockedHistory");
    await renderHistory();
    status.textContent = "Riwayat sesi dihapus.";
  } catch {
    status.textContent = "Riwayat tidak dapat dihapus karena penyimpanan sesi tidak tersedia di browser ini.";
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.blockedHistory) renderHistory();
  if (area === "local" && ["easyListRuleCount", "easyListUpdatedAt", "easyListUpdateError"].some((key) => key in changes)) {
    void chrome.storage.local.get({ easyListRuleCount: 0, easyListUpdatedAt: 0, easyListUpdateError: "" }).then((latest) => {
      settings = { ...settings, ...latest };
      renderEasyListStatus();
    });
  }
});
