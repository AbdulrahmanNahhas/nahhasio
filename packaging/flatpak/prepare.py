#!/usr/bin/env python3
"""Prepare a private-data-free source tree and locked Cargo/Python dependencies for Flatpak."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tomllib
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]


def copy_sources(output, files):
    for name in files:
        path = Path(name)
        if not name or path.parts[0] not in {"Cargo.toml", "Cargo.lock", "LICENSE", "apps", "crates", "packages", "assets"}:
            continue
        if ".." in path.parts or any(part in {"node_modules", "target", "data", ".git"} or part.startswith(".env") for part in path.parts) or path.suffix in {".pem", ".key"}:
            continue
        source = ROOT / path
        if source.is_symlink():
            raise ValueError("Source files must not be symlinks")
        if not source.is_file():
            continue
        target = output / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def prepare():
    output = ROOT / ".flatpak-source"
    if output.is_symlink():
        raise ValueError("Refusing a symlink source staging directory")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir()
    files = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    copy_sources(output, files)
    ui = ROOT / "apps/linux/ui/dist"
    if not (ui / "index.html").is_file():
        raise ValueError("Build the Linux UI before preparing Flatpak sources")
    shutil.copytree(ui, output / "apps/linux/ui/dist")
    shutil.copytree(ROOT / "packaging/flatpak", output / "packaging/flatpak",
                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    version = tomllib.loads((ROOT / "apps/linux/Cargo.toml").read_text())["package"]["version"]
    epoch = int(subprocess.check_output(["git", "show", "-s", "--format=%ct", "HEAD"], cwd=ROOT))
    metadata = output / "packaging/flatpak/io.nahhasio.Linux.metainfo.xml"
    tree = ET.parse(metadata)
    release = tree.find("releases/release")
    release.set("version", version)
    release.set("date", datetime.datetime.fromtimestamp(epoch, datetime.timezone.utc).date().isoformat())
    tree.write(metadata, encoding="utf-8", xml_declaration=True)
    configuration = subprocess.check_output(["cargo", "vendor", "--locked", "--versioned-dirs", str(output / "vendor")], cwd=ROOT).decode()
    # cargo emits the host absolute vendor path; use a relocatable sandbox-local path.
    configuration = configuration.replace(str(output / "vendor"), "vendor")
    (output / ".cargo").mkdir()
    (output / ".cargo/config.toml").write_text(configuration)
    wheelhouse = output / "python-wheels"
    wheelhouse.mkdir()
    for wheel in json.loads((ROOT / "packaging/flatpak/python-sources.json").read_text()):
        name = wheel["name"]
        if Path(name).name != name or not name.endswith(".whl") or not wheel["url"].startswith("https://files.pythonhosted.org/"):
            raise ValueError("Invalid locked Python source")
        destination = wheelhouse / name
        digest = hashlib.sha256()
        with urllib.request.urlopen(wheel["url"], timeout=60) as source, destination.open("wb") as target:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
                target.write(chunk)
        if digest.hexdigest() != wheel["sha256"]:
            raise ValueError("Python wheel checksum mismatch")
    print("Flatpak source prepared: tracked application sources, built UI and verified offline dependencies")


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    prepare()
