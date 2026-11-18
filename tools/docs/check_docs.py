"""Offline checks for local Markdown links and project skill names."""

import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
LINK = re.compile(r"(?<!\\)\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")
INLINE_CODE = re.compile(r"(`+)(?!`)(.+?)(?<!`)\1(?!`)")
SKILL_NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def check_links(path: Path, text: str) -> list[str]:
    errors = []
    fence = ""
    for line_number, line in enumerate(text.splitlines(), 1):
        marker = FENCE.match(line)
        if marker:
            ticks, rest = marker.groups()
            if not fence:
                fence = ticks
            elif ticks[0] == fence[0] and len(ticks) >= len(fence) and not rest.strip():
                fence = ""
            continue
        if fence:
            continue
        for match in LINK.finditer(INLINE_CODE.sub("", line)):
            destination = match[1] or match[2]
            url = urlsplit(destination)
            if url.scheme or url.netloc or not url.path:
                continue
            local_path = unquote(url.path)
            base = ROOT if local_path.startswith("/") else path.parent
            target = base / local_path.lstrip("/")
            if not target.resolve().is_relative_to(ROOT) or not target.exists():
                location = f"{path.relative_to(ROOT)}:{line_number}"
                errors.append(f"{location}: broken local link: {destination}")
    return errors


def main() -> int:
    docs = set((ROOT / "docs").rglob("*.md"))
    docs.update(ROOT / name for name in ("README.md", "AGENTS.md"))
    skills = set((ROOT / ".agents/skills").glob("*/SKILL.md"))
    errors = []
    for path in sorted(docs | skills):
        text = path.read_text(encoding="utf-8")
        errors.extend(check_links(path, text))
        if path in skills:
            parts = text.split("---\n", 2)
            metadata = parts[1] if len(parts) == 3 and not parts[0] else ""
            name = re.search(r"^name:\s*(\S+)\s*$", metadata, re.MULTILINE)
            if (
                not name
                or not SKILL_NAME.fullmatch(name[1])
                or name[1] != path.parent.name
                or len(name[1]) > 64
            ):
                errors.append(
                    f"{path.relative_to(ROOT)}: skill name must match its directory"
                )
    if errors:
        print("\n".join(errors))
        return 1
    print(
        f"Checked local links in {len(docs)} docs and {len(skills)} skill entry points."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
