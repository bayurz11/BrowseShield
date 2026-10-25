# BrowseShield Privacy Policy

**Last updated: 25 October 2026**

BrowseShield is a browser extension that applies browsing protections chosen by the user. The extension does not require an account and does not send browsing history to a BrowseShield-operated server.

## Information processed on your device

- Extension settings, site exceptions, blocked domains, and saved overlay selectors are stored locally in browser extension storage.
- The optional temporary history can include intercepted link/form source sites, destination URL paths, event types, and times. It is kept in session storage, limited to 100 entries, and cleared when the browser session ends. URL credentials, query parameters, and fragments are removed before a destination is stored. It is not a complete network-request log; direct script-triggered popup attempts may be blocked without appearing in history.
- Page content is inspected locally only when a user runs overlay diagnosis, chooses an element, or enables a saved selector for a site.

## Network connections

BrowseShield does not transmit browsing history to its developer. If the user grants access and requests an EasyList update, the extension downloads the public filter list from `easylist.to`. The extension does not attach browsing history or visited URLs to that update request. Browsing websites themselves still involves network connections chosen by the user.

## Sharing and sale

BrowseShield does not sell user data or share it with the developer or advertising networks.

## Permissions

- `storage` saves settings, filters, and temporary history on the device.
- `activeTab` and `scripting` support user-requested page diagnosis and protection scripts where the browser grants access.
- `declarativeNetRequest` applies the enabled network rules.
- `alarms` schedules optional filter-list update checks.
- Optional website access allows the user to select which sites BrowseShield protects; all-sites mode asks for broader access.
- Optional access to `easylist.to` is used to download the filter list when the user enables or requests an update.

## Your choices and deletion

You can change or disable protection in the extension, remove saved sites and rules in Settings, clear the temporary history there, or remove BrowseShield from the browser. Removing the extension also removes its locally stored extension data according to the browser's behavior.

## Contact

Replace this line with the publisher's public contact email before submitting: **[Publisher contact email]**.
