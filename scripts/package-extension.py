#!/usr/bin/env python3
"""Create a clean Chrome Web Store ZIP from the extension runtime files."""

from pathlib import Path
import json
import sys
import zipfile


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "manifest.json"
OUTPUT_DIR = ROOT / "dist"


def fail(message: str) -> None:
    print(f"Packaging failed: {message}", file=sys.stderr)
    raise SystemExit(1)


try:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as error:
    fail(f"cannot read manifest.json ({error})")

if manifest.get("manifest_version") != 3:
    fail("manifest_version must be 3")
if not manifest.get("name") or not manifest.get("version"):
    fail("manifest name and version are required")
if len(manifest.get("description", "")) > 132:
    fail("manifest description exceeds Chrome Web Store's 132-character limit")

required_files = [
    *manifest.get("icons", {}).values(),
    *manifest.get("action", {}).get("default_icon", {}).values(),
    manifest.get("action", {}).get("default_popup"),
    manifest.get("options_page"),
    manifest.get("background", {}).get("service_worker"),
    *[item.get("path") for item in manifest.get("declarative_net_request", {}).get("rule_resources", [])],
]
for relative in filter(None, required_files):
    if not (ROOT / relative).is_file():
        fail(f"manifest references missing file: {relative}")

package_files = [MANIFEST_PATH, *sorted((ROOT / "src").rglob("*"))]
package_files = [path for path in package_files if path.is_file()]
if not package_files:
    fail("no extension runtime files found")

for path in package_files:
    relative = path.relative_to(ROOT)
    if any(part in {"node_modules", "_metadata", "tests", "private", "secrets"} for part in relative.parts):
        fail(f"refusing to package private or generated path: {relative}")
    if path.name.lower().startswith(".env") or path.suffix.lower() in {".pem", ".key", ".p12", ".pfx", ".jks", ".keystore"}:
        fail(f"refusing to package a secret-like file: {relative}")

OUTPUT_DIR.mkdir(exist_ok=True)
output = OUTPUT_DIR / f"BrowseShield-v{manifest['version']}.zip"
with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in package_files:
        archive.write(path, path.relative_to(ROOT).as_posix())

with zipfile.ZipFile(output) as archive:
    if "manifest.json" not in archive.namelist():
        fail("manifest.json is not at the ZIP root")
    if any(name.startswith(("node_modules/", "_metadata/", "tests/")) for name in archive.namelist()):
        fail("the ZIP contains a development-only directory")

print(f"Created {output.relative_to(ROOT)} ({len(package_files)} files, {output.stat().st_size:,} bytes)")
