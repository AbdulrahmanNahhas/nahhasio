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
import argparse
import contextlib
import os
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


publish = module("publish", ROOT / "packaging/release/publish-flatpak.py")
prepare = module("prepare", ROOT / "packaging/flatpak/prepare.py")
transfer = module("transfer", ROOT / "packaging/server/transfer.py")
installer = module("installer", ROOT / "packaging/server/install.py")


class ReleaseBoundaries(unittest.TestCase):
    def test_candidate_channel_and_descriptors_are_separate_from_alpha(self):
        manifest = module("release_manifest", ROOT / "packaging/release/manifest.py")
        self.assertEqual(manifest.release_channel("0.2.0-rc.1"), "rc")
        self.assertEqual(manifest.release_channel("0.2.0"), "alpha")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / "key.gpg"
            key.write_bytes(b"disposable public key")
            subprocess.run([sys.executable, str(ROOT / "packaging/release/flatpak-descriptors.py"), str(key), str(root), "https://example.test/flatpak-rc/", "rc"], check=True)
            descriptor = (root / "nahhasio.flatpakref").read_text()
            self.assertIn("Branch=rc\n", descriptor)
            self.assertIn("SuggestRemoteName=nahhasio-rc\n", descriptor)
            self.assertNotIn("Branch=alpha", descriptor)


    def test_source_connection_uses_explicit_libpq_fields_without_argv_secrets(self):
        connection = "postgresql://fixture:example%2Bpassword@127.0.0.1:25483/catalog?sslmode=require"
        with patch.dict(os.environ, {"DATABASE_URL": connection, "NAHHASIO_SERVER_TOKEN": "private"}, clear=True):
            with patch.object(transfer.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, b"1", b"")) as run:
                self.assertEqual(transfer.query("SELECT 1"), "1")
        environment = run.call_args.kwargs["env"]
        self.assertEqual(environment["PGDATABASE"], "catalog")
        self.assertEqual(environment["PGHOST"], "127.0.0.1")
        self.assertEqual(environment["PGPORT"], "25483")
        self.assertEqual(environment["PGUSER"], "fixture")
        self.assertEqual(environment["PGPASSWORD"], "example+password")
        self.assertEqual(environment["PGSSLMODE"], "require")
        self.assertIn("default_transaction_read_only=on", environment["PGOPTIONS"])
        self.assertNotIn("NAHHASIO_SERVER_TOKEN", environment)
        self.assertNotIn(connection, run.call_args.args[0])

    def test_prepared_quadlets_keep_mount_options_and_service_dependencies_valid(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "private config"
            args = argparse.Namespace(data_root=str(root / "persistent data"), quadlet_root=str(root / "quadlets"),
                                      server_image="ghcr.io/example/server@sha256:" + "a" * 64,
                                      postgres_image="docker.io/library/postgres@sha256:" + "b" * 64,
                                      schema_version="c" * 64, version="0.1.0", manifest_url=None,
                                      release_key=None, bind_address="127.0.0.1", port=8443)
            with contextlib.redirect_stdout(io.StringIO()):
                installer.prepare(args, config)
            postgres = (root / "quadlets/nahhasio-postgres.container").read_text()
            server = (root / "quadlets/nahhasio-server.container").read_text()
            self.assertIn(f"Volume={config}/postgres-password:/run/secrets/postgres-password:ro,Z\n", postgres)
            for text in (postgres, server):
                self.assertNotIn('Volume="', text)
            self.assertIn("Requires=nahhasio-postgres.service\n", server)
            self.assertIn("After=nahhasio-postgres.service\n", server)
            self.assertIn(f"EnvironmentFile={config}/server.env\n", server)

    def test_media_worker_has_one_media_mount_and_no_private_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "config"
            config.mkdir(mode=0o700)
            (config / "runtime-password").write_text("fixture-runtime-only")
            quadlets = root / "quadlets"
            quadlets.mkdir(mode=0o700)
            image = "ghcr.io/example/server@sha256:" + "a" * 64
            metadata = {"serverImage": image, "quadletRoot": str(quadlets),
                        "databaseRuntime": "nahhasio_runtime", "database": "nahhasio"}
            args = argparse.Namespace(root=str(root / "Nahhasio"), worker_image=image)
            with patch.object(installer, "load", return_value=metadata), contextlib.redirect_stdout(io.StringIO()):
                installer.media_prepare(args, config)
            worker = (quadlets / "nahhasio-media-worker.container").read_text()
            self.assertIn("NAHHASIO_IMPORT_ROOT=/var/lib/nahhasio/videos/.incoming", worker)
            self.assertEqual(sum(line.startswith("Volume=") for line in worker.splitlines()), 2)
            self.assertNotIn("operator.env", worker)
            self.assertNotIn("/config:", worker)
            self.assertNotIn("podman.sock", worker)
            alias = root / "Nahhasio/imports/incoming"
            self.assertEqual(alias.resolve(), root / "Nahhasio/videos/.incoming")
            self.assertEqual((root / "Nahhasio/trash").resolve(), root / "Nahhasio/videos/.trash")
            self.assertEqual((quadlets / "nahhasio-media-worker.container.d/20-release.conf").read_text(),
                             (quadlets / "nahhasio-server.container.d/20-release.conf").read_text())
            api = (quadlets / "nahhasio-server.container.d/30-media.conf").read_text()
            self.assertIn("videos:/var/lib/nahhasio/videos:ro,z", api)
            self.assertEqual((config / "media-worker.env").stat().st_mode & 0o777, 0o600)

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
            (root / "installer.tar.gz").write_bytes(b"Installer archive fixture" * 4)
            subprocess.run([sys.executable, str(ROOT / "packaging/release/manifest.py"),
                            "--version", "0.1.0", "--client", str(root / "bundle.flatpak"),
                            "--client-url", "https://github.com/example/nahhasio/releases/download/v0.1.0/client.flatpak",
                            "--server-image", "ghcr.io/example/nahhasio@sha256:" + "a" * 64,
                            "--installer-bundle", str(root / "installer.tar.gz"),
                            "--installer-url", "https://github.com/example/nahhasio/releases/download/nahhasio-v0.1.0/nahhasio-install.tar.gz",
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
