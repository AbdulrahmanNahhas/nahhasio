"""Maintenance failure/restart boundaries. Every installation is disposable."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import test_host_tools as fixtures

operations = fixtures.operations


class OperationsRecovery(unittest.TestCase):
    def installation(self, root):
        return fixtures.HostUpdates.setup_installation(self, root)

    def test_policy_validates_bounds_and_reconciles_persisted_intent(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, _, _, _ = self.installation(Path(directory))
            for policy in ({"dailyEnabled": True, "retainDaily": 0},
                           {"dailyEnabled": True, "retainDaily": True},
                           {"dailyEnabled": "yes", "retainDaily": 7},
                           {"dailyEnabled": True, "retainDaily": 7, "command": "no"}):
                with self.assertRaises(ValueError):
                    worker.configure_backups(policy)
            policy = {"dailyEnabled": False, "retainDaily": 14}
            with patch.object(operations, "run", side_effect=RuntimeError("interrupted timer change")):
                with self.assertRaises(RuntimeError):
                    worker.configure_backups(policy)
            self.assertEqual(worker.backup_policy(), policy)
            with patch.object(operations, "run") as run:
                worker.reconcile_backup_timer()
            self.assertEqual(run.call_args.args[0], ["systemctl", "--user", "disable", "--now", "nahhasio-backup.timer"])

    def test_schema_update_requires_review_of_the_same_release(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, release, _, _ = self.installation(Path(directory))
            worker.status["update"]["state"] = "maintenance-required"
            with patch.object(worker, "check_update", return_value=release), patch.object(operations, "download") as download:
                for confirmation in (None, "0.1.9"):
                    with self.assertRaises(ValueError):
                        worker.update(confirmation)
            download.assert_not_called()

    def test_schema_failure_restores_database_before_restart_and_preserves_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, release, body, before = self.installation(Path(directory))
            worker.status["update"]["state"] = "maintenance-required"
            release["schemaVersion"] = "d" * 64
            events = []
            with patch.object(worker, "check_update", return_value=release), \
                    patch.object(worker, "running_units", return_value=[worker.unit]), \
                    patch.object(worker, "backup", return_value={"backupId": "fixture"}) as backup, \
                    patch.object(worker, "stage_schema", side_effect=RuntimeError("migration rejected")), \
                    patch.object(worker, "rollback_schema", side_effect=lambda journal: events.append("rollback")), \
                    patch.object(worker, "resume_units", side_effect=lambda units: events.append("resume")), \
                    patch.object(operations, "download", return_value=body), patch.object(operations, "run", return_value=b""):
                with self.assertRaises(RuntimeError):
                    worker.update("0.1.2")
            backup.assert_called_once_with("before-update", stopped=True)
            self.assertEqual(events, ["rollback", "resume"])
            self.assertEqual(operations.read_json(worker.installation_path), before)
            self.assertEqual(operations.read_json(worker.private / "update-journal.json")["stage"], "rolled-back")

    def test_interrupted_database_switch_rolls_back_once_and_restarts_only_previous_services(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, release, _, _ = self.installation(Path(directory))
            journal = {"stage": "switching-schema", "database": "nahhasio", "stageDatabase": "nahhasio_upgrade_a",
                       "previousDatabase": "nahhasio_previous_a", "previousImage": worker.config["serverImage"],
                       "nextImage": release["server"]["image"], "nextVersion": "0.1.2",
                       "previousOverride": None, "restartUnits": [worker.unit]}
            operations.atomic_json(worker.private / "update-journal.json", journal)
            statements = []
            def sql(statement, database=None):
                statements.append(statement)
                return "nahhasio\nnahhasio_previous_a" if statement.startswith("SELECT datname") else ""
            with patch.object(worker, "sql", side_effect=sql), patch.object(worker, "ready"), patch.object(operations, "run") as run:
                worker.recover_update()
                count = len(statements)
                worker.recover_update()
            self.assertEqual(len(statements), count)
            self.assertTrue(any('ALTER DATABASE "nahhasio_previous_a" RENAME TO "nahhasio"' == statement for statement in statements))
            self.assertTrue(any(call.args[0] == ["systemctl", "--user", "start", worker.unit] for call in run.call_args_list))
            self.assertEqual(operations.read_json(worker.private / "update-journal.json")["stage"], "rolled-back")

    def test_committed_upgrade_finishes_worker_restart_without_database_rollback(self):
        with tempfile.TemporaryDirectory() as directory:
            worker, release, _, _ = self.installation(Path(directory))
            worker.config.update(serverImage=release["server"]["image"], version="0.1.2", mediaWorkerUnit="nahhasio-media-worker.service")
            journal = {"stage": "switching-schema", "stageDatabase": "nahhasio_upgrade_a", "nextImage": release["server"]["image"], "nextVersion": "0.1.2"}
            operations.atomic_json(worker.private / "update-journal.json", journal)
            with patch.object(worker, "rollback_schema") as rollback, patch.object(worker, "resume_units") as resume:
                worker.recover_update()
            rollback.assert_not_called()
            resume.assert_called_once_with(["nahhasio-media-worker.service"])
            self.assertEqual(worker.status["update"]["state"], "up-to-date")
