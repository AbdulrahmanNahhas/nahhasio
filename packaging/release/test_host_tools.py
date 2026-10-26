"""Coordinated host updates use disposable files and mocked services, never a live catalog."""
import base64
import hashlib
import importlib.util
import io
import json
import os
import subprocess
import sys
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("host_update_operations", ROOT / "packaging/operations/operations.py")
operations = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operations)
tools = operations.host_tools


def contents(version):
    files = {name: b"# disposable host-tool fixture\n" for name in tools.FILES}
    files["operations.py"] = f'HOST_TOOLS_VERSION = "{version}"\n'.encode()
    return files


def archive(files):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as stream:
        for name, body in files.items():
            info = tarfile.TarInfo(tools.FILES.get(name, name))
            info.size = len(body)
            stream.addfile(info, io.BytesIO(body))
    body = output.getvalue()
    return body, {"apiVersion": 1, "size": len(body), "sha256": hashlib.sha256(body).hexdigest(),
                  "url": "https://github.com/example/nahhasio/releases/download/nahhasio-v0.1.2/nahhasio-install.tar.gz"}


class HostUpdates(unittest.TestCase):
    def test_real_bootstrap_and_managed_entrypoints_work_without_release_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            worker, _, _, _ = self.setup_installation(root)
            # Use actual release sources instead of the small state-machine fixtures.
            actual = {name: (ROOT / member).read_bytes() for name, member in tools.FILES.items()}
            # A fresh tools root permits the real 0.1.1 build rather than replacing a version.
            fresh = root / "managed"
            fresh.mkdir(mode=0o700)
            worker.config["dataRoot"] = str(fresh)
            worker.config["version"] = "0.1.0"
            worker.config.pop("hostToolsVersion")
            operations.atomic_json(worker.installation_path, worker.config)
            legacy = tools.private(fresh / "tools")
            (legacy / "operations.py").write_text("# original 0.1.0 worker\n")
            home, binary = root / "home", root / "bin"
            home.mkdir(mode=0o700)
            binary.mkdir(mode=0o700)
            systemctl = binary / "systemctl"
            systemctl.write_text("#!/bin/sh\nexit 3\n")
            systemctl.chmod(0o700)
            environment = {"HOME": str(home), "PATH": str(binary) + os.pathsep + os.environ.get("PATH", "")}
            subprocess.run([sys.executable, str(ROOT / "packaging/operations/operations.py"),
                            "--config-root", str(worker.config_root), "install-units"],
                           check=True, capture_output=True, env=environment)
            store = tools.Store(fresh / "tools")
            self.assertEqual(store.current(), "versions/" + operations.HOST_TOOLS_VERSION)
            self.assertEqual((fresh / "tools/legacy/operations.py").read_text(), "# original 0.1.0 worker\n")
            self.assertEqual(json.loads(worker.installation_path.read_text())["version"], "0.1.0")
            for name in tools.FILES:
                self.assertEqual((fresh / "tools" / name).read_bytes(), actual[name])
            # Invoke the installed installer again: no downloaded release directory is needed.
            subprocess.run([sys.executable, str(fresh / "tools/install.py"),
                            "--config-root", str(worker.config_root), "maintenance-install"],
                           check=True, capture_output=True, env=environment)
            subprocess.run([sys.executable, str(fresh / "tools/operations.py"), "--help"],
                           check=True, capture_output=True, env=environment)
            units = home / ".config/systemd/user/nahhasio-maintenance.service"
            self.assertIn(str(fresh / "tools/operations.py"), units.read_text())

    def setup_installation(self, root):
        config, data = root / "config", root / "data"
        config.mkdir(mode=0o700)
        data.mkdir(mode=0o700)
        store = tools.Store(data / "tools")
        store.bootstrap("0.1.1", contents("0.1.1"))
        metadata = {"configRoot": str(config), "dataRoot": str(data), "quadletRoot": str(root / "quadlets"),
                    "database": "nahhasio", "databaseAdmin": "postgres", "databaseOwner": "nahhasio_owner",
                    "databaseRuntime": "nahhasio_runtime", "databaseContainer": "fixture-postgres",
                    "serverImage": "ghcr.io/example/server@sha256:" + "a" * 64,
                    "version": "0.1.1", "hostToolsVersion": "0.1.1", "schemaVersion": "c" * 64}
        operations.atomic_json(config / "installation.json", metadata)
        maintenance = operations.Maintenance(config)
        body, descriptor = archive(contents("0.1.2"))
        release = {"version": "0.1.2", "schemaVersion": "c" * 64, "hostTools": descriptor,
                   "server": {"image": "ghcr.io/example/server@sha256:" + "b" * 64}}
        maintenance.status["update"] = {"state": "available"}
        return maintenance, release, body, metadata

    def test_bootstrap_retains_legacy_and_switches_all_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            root = tools.private(Path(directory) / "tools")
            (root / "operations.py").write_text("# previous worker\n")
            store = tools.Store(root)
            store.bootstrap("0.1.1", contents("0.1.1"))
            self.assertEqual((root / "legacy/operations.py").read_text(), "# previous worker\n")
            for name, body in contents("0.1.1").items():
                self.assertEqual((root / name).read_bytes(), body)
            store.stage("0.1.2", contents("0.1.2"))
            store.activate("versions/0.1.2")
            self.assertEqual((root / "operations.py").read_bytes(), contents("0.1.2")["operations.py"])
            store.activate("versions/0.1.1")
            self.assertEqual(store.current(), "versions/0.1.1")

    def test_tampering_traversal_and_same_version_replacement_are_rejected(self):
        body, descriptor = archive(contents("0.1.2"))
        with self.assertRaises(ValueError):
            tools.unpack(body + b"changed", descriptor)
        body, descriptor = archive({"../escaped": b"forbidden"})
        with self.assertRaises(ValueError):
            tools.unpack(body, descriptor)
        with tempfile.TemporaryDirectory() as directory:
            store = tools.Store(Path(directory) / "tools")
            store.bootstrap("0.1.1", contents("0.1.1"))
            changed = contents("0.1.1")
            changed["install.py"] = b"# other build\n"
            with self.assertRaises(ValueError):
                store.stage("0.1.1", changed)
            with self.assertRaises(ValueError):
                store.activate("../outside")
            self.assertEqual(store.current(), "versions/0.1.1")

    def test_update_commits_image_tools_metadata_and_worker_reload_together(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, release, body, _ = self.setup_installation(Path(directory))
            with patch.object(worker, "check_update", return_value=release), patch.object(worker, "backup") as backup, \
                    patch.object(worker, "ready"), patch.object(operations, "download", return_value=body), patch.object(operations, "run", return_value=b""):
                result = worker.update()
            backup.assert_called_once_with("before-update")
            self.assertTrue(result["changed"])
            self.assertTrue(worker.reload_tools)
            self.assertEqual(worker.tools.current(), "versions/0.1.2")
            self.assertEqual(json.loads(worker.installation_path.read_text())["hostToolsVersion"], "0.1.2")
            self.assertEqual(json.loads((worker.private / "update-journal.json").read_text())["stage"], "complete")

    def test_failed_readiness_preserves_old_tools_and_installation(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, release, body, before = self.setup_installation(Path(directory))
            with patch.object(worker, "check_update", return_value=release), patch.object(worker, "backup"), \
                    patch.object(worker, "ready", side_effect=[RuntimeError("fixture failure"), None]), \
                    patch.object(operations, "download", return_value=body), patch.object(operations, "run", return_value=b""):
                with self.assertRaises(RuntimeError):
                    worker.update()
            self.assertEqual(worker.tools.current(), "versions/0.1.1")
            self.assertEqual(json.loads(worker.installation_path.read_text()), before)
            self.assertFalse(worker.reload_tools)
            self.assertEqual(json.loads((worker.private / "update-journal.json").read_text())["stage"], "rolled-back")

    def test_metadata_failure_after_tool_switch_rolls_back_both(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, release, body, before = self.setup_installation(Path(directory))
            write = operations.atomic_json
            def fail_commit(path, value):
                if path == worker.installation_path and value.get("hostToolsVersion") == "0.1.2":
                    raise OSError("fixture metadata write failure")
                write(path, value)
            with patch.object(worker, "check_update", return_value=release), patch.object(worker, "backup"), \
                    patch.object(worker, "ready"), patch.object(operations, "download", return_value=body), \
                    patch.object(operations, "run", return_value=b""), patch.object(operations, "atomic_json", side_effect=fail_commit):
                with self.assertRaises(RuntimeError):
                    worker.update()
            self.assertEqual(worker.tools.current(), "versions/0.1.1")
            self.assertEqual(json.loads(worker.installation_path.read_text()), before)

    def test_interrupted_tool_switch_recovers_previous_version(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, release, _, _ = self.setup_installation(Path(directory))
            worker.tools.stage("0.1.2", contents("0.1.2"))
            worker.tools.activate("versions/0.1.2")
            journal = {"stage": "activating", "previousImage": worker.config["serverImage"],
                       "nextImage": release["server"]["image"], "nextVersion": "0.1.2",
                       "previousTools": "versions/0.1.1", "nextTools": "versions/0.1.2", "previousOverride": None}
            operations.atomic_json(worker.private / "update-journal.json", journal)
            with patch.object(operations, "run", return_value=b""), patch.object(worker, "ready"):
                worker.recover_update()
            self.assertEqual(worker.tools.current(), "versions/0.1.1")
            self.assertEqual(json.loads((worker.private / "update-journal.json").read_text())["stage"], "rolled-back")

    def test_worker_reexec_happens_only_after_completed_job_and_removed_claim(self):
        class WorkerReload(BaseException):
            pass
        with tempfile.TemporaryDirectory() as directory:
            worker, release, body, _ = self.setup_installation(Path(directory))
            identifier = "00112233-4455-4677-8899-aabbccddeeff"
            request = {"version": 1, "id": identifier, "operation": "update", "requestedAt": operations.now(),
                       "actorAccountId": "00000000-0000-4000-8000-000000000000"}
            operations.atomic_json(worker.inbox / (identifier + ".json"), request)
            def reload_worker(executable, arguments):
                self.assertEqual(executable, sys.executable)
                self.assertEqual(arguments[-1], "worker")
                self.assertFalse((worker.claimed / (identifier + ".json")).exists())
                self.assertEqual(json.loads((worker.jobs / (identifier + ".json")).read_text())["state"], "succeeded")
                self.assertEqual(worker.tools.current(), "versions/0.1.2")
                raise WorkerReload()
            with patch.object(worker, "check_update", return_value=release), patch.object(worker, "backup"), \
                    patch.object(worker, "ready"), patch.object(operations, "download", return_value=body), \
                    patch.object(operations, "run", return_value=b""), patch.object(operations.os, "execv", side_effect=reload_worker):
                with self.assertRaises(WorkerReload):
                    worker.worker()
            with worker.lock():
                pass

    def test_recovery_finishes_committed_metadata_without_restarting_server(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, release, _, _ = self.setup_installation(Path(directory))
            worker.tools.stage("0.1.2", contents("0.1.2"))
            previous = worker.config["serverImage"]
            worker.config.update(serverImage=release["server"]["image"], version="0.1.2", hostToolsVersion="0.1.2")
            operations.atomic_json(worker.installation_path, worker.config)
            operations.atomic_json(worker.private / "update-journal.json", {
                "stage": "activating", "previousImage": previous, "nextImage": release["server"]["image"],
                "nextVersion": "0.1.2", "previousTools": "versions/0.1.1", "nextTools": "versions/0.1.2"})
            with patch.object(operations, "run") as commands:
                worker.recover_update()
            commands.assert_not_called()
            self.assertEqual(worker.tools.current(), "versions/0.1.2")
            self.assertEqual(json.loads((worker.private / "update-journal.json").read_text())["stage"], "complete")


if __name__ == "__main__":
    unittest.main()
