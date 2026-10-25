# BrowseShield release checklist

- [ ] Review all claims in the store listing and privacy policy against the exact release build.
- [ ] Replace the contact email and host the privacy policy at a public HTTPS URL.
- [ ] Add a public support URL and capture real screenshots from the release build.
- [ ] Run `npm test` and `npm audit --audit-level=high`.
- [ ] Load the unpacked extension in each supported desktop Chromium browser and test the release scenarios listed in `README.md`.
- [ ] Run `npm run package:extension` and inspect `dist/BrowseShield-v<version>.zip`.
- [ ] Confirm `manifest.json` version is greater than the last version submitted to the Chrome Web Store.
- [ ] Upload the ZIP in the Chrome Web Store Developer Dashboard.
- [ ] Complete listing, privacy, permission, and distribution fields truthfully.
- [ ] Choose **Unlisted** for link-only distribution or **Public** for a searchable listing.
- [ ] Submit for review; share the store URL after publication.

Do not commit developer signing keys, account credentials, or a private signing key. The Chrome Web Store handles user installation and update delivery after publication.
