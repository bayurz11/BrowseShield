# Contributing to BrowseShield

Thanks for helping improve BrowseShield. Contributions are welcome through issues and pull requests.

## Development setup

1. Install Node.js and Python 3. Install the optional icon tooling with `python -m pip install -r scripts/requirements-icons.txt` if you need to regenerate PNG icons.
2. Clone the repository and run `npm install`.
3. Run `npm test` before submitting changes.
4. For a local extension build, run `npm run package:extension` and load the unpacked project in a Chromium browser with Developer mode enabled.

## Pull requests

- Describe the user-visible problem and the change you made.
- Keep permissions narrowly scoped and explain any permission changes.
- Add or update tests for behavior that can be checked without a browser.
- Do not include credentials, signing keys, personal browser data, or generated build output.
- Do not claim that a browser flow was verified unless it was actually tested in that browser.
- Preserve third-party license and attribution notices.

## License

By contributing, you agree that your contributions are licensed under the project license in `LICENSE`, except for files that identify a separate third-party license.
