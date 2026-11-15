"""Keep the client core's transitive dependency graph free of UI/server adapters."""

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORE = "nahhasio-client-core"
FORBIDDEN = {
    "nahhasio-linux",
    "nahhasio-server",
    "nahhasio-cli",
    "nahhasio-catalog",
    "nahhasio-native-player",
    "postgres",
    "tokio-postgres",
}
FORBIDDEN_PREFIXES = (
    "gtk",
    "gdk",
    "glib",
    "gobject",
    "gio",
    "pango",
    "libadwaita",
    "webkit",
    "libmpv",
    "libtorrent",
    "sqlx",
    "diesel",
    "tauri",
    "gpui",
    "iced",
    "egui",
    "eframe",
    "slint",
    "xilem",
    "masonry",
    "floem",
    "freya",
    "dioxus",
)


def forbidden_dependencies(tree):
    packages = {
        match.group(1)
        for line in tree.splitlines()
        if (match := re.match(r"^([A-Za-z0-9_-]+) v[0-9]", line))
    }
    if CORE not in packages:
        raise ValueError("Cargo did not return the client core dependency graph")
    return sorted(
        package
        for package in packages
        if package in FORBIDDEN or package.startswith(FORBIDDEN_PREFIXES)
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--offline", action="store_true", help="Use only cached Cargo dependencies"
    )
    args = parser.parse_args()
    command = [
        "cargo",
        "tree",
        "--locked",
        "--package",
        CORE,
        "--all-features",
        "--target",
        "all",
        "--edges",
        "normal,build,dev",
        "--prefix",
        "none",
        "--format",
        "{p}",
    ]
    if args.offline:
        command.append("--offline")
    try:
        tree = subprocess.check_output(command, cwd=ROOT, text=True)
        forbidden = forbidden_dependencies(tree)
    except (OSError, subprocess.CalledProcessError, ValueError) as error:
        print(f"Client core boundary check failed: {error}", file=sys.stderr)
        return 1
    if forbidden:
        print(
            "Client core depends on forbidden adapters: " + ", ".join(forbidden),
            file=sys.stderr,
        )
        return 1
    print(
        "Client core boundary passed: no UI, native-player, or server/database dependencies"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
