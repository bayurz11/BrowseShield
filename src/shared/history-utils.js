export const EXTERNAL_NAVIGATION_RULE_ID = 50_000;
export const EASYLIST_DYNAMIC_RULE_ID_START = 100_000;

export function sanitizeHistoryDestination(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "Tujuan tidak diketahui";
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    const safe = url.href;
    return safe.length > 1024 ? `${safe.slice(0, 1021)}…` : safe;
  } catch {
    return "Tujuan tidak diketahui";
  }
}

export function historyKindForRule(ruleId) {
  if (ruleId === EXTERNAL_NAVIGATION_RULE_ID) return "Navigasi lintas situs diblokir";
  if (Number.isInteger(ruleId) && ruleId >= EASYLIST_DYNAMIC_RULE_ID_START) return "Iklan/pelacak diblokir";
  return "Permintaan jaringan diblokir";
}
