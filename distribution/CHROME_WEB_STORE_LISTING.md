# Chrome Web Store listing draft

## Name

BrowseShield

## Short description

Local controls to block unwanted pop-ups and cross-site navigation, and manage disruptive overlays.

## Detailed description

BrowseShield helps you manage disruptive browsing behavior. It can block cross-site navigation and pop-up windows, block domains you choose, and help identify or hide page overlays after you review them.

Protection is controlled by you. Site access is requested only when you enable protection for a site or turn on all-sites protection. Overlay cleanup is user initiated. Network filters are optional and may affect how some sites work.

Settings and the temporary history of intercepted navigation attempts stay on this device. The history is not a complete network-request log. BrowseShield does not operate an account or send browsing history to a BrowseShield server. If you choose to update the optional EasyList filter, the extension downloads the list from easylist.to.

BrowseShield is for desktop Chromium browsers that support the extension APIs it uses. Browser support and behavior can vary.

## Category

Productivity (suggested; confirm in the current dashboard)

## Privacy policy URL

Replace with the public HTTPS URL for `PRIVACY_POLICY.md` after hosting it. Do not submit the placeholder.

## Support URL

Replace with a public support page or repository issue page controlled by the publisher.

## Store images to prepare

- Store icon: use `../src/assets/icons/icon128.png`.
- At least one clear screenshot of the extension popup and a real page with its controls.
- Optional promotional tile and additional screenshots using the current dashboard dimensions.
- Do not show claims such as “blocks every redirect” or “works on every browser.”

## Permission explanations

- `storage`: save settings, selected-site rules, and temporary session history locally.
- `activeTab` and `scripting`: diagnose or pick page elements after the user invokes the feature; synchronize protection on a tab when allowed.
- `declarativeNetRequest`: apply the user's domain and network-filter rules.
- `alarms`: schedule optional EasyList refresh checks.
- Optional HTTP/HTTPS site access: apply navigation protection or persistent overlay rules on sites the user selects; all-sites mode requires broad host access.
- Optional `https://easylist.to/*`: download the community filter list only after the user chooses to enable/update it.

## Privacy declarations to match the dashboard

- Browsing activity: processed on device for filtering and the optional session history.
- Data sold or shared: none by BrowseShield.
- Analytics or advertising: none.
- Remote service operated by BrowseShield: none.
- Third-party filter download: easylist.to, only when the user enables and authorizes the update.

Review these statements against the final build and the current dashboard questions before submission.
