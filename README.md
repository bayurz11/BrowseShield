# BrowseShield

BrowseShield is a Chrome Manifest V3 extension starter focused on local, user-controlled browsing protection.

BrowseShield's original source code is released under the MIT License; see [LICENSE](LICENSE). Bundled third-party materials keep their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing, and contribution expectations.

## Current starter features

- A popup with a global protection toggle and current-site allowlist control.
- BrowseShield shield-check extension icons in 16, 32, 48, and 128 px sizes.
- A user-initiated overlay diagnostic. It disables the known `#dontfoid` click-catcher; other suspected overlays are only changed after the user chooses to clean them. Cleanup can be undone without reloading.
- A per-site navigation guard, plus an opt-in **Cegah pengalihan semua situs** mode that requests HTTP/HTTPS host access and applies the guard across matching frames.
- Navigation protection that stops external link clicks and form submissions, blocks popup/new-tab creation, and preserves same-tab navigation within the site.
- A manual element picker that lets you hide a selected page element and undo immediately; reloading also restores temporary selections.
- Optional network blocking for exact domains that the user adds in the settings page.
- Optional EasyList network filter rules for common advertising and tracking requests. It is disabled by default and can be enabled in Settings after turning on **Pemblokiran jaringan**.
- Optional persistent overlay selectors for a site, after the user grants that site's access.
- Local settings stored with `chrome.storage.local`.
- A session-only, best-effort history of blocked network requests and intercepted cross-site links/forms, capped at 100 entries and cleared when the browser session ends. Direct script-triggered popups may not be recorded. Query strings, fragments, and URL credentials are removed from destinations. Users can review or clear history from the popup's **Riwayat** button.

Network filtering is off by default. EasyList is a community-maintained list; DNR conversion supports only a subset of filter-list behavior, and some ads or trackers may remain. Blocking can also affect site functionality. The packaged list is the offline fallback. After enabling EasyList, users can grant access to `easylist.to` from Settings for a manual update; when that permission is available, BrowseShield also checks for updates every seven days. The downloaded list is stored locally, sampled to fit browser rule limits, and never includes browsing history.

To refresh the packaged offline fallback, run `npm install` and `npm run update:filters`, then reload the unpacked extension. The dependency-free generator converts up to 20,000 supported URL filters, sampled across the list. Cosmetic and scriptlet rules and unsupported modifiers are skipped rather than approximated; `badfilter`, domain, resource-type, third-party, case, and priority options are handled when supported by DNR. EasyList is licensed under GPL-3.0-or-later and CC-BY-SA-3.0; see the source notice and [EasyList package metadata](https://github.com/easylist/easylist/blob/master/package.json).

## Validation

Run `npm test` to check network-rule configuration, site exceptions, list enablement, and dynamic rule IDs. After changing the extension, reload it from the browser's extension manager. For an Ark smoke test, enable **Pemblokiran jaringan** and **Filter iklan dan pelacak (EasyList)** in BrowseShield Settings, then check a normal page and a site in the allowlist. Confirm that the allowlisted page still loads its resources and that a known blocked request appears as blocked in the browser's network panel. These browser checks are manual; the Node tests do not launch a browser.

The manifest uses transparent PNGs derived from the supplied shield-and-cursor mark in `scripts/assets/browseshield-source.png` for the extension card and toolbar button. To regenerate them, install Python dependencies with `python -m pip install -r scripts/requirements-icons.txt`, then run `npm run generate:icons`.

Per-site protection requests access to the selected site. **Cegah pengalihan semua situs** requests access to HTTP and HTTPS websites and registers navigation-guard scripts at document start, including inside matching frames. A network rule also blocks cross-site top-level navigation initiated by protected sites, covering direct `window.location` changes that page-level interception cannot catch. Same-site navigation and allowlisted sites remain available. Popup and new-tab creation is blocked while navigation protection is active. When settings change, BrowseShield updates guards on open tabs when the browser still grants the required site access; pages whose permission was revoked may need a reload. Browser-internal pages, extension pages, and other restricted URLs cannot be covered. The fallback relies on browser support for `declarativeNetRequest` conditions `initiatorDomains` and `domainType`.

The global protection switch controls the global network filter, navigation guard, and saved overlay rules. Site exceptions are applied to network rules and content-script protections. Overlay diagnosis remains user initiated; saved selectors only apply to their site, because automatically removing arbitrary elements across all websites can break page controls and media players. Diagnosis may recognize and disable the known `#dontfoid` click-catcher; other large elements are only hidden after the user chooses cleanup. Use **Urungkan** to restore elements hidden in the current page.

After diagnosis, selectors based on element IDs can be saved for the current site from the popup. BrowseShield then asks for access to that site and reapplies saved rules after page reloads. Selectors are limited to IDs for this flow; this avoids saving broad or fragile element matches.

## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Open a normal website, then use the BrowseShield toolbar button to run diagnosis or start the picker.

Chrome internal pages and some restricted pages do not allow extensions to inject scripts.

## Privacy and permissions

Settings and the site allowlist are stored locally. `activeTab` and `scripting` are used to inject the diagnostic only after the user clicks the extension action. EasyList updates contact `easylist.to` only after the user grants that host permission; BrowseShield does not send browsing history or visited URLs to the filter-list host.

The interface uses local SVG symbols from [Heroicons](https://heroicons.com/) (MIT license); see `src/assets/HEROICONS-LICENSE.txt`.

The Chrome Web Store build does not request the development-only `declarativeNetRequestFeedback` permission. Session history therefore focuses on intercepted links and forms; it is not a complete network-request or browser activity log. Direct script-triggered popup attempts may be blocked without being recorded. Destinations are stored without credentials, query strings, or fragments.
