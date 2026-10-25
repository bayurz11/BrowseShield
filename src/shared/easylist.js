export const EASYLIST_SOURCE_URL = "https://easylist.to/easylist/easylist.txt";
export const EASYLIST_MAX_RULES = 20_000;

function selectAcrossList(items, limit) {
  if (limit <= 0 || items.length === 0) return [];
  if (items.length <= limit) return items;
  return Array.from({ length: limit }, (_, index) => items[Math.floor(index * items.length / limit)]);
}

const RESOURCE_TYPES = {
  script: ["script"],
  image: ["image"],
  stylesheet: ["stylesheet"],
  xmlhttprequest: ["xmlhttprequest"],
  xhr: ["xmlhttprequest"],
  font: ["font"],
  media: ["media"],
  subdocument: ["sub_frame"],
  object: ["object"],
  ping: ["ping"],
  websocket: ["websocket"],
  webtransport: ["webtransport"],
  other: ["other"],
  document: ["main_frame", "sub_frame"]
};

function parseRule(line) {
  const exception = line.startsWith("@@");
  const raw = exception ? line.slice(2) : line;
  const dollar = raw.indexOf("$");
  const urlFilter = (dollar < 0 ? raw : raw.slice(0, dollar)).trim();
  if (!urlFilter || urlFilter.length > 1024 || !/^[*|a-z0-9._~:/?&=%+@!^#-]+$/i.test(urlFilter)) return null;
  if (urlFilter.includes("||*") || (urlFilter.match(/\|/g)?.length ?? 0) > 2 || (urlFilter.includes("|") && !urlFilter.startsWith("|") && !urlFilter.endsWith("|"))) return null;

  const options = dollar < 0 ? [] : raw.slice(dollar + 1).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  let priority = exception ? 2 : 1;
  let domainType;
  let isUrlFilterCaseSensitive;
  let includedTypes = [];
  const excludedTypes = new Set();
  const initiatorDomains = [];
  const excludedInitiatorDomains = [];
  for (const option of options) {
    if (option === "important" && !exception) { priority = 3; continue; }
    if (option === "match-case") { isUrlFilterCaseSensitive = true; continue; }
    if (option === "third-party" || option === "3p") { domainType = "thirdParty"; continue; }
    if (option === "~third-party" || option === "~3p") { domainType = "firstParty"; continue; }
    if (option.startsWith("domain=")) {
      const domains = option.slice(7).split("|").filter(Boolean);
      if (!domains.length) return null;
      for (const value of domains) {
        const excluded = value.startsWith("~");
        const host = (excluded ? value.slice(1) : value).replace(/^\.+|\.+$/g, "");
        if (!host || !/^[a-z0-9.-]+$/i.test(host)) return null;
        (excluded ? excludedInitiatorDomains : initiatorDomains).push(host);
      }
      continue;
    }
    const excluded = option.startsWith("~");
    const type = RESOURCE_TYPES[excluded ? option.slice(1) : option];
    if (!type) return null;
    if (excluded) type.forEach((item) => excludedTypes.add(item));
    else includedTypes.push(...type);
  }

  if (includedTypes.length) includedTypes = [...new Set(includedTypes)].filter((type) => !excludedTypes.has(type));
  else if (excludedTypes.size) includedTypes = Object.values(RESOURCE_TYPES).flat().filter((type, index, all) => all.indexOf(type) === index && !excludedTypes.has(type));
  if (options.some((option) => RESOURCE_TYPES[option] || RESOURCE_TYPES[option.slice(1)])) {
    if (!includedTypes.length) return null;
  }

  const condition = { urlFilter };
  if (includedTypes.length) condition.resourceTypes = includedTypes;
  if (domainType) condition.domainType = domainType;
  if (initiatorDomains.length) condition.initiatorDomains = [...new Set(initiatorDomains)];
  if (excludedInitiatorDomains.length) condition.excludedInitiatorDomains = [...new Set(excludedInitiatorDomains)];
  if (isUrlFilterCaseSensitive) condition.isUrlFilterCaseSensitive = true;
  return { priority, action: { type: exception ? "allow" : "block" }, condition };
}

export function parseEasyListText(source, maxRules = EASYLIST_MAX_RULES) {
  if (typeof source !== "string" || !source.startsWith("[Adblock") || source.length < 100_000) {
    throw new Error("EasyList did not pass basic validation.");
  }
  const blocks = [];
  const exceptions = [];
  const seen = new Set();
  const lines = source.split(/\r?\n/);
  const disabled = new Set();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const dollar = line.indexOf("$");
    if (dollar < 0) continue;
    const options = line.slice(dollar + 1).split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
    if (!options.includes("badfilter")) continue;
    const pattern = line.slice(0, dollar);
    const remaining = options.filter((part) => part !== "badfilter").sort().join(",");
    disabled.add(`${pattern}$${remaining}`);
  }
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("!") || trimmed.startsWith("[") || trimmed.includes("##") || trimmed.includes("#@#")) continue;
    const dollar = trimmed.indexOf("$");
    const signature = dollar < 0 ? `${trimmed}$` : `${trimmed.slice(0, dollar)}$${trimmed.slice(dollar + 1).split(",").map((part) => part.trim().toLowerCase()).sort().join(",")}`;
    if (disabled.has(signature) || (dollar >= 0 && trimmed.slice(dollar + 1).split(",").some((part) => part.trim().toLowerCase() === "badfilter"))) continue;
    const rule = parseRule(trimmed);
    if (!rule) continue;
    const isException = rule.action.type === "allow";
    const key = `${isException ? "allow" : "block"}:${JSON.stringify(rule.condition)}:${rule.priority}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (isException ? exceptions : blocks).push(rule);
  }
  if (!blocks.length && !exceptions.length) throw new Error("EasyList conversion produced no host rules.");
  const limit = Math.max(0, Math.floor(maxRules));
  const selectedExceptions = selectAcrossList(exceptions, Math.min(Math.ceil(limit / 4), exceptions.length));
  const selectedBlocks = selectAcrossList(blocks, Math.max(0, limit - selectedExceptions.length));
  return [...selectedBlocks, ...selectedExceptions];
}

export function sampleEasyListRules(rules, maxRules) {
  const limit = Math.max(0, Math.floor(maxRules));
  const exceptions = rules.filter((rule) => rule.action?.type === "allow");
  const blocks = rules.filter((rule) => rule.action?.type === "block");
  const selectedExceptions = selectAcrossList(exceptions, Math.min(Math.ceil(limit / 4), exceptions.length));
  const selectedBlocks = selectAcrossList(blocks, Math.max(0, limit - selectedExceptions.length));
  return [...selectedBlocks, ...selectedExceptions];
}
