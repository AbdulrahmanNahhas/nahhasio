"""Real migration, backup, restore and crash recovery in bin/test-server-recovery only."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import urllib.parse

import test_host_tools as fixtures

operations = fixtures.operations
ROOT = Path(__file__).resolve().parents[2]
RUN = subprocess.run
FIXTURE = os.environ.get("NAHHASIO_RECOVERY_FIXTURE_ROOT")


@unittest.skipUnless(FIXTURE, "Run bin/test-server-recovery for the disposable PostgreSQL rehearsal")
class PostgreSQLRecovery(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(FIXTURE).resolve()
        if cls.root.parent != Path("/tmp") or not re.fullmatch(r"nahhasio-recovery\.[a-zA-Z0-9]{8}", cls.root.name):
            raise ValueError("Recovery checks require their own temporary cluster")
        cls.env = {**os.environ, "PGHOST": str(cls.root), "PGPORT": "25486", "PGUSER": "nahhasio_fixture"}
        cls.command(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-d", "postgres", "-c",
                     "CREATE ROLE nahhasio_owner LOGIN; CREATE ROLE nahhasio_runtime LOGIN;"])

    @classmethod
    def command(cls, arguments, **kwargs):
        result = RUN(arguments, env=cls.env, capture_output=True, **kwargs)
        if result.returncode:
            raise AssertionError(result.stderr.decode()[-2000:])
        return result.stdout

    def transport(self, arguments, **kwargs):
        """Only replace container/service transport. Database/CLI/archive code runs for real."""
        if arguments[0] == "systemctl":
            return subprocess.CompletedProcess(arguments, 3 if "is-active" in arguments else 0, b"", b"")
        if arguments[:2] == ["podman", "exec"]:
            index = arguments.index("fixture-postgres") + 1
            return RUN(arguments[index:], env=self.env, **{key: value for key, value in kwargs.items() if key != "env"})
        if arguments[:2] == ["podman", "run"]:
            index = arguments.index("/usr/local/bin/nahhasio") + 2
            database = urllib.parse.urlsplit(kwargs["env"]["DATABASE_URL"]).path.removeprefix("/")
            environment = {**self.env, "DATABASE_URL": f"postgresql://nahhasio_owner@localhost:25486/{database}?host={self.root}"}
            return RUN([str(ROOT / "target/debug/nahhasio"), *arguments[index:]],
                       **{**kwargs, "env": environment})
        if arguments[0] == "podman":
            return subprocess.CompletedProcess(arguments, 0, b"", b"")
        return RUN(arguments, **kwargs)

    def prepare(self):
        directory = tempfile.TemporaryDirectory(prefix="recovery-test.", dir=ROOT / "data/development-local")
        self.addCleanup(directory.cleanup)
        worker, release, body, _ = fixtures.HostUpdates.setup_installation(self, Path(directory.name))
        database = "rehearsal_" + Path(directory.name).name.replace("tmp", "")
        database = re.sub("[^a-z0-9_]", "", database)
        self.command(["createdb", "-O", "nahhasio_owner", database])
        worker.config.update(database=database, databaseAdmin="nahhasio_fixture", mediaRoot=str(worker.data))
        operations.atomic_json(worker.installation_path, worker.config)
        (worker.config_root / "owner-password").write_text("disposable-fixture")
        (worker.data / "data/media-operations").mkdir(parents=True)
        (worker.data / "data/media-operations/receipt.json").write_text('{"fixture":"retained"}')
        journal = json.loads((ROOT / "packages/database/drizzle/meta/_journal.json").read_text())
        sql = "BEGIN; SET ROLE nahhasio_owner;\n"
        for entry in journal["entries"][:2]:
            source = (ROOT / "packages/database/drizzle" / (entry["tag"] + ".sql")).read_text()
            sql += source + "\n"
        sql += "CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial primary key,hash text not null,created_at bigint);\n"
        for entry in journal["entries"][:2]:
            digest = hashlib.sha256((ROOT / "packages/database/drizzle" / (entry["tag"] + ".sql")).read_bytes()).hexdigest()
            sql += f"INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES('{digest}',{entry['when']});\n"
        sql += "UPDATE server_instance SET id='00112233-4455-4677-8899-aabbccddeeff' WHERE singleton; INSERT INTO titles(id,canonical_title,sort_title,summary) VALUES('00112233-4455-4677-8899-aabbccddee01','Recovery fixture','Recovery fixture','Retained summary');\n"
        artwork = b"retained-artwork-fixture"
        (worker.artwork / "fixture.png").write_bytes(artwork)
        sql += f"INSERT INTO media_assets(path,sha256,mime_type,byte_size,width,height,original_filename) VALUES('/media/fixture.png','{hashlib.sha256(artwork).hexdigest()}','image/png',{len(artwork)},1,1,'fixture.png');"
        self.command(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-d", database], input=(sql + "\nCOMMIT;").encode())
        return worker, release, body

    def test_upgrade_rehearsal_preserves_original_and_restore_verifies_complete_backup(self):
        worker, release, body = self.prepare()
        with patch.object(operations.subprocess, "run", side_effect=self.transport):
            fingerprint = worker.operator(release["server"]["image"], worker.config["database"], ["migrate", "fingerprint"])["schemaVersion"]
            digest = hashlib.sha256()
            history = ROOT / "packages/database/drizzle"
            for source in sorted([*history.glob("*.sql"), history / "meta/_journal.json"]):
                digest.update(source.relative_to(history).as_posix().encode() + b"\0")
                digest.update(source.read_bytes() + b"\0")
            self.assertEqual(fingerprint, digest.hexdigest(), "CLI and signed release schema fingerprints must agree")
            release["schemaVersion"] = fingerprint
            worker.status["update"]["state"] = "maintenance-required"
            with patch.object(worker, "check_update", return_value=release), patch.object(operations, "download", return_value=body):
                result = worker.update("0.1.2")
            self.assertTrue(result["changed"])
            self.assertEqual(worker.sql("SELECT languages::text FROM titles"), "{en}")
            journal = operations.read_json(worker.private / "update-journal.json")
            old = journal["previousDatabase"]
            self.assertEqual(worker.sql("SELECT summary FROM titles", old), "Retained summary")
            self.assertEqual(worker.sql("SELECT count(*) FROM information_schema.columns WHERE table_name='titles' AND column_name='languages'", old), "0")
            backup = worker.backup()["backupId"]
            source, manifest = worker.validate_backup(backup)
            self.assertIn("media-operations.tar.gz", manifest["files"])
            self.assertIn("media-inventory.json", manifest["files"])
            worker.sql("UPDATE titles SET summary='Changed after backup'")
            worker.restore(backup, backup)
            self.assertEqual(worker.sql("SELECT summary FROM titles"), "Retained summary")
            self.assertEqual((worker.artwork / "fixture.png").read_bytes(), b"retained-artwork-fixture")
            inventory = json.loads((source / "media-inventory.json").read_text())
            self.assertEqual(inventory, [])
            # A hard stop after a committed write exercises PostgreSQL WAL recovery, not graceful shutdown.
            worker.sql("UPDATE titles SET summary='Committed before power loss'")
        transaction = subprocess.Popen(["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", worker.config["database"]],
                                       env=self.env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.addCleanup(lambda: transaction.kill() if transaction.poll() is None else None)
        transaction.stdin.write("BEGIN; UPDATE titles SET summary='Uncommitted write'; SELECT 'fixture-write-ready'; SELECT pg_sleep(30);\n")
        transaction.stdin.flush()
        while transaction.stdout.readline().strip() != "fixture-write-ready":
            if transaction.poll() is not None:
                self.fail("Fixture transaction exited before the crash boundary")
        self.command(["pg_ctl", "-D", str(self.root / "database"), "-m", "immediate", "-w", "stop"])
        transaction.communicate(timeout=5)
        self.assertNotEqual(transaction.returncode, 0)
        self.command(["pg_ctl", "-D", str(self.root / "database"), "-l", str(self.root / "postgres.log"),
                      "-o", f"-k {self.root} -h '' -p 25486", "-w", "start"])
        with patch.object(operations.subprocess, "run", side_effect=self.transport):
            self.assertEqual(worker.sql("SELECT summary FROM titles"), "Committed before power loss")
            self.assertEqual(worker.operator(release["server"]["image"], worker.config["database"], ["migrate", "status"])["pending"], [])

    def test_readiness_failure_restores_old_database_and_image(self):
        worker, release, body = self.prepare()
        previous = worker.config.copy()
        worker.status["update"]["state"] = "maintenance-required"
        with patch.object(operations.subprocess, "run", side_effect=self.transport):
            release["schemaVersion"] = worker.operator(release["server"]["image"], worker.config["database"], ["migrate", "fingerprint"])["schemaVersion"]
            with patch.object(worker, "check_update", return_value=release), patch.object(operations, "download", return_value=body), \
                    patch.object(worker, "ready", side_effect=RuntimeError("fixture readiness failure")):
                with self.assertRaises(RuntimeError):
                    worker.update("0.1.2")
            self.assertEqual(worker.config, previous)
            self.assertEqual(worker.sql("SELECT summary FROM titles"), "Retained summary")
            self.assertEqual(worker.sql("SELECT count(*) FROM information_schema.columns WHERE table_name='titles' AND column_name='languages'"), "0")

    def test_crash_between_database_renames_recovers_previous_catalog(self):
        class PowerCut(BaseException):
            pass
        for boundary in (1, 2):
            with self.subTest(rename=boundary):
                worker, release, body = self.prepare()
                worker.status["update"]["state"] = "maintenance-required"
                with patch.object(operations.subprocess, "run", side_effect=self.transport):
                    release["schemaVersion"] = worker.operator(release["server"]["image"], worker.config["database"], ["migrate", "fingerprint"])["schemaVersion"]
                    original = worker.sql
                    renamed = 0
                    def interrupt(statement, database=None):
                        nonlocal renamed
                        result = original(statement, database)
                        if statement.startswith("ALTER DATABASE"):
                            renamed += 1
                            if renamed == boundary:
                                raise PowerCut()
                        return result
                    with patch.object(worker, "check_update", return_value=release), patch.object(operations, "download", return_value=body), patch.object(worker, "sql", side_effect=interrupt):
                        with self.assertRaises(PowerCut):
                            worker.update("0.1.2")
                    restarted = operations.Maintenance(worker.config_root)
                    restarted.recover_update()
                    self.assertEqual(restarted.sql("SELECT summary FROM titles"), "Retained summary")
                    self.assertEqual(restarted.sql("SELECT count(*) FROM information_schema.columns WHERE table_name='titles' AND column_name='languages'"), "0")
                    self.assertEqual(operations.read_json(restarted.private / "update-journal.json")["stage"], "rolled-back")
