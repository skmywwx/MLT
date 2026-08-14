#!/usr/bin/env python3
"""Sync PRD.md content into PRD.html for offline double-pane reading."""

from __future__ import annotations

import base64
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MD_PATH = ROOT / "docs" / "molitong" / "PRD.md"
HTML_PATH = ROOT / "docs" / "molitong" / "PRD.html"
ROOT_MD_PATH = ROOT / "PRD.md"
ROOT_HTML_PATH = ROOT / "PRD.html"
MARKER_PATTERN = re.compile(
    r'(<script type="text/plain" id="prd-markdown" data-encoding="base64">)(.*?)(</script>)',
    re.DOTALL,
)


def prepare_markdown(raw: str) -> str:
    text = raw.replace("\r\n", "\n")
    text = re.sub(r"\n## 目录[\s\S]*?(?=\n## 0\. 文档信息)", "", text)
    text = re.sub(
        r"^> \[打开双栏独立滚动阅读版\]\(\./PRD\.html\)[^\n]*\n\n",
        "",
        text,
    )
    return text.strip() + "\n"


def sync() -> None:
    if not MD_PATH.exists():
        raise FileNotFoundError(f"Missing source file: {MD_PATH}")
    if not HTML_PATH.exists():
        raise FileNotFoundError(f"Missing target file: {HTML_PATH}")

    markdown = prepare_markdown(MD_PATH.read_text(encoding="utf-8"))
    html = HTML_PATH.read_text(encoding="utf-8")
    payload = base64.b64encode(markdown.encode("utf-8")).decode("ascii")

    if not MARKER_PATTERN.search(html):
        raise RuntimeError("PRD.html is missing the prd-markdown embed marker.")

    updated = MARKER_PATTERN.sub(rf"\1{payload}\3", html, count=1)
    HTML_PATH.write_text(updated, encoding="utf-8")
    shutil.copy2(MD_PATH, ROOT_MD_PATH)
    shutil.copy2(HTML_PATH, ROOT_HTML_PATH)
    print(f"Synced {MD_PATH.name} -> {HTML_PATH.name} ({len(markdown)} chars)")
    print(f"Copied to {ROOT_MD_PATH.relative_to(ROOT)} and {ROOT_HTML_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    try:
        sync()
    except Exception as error:  # noqa: BLE001 - CLI entrypoint
        print(f"error: {error}", file=sys.stderr)
        sys.exit(1)
