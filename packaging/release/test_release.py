"""Offline checks of release trust, archive containment and private-data exclusion."""
import hashlib
import base64
import sys
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


publish = module("publish", ROOT / "packaging/release/publish-flatpak.py")
prepare = module("prepare", ROOT / "packaging/flatpak/prepare.py")


class ReleaseBoundaries(unittest.TestCase):
    def archive(self, root, entries):
        path = root / "repo.tar.gz"
        with tarfile.open(path, "w:gz") as output:
            for name, content in entries.items():
                entry = tarfile.TarInfo(name)
                entry.size = len(content)
                output.addfile(entry, io.BytesIO(content))
        manifest = root / "manifest.json"
        manifest.write_text(json.dumps({"client": {"repositoryArchive": {"size": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}}}))
        return manifest, path

    def test_promoting_a_release_retains_previous_objects(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest, archive = self.archive(root, {"summary": b"new", "summary.sig": b"signature", "config": b"config", "objects/new": b"new object", "refs/heads/app/id/x86_64/alpha": b"new commit"})
            destination = root / "published"
            (destination / "objects").mkdir(parents=True)
            (destination / "objects/old").write_bytes(b"previous object")
            publish.merge(manifest, archive, destination)
            self.assertEqual((destination / "objects/old").read_bytes(), b"previous object")
            self.assertEqual((destination / "summary").read_bytes(), b"new")

    def test_archive_tampering_and_parent_traversal_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest, archive = self.archive(root, {"../escaped": b"forbidden"})
            with self.assertRaises(ValueError):
                publish.merge(manifest, archive, root / "destination")
            self.assertFalse((root / "escaped").exists())
            archive.write_bytes(archive.read_bytes() + b"changed")
            with self.assertRaises(ValueError):
                publish.merge(manifest, archive, root / "other")

    def test_source_pack_excludes_credentials_and_catalog_even_if_tracked(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = ["Cargo.toml", "apps/linux/src/main.rs", "apps/server/.env", "apps/linux/key.pem", "data/catalog.dump", ".env", "apps/linux/../../data/secret"]
            for name in paths[:-1]:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture")
            destination = root / "source"
            destination.mkdir()
            with patch.object(prepare, "ROOT", root):
                prepare.copy_sources(destination, paths)
            self.assertEqual({str(path.relative_to(destination)) for path in destination.rglob("*") if path.is_file()}, {"Cargo.toml", "apps/linux/src/main.rs"})

    def test_release_signatures_verify_exact_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / "key.pem"
            subprocess.run(["openssl", "genpkey", "-algorithm", "ED25519", "-out", str(key)], check=True, capture_output=True)
            (root / "bundle.flatpak").write_bytes(b"Flatpak bundle fixture")
            (root / "key.gpg").write_bytes(b"OpenPGP public fixture")
            (root / "repo.tar.gz").write_bytes(b"Repository archive fixture")
            subprocess.run([sys.executable, str(ROOT / "packaging/release/manifest.py"),
                            "--version", "0.1.0", "--client", str(root / "bundle.flatpak"),
                            "--client-url", "https://github.com/example/nahhasio/releases/download/v0.1.0/client.flatpak",
                            "--server-image", "ghcr.io/example/nahhasio@sha256:" + "a" * 64,
                            "--flatpak-key", str(root / "key.gpg"), "--flatpak-fingerprint", "A" * 40,
                            "--flatpak-repo", str(root / "repo.tar.gz"), "--signing-key", str(key),
                            "--schema-root", str(ROOT / "packages/database/drizzle"), "--output", str(root / "release")], check=True, capture_output=True)
            (root / "manifest").write_bytes((root / "release/manifest.json").read_bytes())
            (root / "public.pem").write_bytes((root / "release/release-key.pem").read_bytes())
            (root / "signature").write_bytes(base64.b64decode((root / "release/manifest.json.sig").read_bytes()))
            command = ["openssl", "pkeyutl", "-verify", "-pubin", "-inkey", str(root / "public.pem"), "-rawin", "-in", str(root / "manifest"), "-sigfile", str(root / "signature")]
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 0)
            (root / "manifest").write_bytes(b'{"version":"9.9.9"}')
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)


if __name__ == "__main__":
    unittest.main()
